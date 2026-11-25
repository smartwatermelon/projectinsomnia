# Buttondown Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readers subscribe on `/subscribe`; each new `blog` post gets one teaser email sent automatically after it is live.

**Architecture:** One shared Buttondown API client (`scripts/buttondown.mjs`) used by two consumers: a Netlify `submission-created` event function (signup) and a Node sender script run by a GitHub Action that reads the live `rss.xml` (sending). Buttondown's email list is the only record of what was sent.

**Tech Stack:** Astro 7 static pages, Netlify Forms, Netlify Functions v2 (`export default async (req) => …`), Node 24 (`node --test`), `rss-parser`, GitHub Actions, Buttondown REST API v1.

**Spec:** `docs/superpowers/specs/2026-11-25-buttondown-newsletter-design.md`

**Worktree:** `/Users/andrewrich/Developer/projectinsomnia/.claude/worktrees/newsletter`, branch `claude/feat-buttondown-newsletter-97f81b5d`. All paths below are relative to it. Commits need the sandbox disabled (see the session notes); every commit runs the review hooks.

## Global Constraints

- Free Buttondown tier only. No paid add-ons, no `tags`, no analytics.
- Only the `blog` collection is emailed; `ouatrevisit` and `elections` never.
- Nothing scheduled may start a Netlify build or deploy; no workflow pushes or commits.
- API base: `https://api.buttondown.com/v1`; auth header `Authorization: Token <key>`.
- Secret name everywhere: `BUTTONDOWN_API_KEY` (GitHub secret, set; Netlify env var, Task 6).
- Never log a full email address or an IP address.
- Shell scripts: Bash 5, `shellcheck -S info` clean, no `# shellcheck disable`.
- Comments obey the 140-character length-caps hook; text files end with a newline.
- Public copy (page text) goes through `personify` and `docs/VOICE.md`; the text gate asks Andrew to approve it at commit.

## Review Focus

1. A post with no `description` (RSS gives `""`): the email must still have a sensible body (the link alone), not a blank line or `undefined`. Test in Task 2.
2. Two posts going live the same day: only the oldest is sent; the other goes the next day, never both, never neither. Test in Task 2.
3. Buttondown's email list spanning several pages: a match on page 2 must still block a duplicate. Test in Task 1.
4. A submission with a mixed-case or space-padded address (`" Andrew@Example.com "`): trimmed before sending; never rejected for case. Test in Task 4.
5. The RSS fetch fails or returns zero items: the run fails loudly (exit 1), never "nothing to send, success". Test in Task 2.

---

### Task 1: Shared Buttondown client

**Files:**

- Create: `scripts/buttondown.mjs`
- Test: `test/buttondown.test.mjs`

**Interfaces:**

- Produces:
  - `createButtondownClient({ apiKey: string, fetch?: typeof fetch }) => client` (throws `Error("BUTTONDOWN_API_KEY is not set")` if `apiKey` is empty)
  - `client.createSubscriber({ email: string, ipAddress?: string }) => Promise<"created" | "exists">`
  - `client.listEmails() => Promise<Array<{ id: string, body: string, status: string, publish_date: string | null, creation_date: string }>>` (follows `next` across all pages)
  - `client.sendEmail({ subject: string, body: string }) => Promise<{ id: string }>`
  - `export const SEND_NOW_STATUS` (string; see Step 1)

- [ ] **Step 1: Confirm the "send now" status string**

  Read `https://docs.buttondown.com/api-emails-create` and `https://docs.buttondown.com/api-emails-introduction` (web-fetch agent). Find the exact `status` value that sends an email immediately on `POST /v1/emails`. The diagram names "About to send"; the expected literal is `about_to_send`. Record the quoted doc line in a comment above `SEND_NOW_STATUS`. If the docs give a different value, use it. If they do not settle it, stop and report.

- [ ] **Step 2: Write the failing tests** in `test/buttondown.test.mjs`, using a stub `fetch` that records `(url, init)` and returns queued `Response` objects:
  - `createSubscriber` POSTs `${base}/subscribers` with header `Authorization: Token k` and JSON body `{ email_address: "a@b.co" }`; 201 → `"created"`.
  - with `ipAddress: "1.2.3.4"` the body is `{ email_address, ip_address: "1.2.3.4" }`; without it, no `ip_address` key.
  - 400 → `"exists"`.
  - 500 → rejects with an error whose message contains `500` and does NOT contain the email address.
  - `listEmails` with page 1 `{ results: [e1], next: "<url2>" }` and page 2 `{ results: [e2], next: null }` → `[e1, e2]`, two GETs.
  - `listEmails` non-200 → rejects.
  - `sendEmail` POSTs `${base}/emails` with `{ subject, body, status: SEND_NOW_STATUS }`; 201 → `{ id }`; non-201 rejects.
  - `createButtondownClient({ apiKey: "" })` throws.

- [ ] **Step 3: Run, expect FAIL** — `node --test test/buttondown.test.mjs` → module not found.

- [ ] **Step 4: Implement** `scripts/buttondown.mjs` to satisfy the tests. Default `fetch` is `globalThis.fetch`. Every request has a 20 s timeout (`AbortSignal.timeout(20000)`).

- [ ] **Step 5: Run, expect PASS** — `node --test test/buttondown.test.mjs`.

- [ ] **Step 6: Commit** — `git add scripts/buttondown.mjs test/buttondown.test.mjs`; message `feat(newsletter): add a Buttondown API client`, footer `Advances #105`.

---

### Task 2: Sender script

**Files:**

- Create: `scripts/send-newsletter.mjs`
- Test: `test/send-newsletter.test.mjs`

**Interfaces:**

- Consumes: `createButtondownClient`, `client.listEmails`, `client.sendEmail` (Task 1).
- Produces:
  - `export const LAUNCH_DATE` — ISO date string of the day this merges (set in Task 6; use `"2026-11-25"` until then).
  - `selectPostToSend({ items, emails, launchDate, now }) => { item: RssItem | null, reason: string }` where `RssItem = { title, link, pubDate, contentSnippet? , content? }` from `rss-parser`, and `reason` is one of `"sent-today"`, `"nothing-new"`, `"send"`.
  - `emailFor(item) => { subject: string, body: string }`
  - `run({ env, fetch, log, now }) => Promise<number>` (exit code)

- [ ] **Step 1: Write the failing tests** in `test/send-newsletter.test.mjs`:
  - items dated before `launchDate` are never selected.
  - an item whose `link` appears in any email's `body` is skipped.
  - with two eligible items, the one with the older `pubDate` is selected (Review Focus 2).
  - an email with `status !== "draft"` whose `publish_date` (falling back to `creation_date`) is on the same UTC date as `now` → `{ item: null, reason: "sent-today" }`, even when an item is eligible.
  - a draft email dated today does NOT count as sent today.
  - no eligible items → `{ item: null, reason: "nothing-new" }`.
  - `emailFor({ title: "T", link: "https://projectinsomnia.com/blog/x/", contentSnippet: "D" })` → `{ subject: "T", body: "D\n\n[Read it on projectinsomnia.com](https://projectinsomnia.com/blog/x/)\n" }`.
  - `emailFor` with `contentSnippet: ""` → body is the link line only (Review Focus 1). `rss-parser` exposes `<description>` as `content` and `contentSnippet`; the implementation reads `contentSnippet ?? content ?? ""`. Confirm that mapping in Step 4 by parsing the real `dist/rss.xml` once.
  - `run` with `DRY_RUN=1`: stub fetch serves an RSS XML fixture and an empty email list; result 0; no POST request recorded; log contains the subject.
  - `run` when the email list call returns 500: result 1, no POST.
  - `run` when the RSS fetch fails, or the feed has zero items: result 1 (Review Focus 5).
  - `run` normal path: exactly one POST to `/emails`, result 0.

- [ ] **Step 2: Run, expect FAIL** — `node --test test/send-newsletter.test.mjs`.

- [ ] **Step 3: Implement** `scripts/send-newsletter.mjs`. `run` fetches `env.SITE_URL ?? "https://projectinsomnia.com"` + `/rss.xml` with the injected `fetch`, parses with `new Parser().parseString(xml)`, and creates the client from `env.BUTTONDOWN_API_KEY`. Logs subject and link only. Guard the CLI entry the same way as `scripts/scheduled-publications.mjs` (`import.meta.url === pathToFileURL(process.argv[1]).href`) and `process.exit(await run({ env: process.env, fetch, log: console.log, now: new Date() }))`.

- [ ] **Step 4: Run, expect PASS**, then `npm test` (whole `test/` dir) — all pass.

- [ ] **Step 5: Commit** — the two files; message `feat(newsletter): send one email per new blog post`, footer `Advances #105`.

---

### Task 3: Newsletter workflow

**Files:**

- Create: `.github/workflows/newsletter.yml`

**Interfaces:**

- Consumes: `node scripts/send-newsletter.mjs` (Task 2), env `BUTTONDOWN_API_KEY`, `DRY_RUN`.

- [ ] **Step 1: Write the workflow** with:
  - `on.workflow_run: { workflows: ["Netlify Site Checks"], types: [completed], branches: [main] }`
  - `on.schedule: - cron: '47 13 * * *'` (comment: 47 minutes after the 13:00 UTC scheduled rebuild)
  - `on.workflow_dispatch.inputs.dry_run: { type: boolean, default: true }`
  - `permissions: {}` at top; `concurrency: { group: newsletter, cancel-in-progress: false }`
  - job `send`: `if:` true for `schedule` and `workflow_dispatch`, and for `workflow_run` only when `github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push'`. `permissions: contents: read`. Steps: checkout (SHA-pinned `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7`, `persist-credentials: false`), setup-node (`actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7`, `node-version-file: .nvmrc`, `cache: npm`), `npm ci`, then `node scripts/send-newsletter.mjs` with `BUTTONDOWN_API_KEY: ${{ secrets.BUTTONDOWN_API_KEY }}` and `DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run && '1' || '' }}`.
  - job `report`: copy the `report` job from `.github/workflows/site-health.yml`, with `needs: send`, `if: ${{ failure() }}`, and title `Newsletter send failed`.
  - Header comment (one line, ≤ 140 chars): no Netlify token, hook or push; reads `rss.xml` only.

- [ ] **Step 2: Verify** — `actionlint .github/workflows/newsletter.yml` → no output; the commit's zizmor hook passes.

- [ ] **Step 3: Commit** — message `ci(newsletter): run the sender after deploys and daily`, footer `Advances #105`.

---

### Task 4: Signup function

**Files:**

- Create: `scripts/subscribe-submission.mjs` (logic, testable as plain JS)
- Create: `netlify/functions/submission-created.mts` (thin v2 wrapper)
- Test: `test/subscribe-submission.test.mjs`

**Interfaces:**

- Consumes: `createButtondownClient`, `client.createSubscriber` (Task 1).
- Produces:
  - `redactEmail(email: string) => string` — `"andrew@example.com"` → `"a***@example.com"`.
  - `handleSubmission(payload, { client, log }) => Promise<"ignored" | "created" | "exists">`

- [ ] **Step 1: Write the failing tests**:
  - `payload.form_name !== "subscribe"` → `"ignored"`, `createSubscriber` not called.
  - missing or invalid `payload.data.email` → throws `Error` whose message does not contain the input.
  - `" Andrew@Example.com "` → `createSubscriber` called with `email: "Andrew@Example.com"` (trimmed, case kept) (Review Focus 4).
  - `payload.data.ip = "1.2.3.4"` → `ipAddress: "1.2.3.4"` passed; absent → `ipAddress` undefined.
  - client returns `"exists"` → resolves `"exists"`.
  - client rejects → `handleSubmission` rejects.
  - every string passed to `log` contains `a***@example.com`-style redaction and never the full address or the IP.

- [ ] **Step 2: Run, expect FAIL** — `node --test test/subscribe-submission.test.mjs`.

- [ ] **Step 3: Implement** `scripts/subscribe-submission.mjs`, then `netlify/functions/submission-created.mts`: `export default async (req: Request) => { const { payload } = await req.json(); await handleSubmission(payload, { client: createButtondownClient({ apiKey: Netlify.env.get("BUTTONDOWN_API_KEY") ?? "" }), log: console.log }); return new Response("ok"); }`. Errors propagate so Netlify records a failure. No `config.path` (event function). Import from `../../scripts/…` as `scheduled-rebuild.mts` does.

- [ ] **Step 4: Run, expect PASS** — `npm test`, then `npm run check` (tsc) → no errors.

- [ ] **Step 5: Commit** — the three files; message `feat(newsletter): add subscribers from the Netlify form`, footer `Advances #105`.

---

### Task 5: Pages, links and checks

**Files:**

- Create: `src/pages/subscribe.astro`, `src/pages/subscribe/thanks.astro`
- Modify: `src/layouts/BaseLayout.astro` (footer), `src/layouts/PostLayout.astro` (after `.prose`)
- Modify: `scripts/verify-build-output.sh` (form contract), `scripts/verify-deploy-preview.sh` (`ROUTES`), `scripts/verify-live-content.sh` (`HEADINGS` and its route loop)
- Modify: `test/verify-live-content.test.mjs` (`goodSite()` gains `/subscribe/`)

- [ ] **Step 1: Draft the copy** for both pages, the footer link ("Subscribe"), and the post link ("Get new posts by email"). `/subscribe` says: an email when a new post goes up, nothing else; Buttondown handles it; unsubscribe any time; RSS link as the alternative. `<h1>Subscribe</h1>` and `<h1>Check your inbox</h1>`. Run `personify`, then the `docs/VOICE.md` checks.

- [ ] **Step 2: Build the pages.** Form markup, exact attributes: `<form name="subscribe" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/subscribe/thanks/">`, a `hidden` honeypot `<input name="bot-field">`, `<label for="email">` plus `<input type="email" id="email" name="email" required autocomplete="email">`, a submit button. Style with existing `global.css` variables. The post link renders only when `collection === 'blog'`.

- [ ] **Step 3: Add the form contract check** to `verify-build-output.sh` as a new numbered check on `dist/subscribe/index.html`: it must contain `data-netlify="true"`, `name="subscribe"`, `name="email"` and `name="bot-field"`. Each missing item is a `fail`.

- [ ] **Step 4: Add `/subscribe/`** to `ROUTES` in `verify-deploy-preview.sh`, and `["/subscribe/"]="Subscribe"` plus the route-loop entry in `verify-live-content.sh`; add the page to `goodSite()` in the test.

- [ ] **Step 5: Verify** —
  - `npm run build > "$TMPDIR/build.log" 2>&1 && scripts/verify-build-output.sh "$TMPDIR/build.log"` → `Build output verification passed.`
  - Known-bad: temporarily delete `data-netlify="true"` from `dist/subscribe/index.html`, re-run the check → it fails naming that attribute; rebuild.
  - `grep -L "Get new posts by email" dist/blog/ouatrevisit/*/index.html | wc -l` equals the ouatrevisit page count (link absent on every siloed post); `grep -l` finds it on `dist/blog/five-races/index.html`.
  - `npm test`, `shellcheck -S info` on the three scripts → clean.

- [ ] **Step 6: Commit** — the files above; message `feat(newsletter): add the subscribe page and links`, footer `Advances #105`. The text gate opens the copy for Andrew's approval.

---

### Task 6: Launch configuration and PR

**Files:**

- Modify: `scripts/send-newsletter.mjs` (`LAUNCH_DATE`)

- [ ] **Step 1: Set `LAUNCH_DATE`** to the date the PR will merge (ask Andrew if it is not today). Run `npm test`; commit `chore(newsletter): set the launch date`, footer `Advances #105`.

- [ ] **Step 2: Set the Netlify env var** before merge, so the merge deploy picks it up and no extra deploy is needed: `netlify env:set BUTTONDOWN_API_KEY "$(op read 'op://Automation/Buttondown API/credential')" --scope functions >/dev/null` (check `netlify env:set --help` lists `--scope` first) — never print the value. Confirm with `netlify env:list --json | jq -r 'keys[]' | grep -c BUTTONDOWN_API_KEY` → `1`.

- [ ] **Step 3: Push and open the PR** (`Closes #105` in the PR body only, not in commits). Watch CI with `post-push-status.sh`; the deploy preview must pass `netlify-site-checks` with `/subscribe/` included.

- [ ] **Step 4: After Andrew merges — manual launch checks** (report each result to Andrew):
  1. Andrew turns off the Buttondown public archive and says whether the setting exists on the free tier.
  2. Andrew subscribes on the live `/subscribe/` and confirms the email arrives and the confirmation link works; check `netlify logs --source functions --function submission-created --since 30m` shows `created` with a redacted address.
  3. Run `gh workflow run newsletter.yml -f dry_run=true` and read the log: it should say `nothing-new` (no post after launch yet).
  4. Check whether Buttondown documents a "send test email" endpoint; if yes, propose using it before the first real post; if no, the first post after launch is the first real send.
