## Issue #10 — Strava refresh token rotation warning

**Attempt 1 (complete)**

Issue: `strava-feed.mts` only extracted `access_token` from the token refresh response, silently discarding any new `refresh_token` Strava might issue.

Fix: Destructured `refresh_token` from the response and added a `console.warn` when the returned refresh token differs from the env var. This is a lightweight early-warning signal as requested in the issue.

Build: `npm run build` — passed clean.

Result: wrote `done:` to `.ralph/agent/pr_ready`.
