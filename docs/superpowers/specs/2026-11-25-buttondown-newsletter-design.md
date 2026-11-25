# Buttondown Newsletter — Design

**Date**: 2026-11-25
**Issue**: #105 (investigation), this spec is the implementation design
**Status**: approved in conversation, awaiting written-spec review

## Goal

Readers can subscribe by email. When a new post in the main `blog`
collection goes live on the site, subscribers get one short email with
the post's title, its description, and a link to read it on
projectinsomnia.com. Nothing is written or sent by hand.

## Constraints

- Free Buttondown tier only (first 100 subscribers). No paid add-ons:
  no RSS-to-email ($9/month), no analytics.
- No tracking, consistent with the site's no-analytics rule.
- Only the `blog` collection is ever emailed. `ouatrevisit` and
  `elections` are siloed and never sent.
- Nothing on a schedule may start a Netlify build or deploy. No commits
  to main from CI.
- Stay inside the CMS boundary: this sends a notification per post; it
  does not add editorial tooling.

## Success criteria

1. Exactly one email per new `blog` post, sent after the post is
   visible on the live site.
2. Never a duplicate, never an email for a draft, a future-dated post,
   a siloed post, or any post dated before launch.
3. A failed signup or send is visible to Andrew (error email or
   tracking issue), never silent.

## Decisions made

| Question | Decision |
| :------- | :------- |
| Email content | Teaser: title, `description`, link to the post |
| Form placement | One `/subscribe` page; "Subscribe" link in the site footer; one-line link at the end of each `blog` post |
| Form mechanism | Netlify Forms + `submission-created` function → Buttondown API (the kebab.tax pattern) |
| What triggers a send | The live `rss.xml`, read by a GitHub Action |
| Record of what was sent | Buttondown's own email list (no state in the repo) |
| Buttondown public archive | Turned off; it is not needed for post notifications |

Rejected: scheduling a Buttondown email at merge time (a re-dated or
pulled post still sends unless more code reconciles it), and a sent-log
committed to the repo (each commit to main starts a Netlify build).

## Part 1: Signup

### `/subscribe` page

`src/pages/subscribe.astro`, static, no client JavaScript. Uses
`BaseLayout`. Contains:

- One line on what subscribers get: an email when a new post goes up,
  nothing else.
- A Netlify Form:
  `name="subscribe" method="POST" data-netlify="true"
  netlify-honeypot="bot-field" action="/subscribe/thanks/"`, with a
  hidden honeypot field `bot-field` and a required `email` input
  with a visible label.
- A link to the RSS feed as the alternative.

`src/pages/subscribe/thanks.astro`: "Check your inbox and click the
confirmation link." Shown for every submission, including a duplicate,
so the form never reveals whether an address is already subscribed.

Netlify detects forms in the built HTML. Form detection is on for this
site (`processing_settings.ignore_html_forms` is `false`, checked
2026-11-25).

The page copy is public-facing: run it through `personify` and
`docs/VOICE.md` before it ships.

### Links

- `BaseLayout.astro` footer: a "Subscribe" link to `/subscribe/`.
- `PostLayout.astro`: a one-line "Get new posts by email" link to
  `/subscribe/`, shown only when its existing `collection` prop is
  `'blog'`, never for `ouatrevisit` or `elections`.

### `netlify/functions/submission-created.mts`

Netlify runs this event function on each verified form submission
(spam-filtered, honeypot-checked). It:

1. Ignores submissions whose form name is not `subscribe`.
2. Validates `payload.data.email`.
3. Calls `POST https://api.buttondown.com/v1/subscribers` with
   `Authorization: Token ${BUTTONDOWN_API_KEY}` and
   `{ "email_address": <email> }`. It does not send `type`, so the
   subscriber stays `unactivated` and Buttondown sends the double
   opt-in email (Buttondown docs: "By default, newly created
   subscribers are subject to double opt-in").
4. Sends `ip_address` too, if Netlify's submission payload includes the
   submitter's IP. Buttondown's firewall can otherwise treat many
   signups from Netlify's IPs as suspicious. The IP is used for that
   request only and never stored or logged.
5. Treats 201 as success and 400 (duplicate) as success.
6. Throws on any other status or a network failure. Netlify's existing
   function-error email notifies Andrew. The address is still stored
   in Netlify Forms, so it can be added by hand.
7. Logs only a redacted address (`a***@example.com`).

Environment variable: `BUTTONDOWN_API_KEY` in Netlify, functions scope.
Source of truth: `op://Automation/Buttondown API/credential`.

Cost: one function invocation per signup. Buttondown's limit on this
endpoint is 100 new subscribers per day.

## Part 2: Sending

### `scripts/send-newsletter.mjs`

Node script; all decisions in exported pure functions so they can be
tested without the network. Flow:

1. Fetch `https://projectinsomnia.com/rss.xml` with `rss-parser`
   (already a dependency). The feed contains only published,
   non-draft `blog` posts, so siloed and future posts cannot appear.
2. Keep items with `pubDate >= LAUNCH_DATE`. `LAUNCH_DATE` is a
   constant in the script, set to the day this ships.
3. List Buttondown emails (`GET /v1/emails`, all pages). If this call
   fails, stop and send nothing.
4. Drop every item whose post URL appears in an existing email's body.
5. If any email was sent in the current UTC day, stop (one email per
   day: Buttondown's free-tier pricing assumes at most one a day).
6. Take the oldest remaining item, and send at most one email per run.
   Any others wait for later runs.
7. Send: `POST /v1/emails` with subject = post title and a Markdown
   body of the description plus `[Read it on projectinsomnia.com](<url>)`,
   using the status that sends now. The exact status string is
   confirmed against Buttondown's docs during implementation; only
   `draft` and `scheduled` have been tested live.
8. With `DRY_RUN=1`, print the email that would be sent and make no
   write calls.

Duplicate safety: if a send times out but Buttondown created the email,
the next run finds the URL in step 4 and skips the post.

### `.github/workflows/newsletter.yml`

- Triggers:
  - `workflow_run` of "Netlify Site Checks", completed, conclusion
    success, branch `main`, event `push` (a post merged with a past
    date goes out after the production deploy is verified).
  - `schedule`, daily about 45 minutes after the 13:00 UTC
    scheduled rebuild (future-dated posts).
  - `workflow_dispatch` with a `dry_run` input, default `true`.
- `concurrency: { group: newsletter, cancel-in-progress: false }`, so
  two runs never send at once.
- `permissions: contents: read` for the send job. Only this workflow
  receives `BUTTONDOWN_API_KEY`.
- No Netlify token, no build hook, no push. It reads one static file
  from the site.
- On failure, a separate job with `issues: write` opens a "Newsletter
  send failed" issue, or comments on the open one (same pattern as
  `site-health.yml`).

GitHub secret: `BUTTONDOWN_API_KEY` (set 2026-11-25 by Andrew; the
GitHub App token cannot list secrets, so the first run is the check).

## Testing

Automated, in `npm test` (CI runs it in `build.yml`):

1. Sender: candidate selection, launch guard, URL matching, the
   one-per-day rule, oldest-first, email body format. Buttondown is a
   stubbed `fetch`. Tests prove `DRY_RUN` and a failed list call make
   no write requests.
2. Signup function: 201, 400 duplicate as success, 5xx throws, other
   form names ignored, redacted logging, `ip_address` passed when
   present. Buttondown is stubbed.
3. Form contract: `scripts/verify-build-output.sh` checks that the
   built `dist/subscribe/index.html` has `data-netlify="true"`, the
   form name `subscribe`, an `email` input and the `bot-field`
   honeypot.
4. Site checks: `/subscribe/` added to the route list in
   `verify-deploy-preview.sh` and the heading list in
   `verify-live-content.sh`.

Manual, once, after merge:

1. Turn off the Buttondown public archive, and confirm the setting
   exists on the free tier.
2. Andrew subscribes on the live site and confirms by email (tests the
   form, the function and double opt-in).
3. Run the workflow with `dry_run` and check the output.
4. If Buttondown has a "send test email" endpoint, send one to Andrew
   first. If not, the first real post after launch is the first real
   send.

## Out of scope

- Full-post emails, images or MDX rendering in email.
- Subscriber management, tags, segments, analytics.
- Emailing `ouatrevisit` or `elections`.
- A Buttondown archive page.
