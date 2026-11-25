# Buttondown Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readers subscribe on `/subscribe`; each new `blog` post gets one teaser email sent automatically after it is live.

**Architecture:** Two small, separate pieces. Signup: a Netlify Form plus a `submission-created` function that passes the address to Buttondown, so a provider change is one function and one env var. Sending: one Node script, run by a GitHub Action, that reads the live `rss.xml` and uses Buttondown's email list as the record of what was sent.

**Tech Stack:** Astro 7 static pages, Netlify Forms, Netlify Functions v2, Node 24 (`node --test`), `rss-parser`, GitHub Actions, Buttondown REST API v1.

**Spec:** `docs/superpowers/specs/2026-11-25-buttondown-newsletter-design.md`

**Prior art followed:** Buttondown's tutorial <https://www.buttondown.com/blog/netlify> (signup function); kebab.tax `netlify/functions/submission-created.mjs` (v2 handler shape: `export default async (req) => { const { payload } = await req.json(); … }`). No free off-the-shelf tool sends automatically, so the sender is custom and kept small.

**Worktree:** `/Users/andrewrich/Developer/projectinsomnia/.claude/worktrees/newsletter`, branch `claude/feat-buttondown-newsletter-97f81b5d`. Paths are relative to it. Every commit runs the review hooks.

## Global Constraints

- Free Buttondown tier only. No paid add-ons, no `tags`, no analytics.
- Only the `blog` collection is emailed; `ouatrevisit` and `elections` never.
- Nothing scheduled may start a Netlify build or deploy; no workflow pushes or commits.
- API base `https://api.buttondown.com/v1`; header `Authorization: Token <key>`; secret name `BUTTONDOWN_API_KEY` (GitHub secret is set; Netlify env var in Task 5).
- Never log a full email address or an IP address.
- No new dependencies. Use global `fetch` with `AbortSignal.timeout(20000)`.
- Keep code small: tests cover the safety rules below, not every branch.
- Shell: `shellcheck -S info` clean. Comments within the 140-character length cap. Files end with a newline.
- Public copy goes through `personify` and `docs/VOICE.md`; the text gate asks Andrew to approve it.

## Review Focus

1. Two posts live the same day: only the older is sent; the other goes next day. Test in Task 1.
2. A post with no `description`: the body is the link alone, not `undefined`. Test in Task 1.
3. Buttondown's email list across several pages: a match on page 2 still blocks a duplicate. Test in Task 1.
4. RSS fetch fails or has zero items: exit 1, never a silent "nothing to send". Test in Task 1.
5. A space-padded address (`" a@b.co "`) is trimmed before it reaches Buttondown. Test in Task 3.

---

### Task 1: Sender script

**Files:**

- Create: `scripts/send-newsletter.mjs`
- Test: `test/send-newsletter.test.mjs`

**Interfaces:**

- Produces:
  - `export const LAUNCH_DATE = "2026-11-25"` (final value set in Task 5)
  - `export const SEND_NOW_STATUS` (Step 1)
  - `selectPostToSend({ items, emails, launchDate, now }) => { item, reason }`, `reason` in `"send" | "sent-today" | "nothing-new"`. `items` are `rss-parser` items (`title`, `link`, `isoDate`, `contentSnippet`); `emails` are Buttondown email objects (`body`, `status`, `publish_date`, `creation_date`).
  - `emailFor(item) => { subject, body }`
  - `run({ env, fetch, log, now }) => Promise<number>` (exit code)

- [ ] **Step 1: Confirm the send-now status.** Read `https://docs.buttondown.com/api-emails-create` and `https://docs.buttondown.com/api-emails-introduction`. Find the `status` value that sends immediately (expected `about_to_send`). Quote the doc line in a comment above `SEND_NOW_STATUS`. If the docs do not settle it, stop and report.

- [ ] **Step 2: Write the failing tests** (stub `fetch` records requests and returns queued responses; RSS from a small XML fixture string):
  - items older than `launchDate` are never selected;
  - an item whose `link` is in an email `body` on page 2 of `GET /emails` (`next` URL) is skipped;
  - two eligible items → the older `isoDate` is selected;
  - a non-draft email whose `publish_date ?? creation_date` is the same UTC date as `now` → `reason: "sent-today"`; a draft dated today does not count;
  - `emailFor({ title: "T", link: "https://projectinsomnia.com/blog/x/", contentSnippet: "D" })` → `{ subject: "T", body: "D\n\n[Read it on projectinsomnia.com](https://projectinsomnia.com/blog/x/)\n" }`; with `contentSnippet: ""` the body is the link line only;
  - `run` with `DRY_RUN: "1"` → 0 and no POST; email-list 500 → 1 and no POST; RSS fetch failure or zero items → 1; normal path → exactly one `POST /emails` with `{ subject, body, status: SEND_NOW_STATUS }`, then 0.

- [ ] **Step 3: Run, expect FAIL** — `node --test test/send-newsletter.test.mjs`.

- [ ] **Step 4: Implement.** `run` reads `${env.SITE_URL ?? "https://projectinsomnia.com"}/rss.xml`, parses it with `new Parser().parseString()`, lists all email pages, calls `selectPostToSend`, logs subject and link only, and POSTs unless `DRY_RUN`. CLI guard as in `scripts/scheduled-publications.mjs`. Check once that `rss-parser` maps `<description>` to `contentSnippet` by parsing the built `dist/rss.xml`.

- [ ] **Step 5: Run, expect PASS** — `npm test`.

- [ ] **Step 6: Commit** — message `feat(newsletter): send one email per new blog post`, footer `Advances #105`.

---

### Task 2: Newsletter workflow

**Files:**

- Create: `.github/workflows/newsletter.yml`

- [ ] **Step 1: Write the workflow.**
  - Triggers: `schedule: '47 13 * * *'`; `workflow_dispatch` with boolean input `dry_run`, default `true`. No `workflow_run` (zizmor `dangerous-triggers`; schedule-only chosen 2026-11-25).
  - `permissions: {}`; `concurrency: { group: newsletter, cancel-in-progress: false }`.
  - Job `send` (`permissions: contents: read`): runs for every trigger (no `if`). Steps: checkout and setup-node pinned exactly as in `build.yml`, `npm ci`, `node scripts/send-newsletter.mjs` with `BUTTONDOWN_API_KEY` from secrets and `DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run && '1' || '' }}`.
  - Job `report`: the `report` job from `site-health.yml`, `needs: send`, title `Newsletter send failed`.
  - One-line header comment: no Netlify token, hook or push; reads `rss.xml` only.

- [ ] **Step 2: Verify** — `actionlint .github/workflows/newsletter.yml` prints nothing.

- [ ] **Step 3: Commit** — message `ci(newsletter): run the sender daily`, footer `Advances #105`.

---

### Task 3: Signup function

**Files:**

- Create: `netlify/functions/submission-created.mts`
- Test: `test/submission-created.test.mjs`

**Interfaces:**

- Produces (exported for tests): `addSubscriber({ email, ipAddress, apiKey, fetch }) => Promise<"created" | "exists">` — the only Buttondown-specific code; a provider change replaces this function and the env var.

- [ ] **Step 1: Write the failing tests** (import the `.mts` directly; Node 24 strips types. If it refuses, move `addSubscriber` to `scripts/add-subscriber.mjs` and import that):
  - `addSubscriber` POSTs `/subscribers` with `{ email_address: "a@b.co" }`, plus `ip_address` only when given; 201 → `"created"`; 400 → `"exists"`; 500 → rejects with a message that has the status and not the address.
  - the default handler, given a request whose `payload.form_name` is not `"subscribe"`, makes no fetch; given `" a@b.co "`, calls Buttondown with `"a@b.co"` (Review Focus 5); nothing it logs contains the full address or the IP.

- [ ] **Step 2: Run, expect FAIL** — `node --test test/submission-created.test.mjs`.

- [ ] **Step 3: Implement.** Default export: read `payload`, ignore other forms, trim and roughly validate `payload.data.email`, call `addSubscriber` with `payload.data.ip` if present and `Netlify.env.get("BUTTONDOWN_API_KEY")`, log the outcome with a redacted address (`a***@b.co`), return `new Response("ok")`. Errors propagate so Netlify marks the run failed. No `config.path`. The handler reads the API key at call time, so tests can stub a global `Netlify.env.get`.

- [ ] **Step 4: Run, expect PASS** — `npm test`, then `npm run check`.

- [ ] **Step 5: Commit** — message `feat(newsletter): add subscribers from the Netlify form`, footer `Advances #105`.

---

### Task 4: Pages, links and checks

**Files:**

- Create: `src/pages/subscribe.astro`, `src/pages/subscribe/thanks.astro`
- Modify: `src/layouts/BaseLayout.astro` (footer), `src/layouts/PostLayout.astro` (after `.prose`)
- Modify: `scripts/verify-build-output.sh`, `scripts/verify-deploy-preview.sh`, `scripts/verify-live-content.sh`, `test/verify-live-content.test.mjs`

- [ ] **Step 1: Draft the copy**: `<h1>Subscribe</h1>` page (an email when a new post goes up, nothing else; Buttondown sends it; unsubscribe any time; RSS link as the alternative), `<h1>Check your inbox</h1>` thanks page, footer link "Subscribe", post link "Get new posts by email". Run `personify`, then the `docs/VOICE.md` checks.

- [ ] **Step 2: Build the pages.** Exact form: `<form name="subscribe" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/subscribe/thanks/">` with a `hidden` `<input name="bot-field">`, a labelled `<input type="email" id="email" name="email" required autocomplete="email">`, and a submit button. Existing `global.css` variables only. The post link renders only when `collection === 'blog'`.

- [ ] **Step 3: Checks.** In `verify-build-output.sh`, a new check that `dist/subscribe/index.html` contains `data-netlify="true"`, `name="subscribe"`, `name="email"` and `name="bot-field"`. Add `/subscribe/` to `ROUTES` in `verify-deploy-preview.sh`, and to both the `HEADINGS` map and route loop in `verify-live-content.sh`, and to `goodSite()` in its test.

- [ ] **Step 4: Verify.**
  - `npm run build > "$TMPDIR/build.log" 2>&1 && scripts/verify-build-output.sh "$TMPDIR/build.log"` → `Build output verification passed.`
  - Known-bad: remove `data-netlify="true"` from `dist/subscribe/index.html`, re-run → fails naming it; rebuild.
  - The post link appears in `dist/blog/five-races/index.html` and in no `dist/blog/ouatrevisit/*/index.html` or `dist/blog/elections/*/index.html`.
  - `npm test` passes; `shellcheck -S info` on the three scripts is clean.

- [ ] **Step 5: Commit** — message `feat(newsletter): add the subscribe page and links`, footer `Advances #105`. The text gate opens the copy for Andrew.

---

### Task 5: Launch configuration and PR

**Files:**

- Modify: `scripts/send-newsletter.mjs` (`LAUNCH_DATE`)

- [ ] **Step 1:** Set `LAUNCH_DATE` to the merge date (ask Andrew if not today). `npm test`. Commit `chore(newsletter): set the launch date`, footer `Advances #105`.

- [ ] **Step 2:** Before merge, set the Netlify env var so the merge deploy picks it up: check `netlify env:set --help` lists `--scope`, then `netlify env:set BUTTONDOWN_API_KEY "$(op read 'op://Automation/Buttondown API/credential')" --scope functions >/dev/null`. Confirm with `netlify env:list --json | jq -r 'keys[]' | grep -c BUTTONDOWN_API_KEY` → `1`. Never print the value.

- [ ] **Step 3:** Push, open the PR with `Closes #105` in the PR body only, and watch CI with `post-push-status.sh`. The deploy preview must pass `netlify-site-checks` with `/subscribe/` included.

- [ ] **Step 4: After Andrew merges**, report each result:
  1. Andrew turns off the Buttondown public archive and says whether the free tier has that setting.
  2. Andrew subscribes on the live `/subscribe/` and confirms the email and link work; `netlify logs --source functions --function submission-created --since 30m` shows `created` with a redacted address.
  3. `gh workflow run newsletter.yml -f dry_run=true`; the log says `nothing-new`.
  4. If Buttondown documents a "send test email" endpoint, propose it before the first real post; otherwise the first post after launch is the first real send.
