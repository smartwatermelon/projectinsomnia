# Strava Feed — /now Page Design

**Date**: 2026-03-13
**Status**: Approved, ready for implementation

---

## Goal

Add a Strava activity feed to the `/now` page showing the 10 most recent activities.
Minimal display: name, type, relative date. Each item links to the activity on Strava.

---

## Architecture

Same lazy-load pattern as the GitHub feed:

```
Browser
  └─ page load → renders immediately (static)
       └─ client JS → GET /api/strava-feed (Netlify on-demand function)
                           └─ POST strava.com/oauth/token  (refresh → access token)
                           └─ GET strava.com/api/v3/athlete/activities?per_page=10
                           └─ returns JSON { items: [...] }
```

The `/now` page is fully static. The feed is a progressive enhancement — if
Strava is slow or down, the page renders fine and the feed slot shows
"Activity feed unavailable."

---

## Environment Variables (already set in Netlify)

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

Obtained via one-time manual OAuth flow with `scope=activity:read_all`.
Refresh tokens do not expire unless the app is revoked on Strava.

---

## Netlify Function

**File**: `netlify/functions/strava-feed.mts`
**Route**: `/api/strava-feed` (via `config.path`)

Steps:

1. Read env vars; throw if any are missing
2. `POST https://www.strava.com/oauth/token` with `grant_type=refresh_token`
3. `GET https://www.strava.com/api/v3/athlete/activities?per_page=10` with Bearer token
4. Map to minimal shape; return JSON

Response shape:

```json
{
  "items": [
    {
      "name": "Morning Run",
      "type": "Run",
      "startDate": "2026-03-13T07:00:00Z",
      "link": "https://www.strava.com/activities/12345678"
    }
  ]
}
```

Error handling: log server-side, return `{ items: [] }` with status 502.
Cache header: `s-maxage=300, stale-while-revalidate=600`.

---

## Display

New section in `now.astro` below the GitHub section, same collapsible pattern:

```
Strava
  ▾ Recent activities
    Morning Run        Run    2d ago
    Long Ride          Ride   4d ago
    ...
  View Strava profile →
```

- `<h2>` heading: "Strava"
- `<details open>` with summary "Recent activities" and animated `▾` chevron
- Each row: activity name (linked to `strava.com/activities/{id}`) · type label · relative time
- Profile link: `https://www.strava.com/athletes/133350`
- Client-side fetch with 5-second `AbortController` timeout
- Loading state: "Loading…" → replaced with list or "Activity feed unavailable."

---

## Files Changed

| File | Change |
|------|--------|
| `netlify/functions/strava-feed.mts` | New on-demand function |
| `src/pages/now.astro` | Add Strava section below GitHub section |
