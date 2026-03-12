# /now page — GitHub integration design

**Date**: 2026-03-12
**Scope**: GitHub push event feed for `/now` page, phase 1 of 3 (GitHub, Strava, Instagram)

---

## Architecture

Three components:

1. **Netlify scheduled function** (`netlify/functions/poll-github.mts`) — runs hourly, fetches the GitHub public events API for `smartwatermelon`, filters to `PushEvent` types, writes results to a Netlify Blob.

2. **Netlify Blob** — key `github-activity`, value `{ lastFetched: string, events: PushEvent[] }`. Stores up to 100 events (GitHub API max). Function overwrites on each successful poll; stale cache persists on failure.

3. **`/now` page** (`src/pages/now.astro`) — SSR via `export const prerender = false`. Reads the Blob at request time, applies tiered window filter, renders server-side. No client-side JavaScript.

New dependencies: `@astrojs/netlify` (adapter), `@netlify/blobs` (dev dependency for type support — available in the Netlify Functions runtime automatically).

A `netlify.toml` is added to configure the functions directory.

---

## Data model

Each stored event (raw from GitHub API):

```ts
{
  id: string,
  repo: { name: string },       // e.g. "smartwatermelon/projectinsomnia"
  created_at: string,           // ISO 8601
  payload: {
    commits: [{ sha: string, message: string, author: { name: string } }],
    ref: string                 // e.g. "refs/heads/main"
  }
}
```

Blob shape:

```ts
{
  lastFetched: string,   // ISO 8601, set by the function on each successful poll
  events: PushEvent[]    // raw GitHub PushEvent array, up to 100
}
```

---

## Window logic

Applied at render time on the cached events array:

1. Filter to last 24 hours — if any results, use them; label "last 24 hours"
2. Else filter to last 7 days — if any, use them; label "last 7 days"
3. Else filter to last 30 days — if any, use them; label "last 30 days"
4. Else show "no recent public activity"

Window label is displayed on the page so the timeframe is always clear.

---

## Display (per push event)

One row per event:

- Repo name, linked to `github.com/{repo.name}`
- Branch (stripped of `refs/heads/` prefix)
- Commit count
- First commit message, truncated at ~80 characters
- Relative time ("3 hours ago"), computed server-side at render time

Footer: "Updated X minutes ago" derived from `lastFetched`.

---

## Error handling

| Condition | Behavior |
|---|---|
| Blob doesn't exist yet | Page renders a "checking in soon" placeholder |
| GitHub API transient error | Function exits without writing; stale cache preserved |
| GitHub returns 401 | Function throws with message "GitHub API returned 401 — token may be expired" → Netlify function error notification sent |
| `GITHUB_TOKEN` missing | Function throws with message "GITHUB_TOKEN not set" → Netlify function error notification |
| Empty result (no PushEvents) | Falls through to "no recent public activity" |

**Token is optional for functionality** — unauthenticated requests work at 60/hr (more than enough for hourly polling). Token elevates to 5000/hr and enables error alerting. Missing token is a throw (not soft fail) so Netlify's built-in email notifications fire.

**Netlify notification setup** (manual, post-deploy): Site → Notifications → Email → Function error.

---

## New files

```
netlify.toml
netlify/functions/poll-github.mts
src/pages/now.astro               (replace placeholder)
```

## Changed files

```
astro.config.mjs                  (add @astrojs/netlify adapter)
package.json                      (add @astrojs/netlify, @netlify/blobs)
```
