# Issue #12: Instagram webhook secret validation

## Attempt 1

**What I tried:** Added support for `?secret=` query param in addition to `Authorization: Bearer` header.

**Design doc** (`docs/plans/2026-03-13-instagram-feed-design.md`) specifies:
```
POST /api/instagram-webhook?secret=INSTAGRAM_WEBHOOK_SECRET
```

**Previous implementation** only checked `Authorization: Bearer` header (lines 43-46).

**Fix:** In `netlify/functions/instagram-webhook.mts`, now checks `url.searchParams.get("secret")` first, then falls back to the `Authorization: Bearer` header. This ensures both IFTTT configurations (design doc's query param OR custom header) work correctly.

**Result:** Build passed. Written `pr_ready` with success.
