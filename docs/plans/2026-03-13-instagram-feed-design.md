# Instagram Feed — /now Page Design

**Date**: 2026-03-13
**Status**: Approved, ready for implementation

---

## Goal

Add a 3×3 Instagram photo thumbnail grid to the `/now` page in a right column
alongside the existing GitHub and Strava feeds.

---

## Architecture

Push-based (IFTTT fires on new post) rather than pull-based (no polling API).

```
You post on Instagram
  → IFTTT applet triggers
    → POST /api/instagram-webhook?secret=... (Netlify function)
        → prepend post to Netlify Blobs, keep newest 9

Browser loads /now
  → client JS → GET /api/instagram-feed
                    → reads posts from Blob store
                    → returns JSON { posts: [...] }
```

No backfill of existing posts — feed populates going forward from first post
after applet is live. Empty state shown until first post arrives.

---

## IFTTT Applet

- **Trigger**: Instagram → "New photo by you"
- **Action**: Webhooks → Make a web request
  - URL: `https://projectinsomnia.netlify.app/api/instagram-webhook?secret=INSTAGRAM_WEBHOOK_SECRET`
  - Method: POST
  - Content Type: application/json
  - Body: `{"imageUrl":"{{SourceUrl}}","caption":"{{Caption}}","postUrl":"{{Url}}","timestamp":"{{CreatedAt}}"}`

Ingredient names (`SourceUrl`, `Caption`, `Url`, `CreatedAt`) verified against
IFTTT's Instagram ingredient picker.

---

## Environment Variables (already set in Netlify)

- `INSTAGRAM_WEBHOOK_SECRET` — shared secret validated on every webhook POST

---

## Blob Store

Store: `now-feeds`
Key: `instagram-posts`

Shape:

```json
{
  "lastUpdated": "2026-03-13T00:00:00Z",
  "posts": [
    {
      "imageUrl": "https://...",
      "caption": "Caption text",
      "postUrl": "https://www.instagram.com/p/...",
      "timestamp": "March 13, 2026 at 10:00AM"
    }
  ]
}
```

Max 9 posts stored. Webhook prepends new post and trims array to 9.

---

## Netlify Functions

### `instagram-webhook.mts` — receives IFTTT pushes

- Route: `/api/instagram-webhook`
- Validates `?secret=` query param against `INSTAGRAM_WEBHOOK_SECRET`; returns 401 on mismatch
- Reads current posts from Blob store (empty array if not yet initialized)
- Prepends new post, trims to 9, writes back
- Returns 200 on success

### `instagram-feed.mts` — serves posts to the page

- Route: `/api/instagram-feed`
- Reads posts from Blob store
- Returns `{ posts: [] }` if store is empty
- Cache header: `s-maxage=300, stale-while-revalidate=600`

---

## Display

### Layout

Two-column CSS grid on desktop, single column on mobile:

```
┌─────────────────────┬─────────────────┐
│  GitHub             │  Instagram      │
│  ▾ Recent activity  │  [▪][▪][▪]      │
│  ...                │  [▪][▪][▪]      │
│                     │  [▪][▪][▪]      │
│  Strava             │                 │
│  ▾ Recent activites │  View profile → │
│  ...                │                 │
└─────────────────────┴─────────────────┘
```

Breakpoint: `< 640px` collapses to single column, Instagram below Strava.

### Instagram column

- `<h2>Instagram</h2>`
- 3×3 grid of thumbnails — square (`aspect-ratio: 1 / 1`, `object-fit: cover`),
  tight `0.25rem` gap between cells
- Each thumbnail linked to `postUrl`, `target="_blank"`
- `alt` set to caption text (truncated to 100 chars)
- Empty state: `<p class="muted">No recent posts.</p>`
- Profile link: `https://www.instagram.com/smartwatermelon/`
- Same lazy-load pattern: client JS, 5s `AbortController` timeout

---

## Files Changed

| File | Change |
|------|--------|
| `netlify/functions/instagram-webhook.mts` | New webhook receiver |
| `netlify/functions/instagram-feed.mts` | New feed reader |
| `src/pages/now.astro` | Two-column layout + Instagram column |
