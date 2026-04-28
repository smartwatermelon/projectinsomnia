# Pinned Posts — Homepage and Blog Index Design

**Date**: 2026-04-28
**Status**: Approved, ready for implementation

---

## Goal

Let Andrew flag specific blog posts as "pinned" via a frontmatter tag. Pinned
posts appear in a separate `## Pinned` block above the chronological list on
both `/` (homepage) and `/blog/` (blog index), so the most important posts are
immediately visible to visitors regardless of publish date.

---

## Data Model

Pinning is a frontmatter edit — add `pinned` to the existing `tags` array:

```yaml
---
title: My Important Post
date: 2025-09-12
tags: [pinned, engineering]
---
```

`pinned` is added to `metaTags` in `src/lib/metaTags.ts`, so it is excluded
from the tag cloud and from per-post tag chips on `/blog/`. A new helper
`isPinned(post)` lives next to `isMetaTag` for clarity at call sites.

```ts
// src/lib/metaTags.ts
export const metaTags = ["blog", "ouatrevisit", "elections", "pinned"] as const;
export const PINNED_TAG = "pinned";
export function isPinned(post: { data: { tags?: string[] } }): boolean {
  return (post.data.tags ?? []).includes(PINNED_TAG);
}
```

### Why tags over a discrete schema field

Alternative would be `pinned: z.boolean().default(false)` in
`content.config.ts`. That gives cleaner separation of editorial flag from
topic tags but requires a schema change and gives no real ergonomic win.
Adding `pinned` to the tag array is one keystroke and the existing meta-tag
infrastructure already handles exclusion. Keeping curation in the tag array
also means future flags (e.g. `evergreen`, `series:foo`) plug in without
further schema churn.

### Scope

Blog collection only. The `ouatrevisit` and `elections` collections are
siloed and have their own indexes; pinning there is not requested.

---

## Homepage (`src/pages/index.astro`)

Current behavior: filter to non-draft published posts, sort newest-first,
slice to 5. The change splits that into two arrays.

```ts
const all = (await getCollection('blog'))
  .filter(p => !p.data.draft && p.data.date <= now)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

const pinned = all.filter(isPinned);
const recent = all.filter(p => !isPinned(p)).slice(0, 5);
```

Two `<section>` blocks render, with the Pinned section omitted entirely when
there are zero pinned posts:

```astro
{pinned.length > 0 && (
  <section class="pinned-posts">
    <h2>Pinned</h2>
    <ul class="post-list">
      {pinned.map(post => /* same item markup as Recent */)}
    </ul>
  </section>
)}

<section class="recent-posts">
  <h2>Recent Posts</h2>
  <ul class="post-list">
    {recent.map(post => /* unchanged */)}
  </ul>
  <p><a href="/blog/">All posts →</a></p>
</section>
```

### Behavior on homepage

- Zero pinned posts → page looks identical to today; no empty heading.
- Recent Posts excludes anything pinned, so a freshly-published post that is
  also pinned shows only in Pinned (no duplication).
- The `slice(0, 5)` budget applies only to non-pinned, so total visible =
  pinnedCount + 5.
- "All posts →" link stays under Recent Posts only.

---

## Blog Index (`src/pages/blog/index.astro`)

Adds the same Pinned/Recent split, but only on the unfiltered view. When a
tag filter is active (`?tag=anything`), the Pinned block is hidden and the
list shows all matching posts in chronological order.

```ts
const allPosts = (await getCollection('blog'))
  .filter(p => !p.data.draft && p.data.date <= now)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

const activeTag = Astro.url.searchParams.get('tag');
const filtered = activeTag
  ? allPosts.filter(p => (p.data.tags ?? []).includes(activeTag))
  : allPosts;

const showPinnedSection = !activeTag;
const pinned = showPinnedSection ? allPosts.filter(isPinned) : [];
const remaining = showPinnedSection
  ? filtered.filter(p => !isPinned(p))
  : filtered;
```

Markup adds a Pinned block above the existing list, conditional on
`showPinnedSection && pinned.length > 0`.

### Behavior on /blog/

- Tag cloud is unchanged. `pinned` is a meta tag, so it never appears.
- Filter view is pure: `?tag=X` hides the Pinned block and includes any
  pinned posts that match the filter inline with the chronological list.
- Per-post tag chips: `pinned` is already filtered out by the existing
  `isMetaTag` check on the chip render, so no change needed there.
- The `tag-filter-status` "Showing posts tagged X" line and the "no posts"
  empty-state stay scoped to `remaining`.
- No `<h2>Recent Posts</h2>` is added on `/blog/`. The existing page has no
  heading on the list; adding one would feel awkward when there is no Pinned
  block (zero pins, or filter active). Keeping the existing list
  heading-less means the page degrades cleanly.

---

## Styling (`src/styles/global.css`)

The `.post-list` styling already exists and works for both blocks. Add only:

```css
.pinned-posts { margin-bottom: 2.5rem; }
.pinned-posts h2 { margin-top: 0; }
```

No special "pinned" badge or icon on individual items. The section heading
is the signal. A subtle pin glyph on each title can be added later as a
one-line change if desired.

---

## Out of Scope

- **RSS**: stays purely chronological. RSS readers handle ordering
  themselves, and republishing a re-pinned post would confuse readers.
- **Sitemap**: no change.
- **Siloed collections** (`ouatrevisit`, `elections`): no pinning.
- **Schema field**: no `pinned: boolean` added to the content schema.
- **Hard cap on pinned count**: not enforced. If the block grows unwieldy
  that is a signal to unpin older posts manually.

---

## Editorial Loop

1. Edit the post's frontmatter, add or remove `pinned` from `tags`.
2. Commit on a branch, push, merge.
3. Netlify rebuilds; pin appears or disappears.

No admin UI, no separate config file, no rebuild step beyond the normal
deploy.

---

## Edge Cases

- Zero pinned posts → Pinned section omitted, layouts identical to today.
- All pinned posts are drafts or future-dated → filtered out by the existing
  `!draft && date <= now` gate before the pin split, so the section will
  not show stale entries.
- Pinned post deleted → tag goes with it; section recalculates on next build.
- Future-dated pinned post → does not appear until its date passes,
  consistent with current behavior.

---

## Files Changed

1. `src/lib/metaTags.ts` — extend `metaTags`, export `PINNED_TAG` and
   `isPinned()`.
2. `src/pages/index.astro` — split posts, render Pinned section
   conditionally.
3. `src/pages/blog/index.astro` — same split, gated on `!activeTag`.
4. `src/styles/global.css` — two CSS rules.

No changes to `content.config.ts`, RSS, sitemap, individual post layout, or
the siloed collections.

---

## Local Verification

- `pnpm build` — verify no schema or render errors.
- `pnpm dev`, pin one existing post, check `/` and `/blog/` show the Pinned
  block above the chronological list.
- Visit `/blog/?tag=<existing-tag>` — confirm Pinned block disappears.
- Unpin, confirm both pages return to baseline (no Pinned heading).
