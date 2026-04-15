## Attempt 1 — 2026-04-15

**Issue #48:** Add `isMetaTag(t: string): boolean` helper to `src/lib/metaTags.ts` to eliminate repeated `(metaTags as readonly string[]).includes(t)` casts at 3 call sites.

**What I tried:** Added the helper to `metaTags.ts`, updated imports in `src/pages/blog/index.astro` and `src/layouts/PostLayout.astro` to use `isMetaTag` instead of the inline cast.

**Result:** Build succeeded. All 3 call sites now use `isMetaTag(t)`.

**Status:** Done.
