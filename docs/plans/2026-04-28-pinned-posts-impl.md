# Pinned Posts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Let Andrew flag specific blog posts with a `pinned` tag so they
render in a dedicated `## Pinned` section above the chronological list on
both `/` (homepage) and `/blog/`.

**Architecture:** Reuses the existing `metaTags` exclusion mechanism in
`src/lib/metaTags.ts`. No content-schema change. Two page components are
modified to split the post array into pinned/non-pinned and render two
sections. CSS adds two rules.

**Tech Stack:** Astro 5, TypeScript, plain CSS. Build via `pnpm build`,
type-check via `npx astro check`.

**Branch:** `claude/feat-pinned-posts-20260428` (already created).

**Design doc:** `docs/plans/2026-04-28-pinned-posts-design.md`.

---

## Pre-flight

Confirm working directory and branch:

```bash
pwd                                  # /Users/andrewrich/Developer/netlify/projectinsomnia
git branch --show-current            # claude/feat-pinned-posts-20260428
git status --short                   # clean
```

---

## Task 1: Extend `metaTags.ts` with `isPinned()`

**Files:**

- Modify: `src/lib/metaTags.ts`

### Step 1: Update the file

Replace the contents of `src/lib/metaTags.ts` with:

```ts
/** Collection-level tags excluded from display and the tag cloud. */
export const metaTags = ["blog", "ouatrevisit", "elections", "pinned"] as const;

/** The tag literal that flags a post as pinned to the top of post lists. */
export const PINNED_TAG = "pinned";

/** Returns true if the given tag is a collection-level meta tag. */
export function isMetaTag(t: string): boolean {
  return (metaTags as readonly string[]).includes(t);
}

/** Returns true if the post is pinned (carries the `pinned` tag). */
export function isPinned(post: { data: { tags?: string[] } }): boolean {
  return (post.data.tags ?? []).includes(PINNED_TAG);
}
```

### Step 2: Type-check

Run: `npx astro check 2>&1 | tail -10`
Expected: `0 errors, 0 warnings, 0 hints` (or similar). Any new error means
the export shape regressed an existing import.

### Step 3: Commit

```bash
git add src/lib/metaTags.ts
git commit -m "feat(metaTags): add PINNED_TAG and isPinned() helper

Adds 'pinned' to the meta-tag exclusion list (so it stays out of the
tag cloud and per-post chips) and exports a typed helper for use by
the homepage and blog index."
```

---

## Task 2: Homepage — split into Pinned + Recent sections

**Files:**

- Modify: `src/pages/index.astro`

### Step 1: Update the frontmatter (lines 1-11)

Replace the existing import block and post-loading logic with:

```ts
---
import { getCollection } from 'astro:content';
import { slugFromId } from '../lib/slugFromId';
import { isPinned } from '../lib/metaTags';
import BaseLayout from '../layouts/BaseLayout.astro';

const now = new Date();
const all = (await getCollection('blog'))
  .filter(p => !p.data.draft && p.data.date <= now)
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

const pinned = all.filter(isPinned);
const recent = all.filter(p => !isPinned(p)).slice(0, 5);
---
```

### Step 2: Update the body

Replace the `<section class="recent-posts">…</section>` block with:

```astro
{pinned.length > 0 && (
  <section class="pinned-posts">
    <h2>Pinned</h2>
    <ul class="post-list">
      {pinned.map(post => {
        const slug = slugFromId(post.id);
        return (
          <li>
            <a href={`/blog/${slug}/`}>{post.data.title}</a>
            <div class="post-meta">
              <time datetime={post.data.date.toISOString()}>
                {post.data.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  </section>
)}

<section class="recent-posts">
  <h2>Recent Posts</h2>
  <ul class="post-list">
    {recent.map(post => {
      const slug = slugFromId(post.id);
      return (
        <li>
          <a href={`/blog/${slug}/`}>{post.data.title}</a>
          <div class="post-meta">
            <time datetime={post.data.date.toISOString()}>
              {post.data.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </time>
          </div>
        </li>
      );
    })}
  </ul>
  <p><a href="/blog/">All posts →</a></p>
</section>
```

The `posts.map(...)` body is duplicated by design — six lines, not worth
extracting a component yet (YAGNI).

### Step 3: Build

Run: `pnpm build 2>&1 | tail -20`
Expected: build completes, ends with `Complete!` or similar success line.
No type errors, no missing-import warnings.

### Step 4: Commit

```bash
git add src/pages/index.astro
git commit -m "feat(home): split posts into Pinned + Recent sections

When any blog post carries the 'pinned' tag, the homepage shows a
'Pinned' section above the existing 'Recent Posts' list. Recent
Posts excludes pinned items to avoid duplication. With zero pinned
posts the page renders identically to before."
```

---

## Task 3: Blog index — split with filter-aware gating

**Files:**

- Modify: `src/pages/blog/index.astro`

### Step 1: Update the frontmatter

Replace the existing post-loading and filter logic. The new version:

- adds `isPinned` to the `metaTags` import
- computes `showPinnedSection`, `pinned`, and `remaining`

The section near `// Filter by active tag` becomes:

```ts
import { isMetaTag, isPinned } from '../../lib/metaTags';
```

```ts
// Filter by active tag
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

### Step 2: Update the body to render Pinned, then the existing list

Insert this block immediately above the existing `{activeTag && (...)}`
filter-status block (the one that starts with `{activeTag && (`):

```astro
{showPinnedSection && pinned.length > 0 && (
  <section class="pinned-posts">
    <h2>Pinned</h2>
    <ul class="post-list">
      {pinned.map(post => {
        const slug = slugFromId(post.id);
        return (
          <li>
            <a href={`/blog/${slug}/`}>{post.data.title}</a>
            <div class="post-meta">
              <time datetime={post.data.date.toISOString()}>
                {post.data.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
              </time>
              {(post.data.tags ?? [])
                .filter(t => !isMetaTag(t))
                .map(tag => (
                  <a href={`/blog/?tag=${encodeURIComponent(tag)}`} class="tag">{tag}</a>
                ))
              }
            </div>
          </li>
        );
      })}
    </ul>
  </section>
)}
```

Then change the existing list iteration from `posts.map` to `remaining.map`
on the chronological `<ul class="post-list">` block.

Also change `posts.length === 0` in the empty-state check to
`remaining.length === 0`.

The `posts` variable defined under `// Filter by active tag` is removed —
`remaining` replaces it.

### Step 3: Build

Run: `pnpm build 2>&1 | tail -20`
Expected: build completes successfully. No `posts is not defined` errors.

### Step 4: Commit

```bash
git add src/pages/blog/index.astro
git commit -m "feat(blog): pinned posts surface above chronological list

Pinned section appears above the chronological list on the
unfiltered /blog/ view. When a tag filter is active (?tag=X), the
Pinned section is hidden and pinned posts that match the filter
appear inline with the rest. Tag chips on pinned items still hide
the meta-only 'pinned' tag via the existing isMetaTag check."
```

---

## Task 4: CSS — Pinned section spacing

**Files:**

- Modify: `src/styles/global.css`

### Step 1: Add two rules

Append (or place near other section-level rules — find where
`.recent-posts` or similar rules live and insert nearby for cohesion):

```css
.pinned-posts { margin-bottom: 2.5rem; }
.pinned-posts h2 { margin-top: 0; }
```

### Step 2: Build

Run: `pnpm build 2>&1 | tail -10`
Expected: success.

### Step 3: Commit

```bash
git add src/styles/global.css
git commit -m "style: spacing for .pinned-posts section"
```

---

## Task 5: Manual verification (do not commit the test pin)

### Step 1: Pick a sample post and pin it temporarily

```bash
ls src/content/blog/ | head
```

Pick any post, e.g. `2026-03-XX-some-post.md`. Open its frontmatter and add
`pinned` to the tags array. Save — but **do not commit**. This is a
verification step only.

### Step 2: Start dev server

Run: `pnpm dev`
Expected: server starts on localhost:4321 (or 3000 — check output).

### Step 3: Verify each surface

In a browser (or via curl) check:

- `/` — Pinned section appears above Recent Posts. The pinned post is in
  the Pinned section, not in Recent Posts. Recent Posts shows 5 items.
- `/blog/` — Pinned section appears above the chronological list. Pinned
  post is not duplicated below.
- `/blog/?tag=<some-existing-tag>` — Pinned section is gone. List shows
  matching posts in chronological order.
- Tag cloud on `/blog/` — `pinned` does not appear.
- Per-post tag chips — `pinned` does not appear on the pinned post's chip
  list.

### Step 4: Unpin the test post

Remove `pinned` from the test post's tags. Save.

### Step 5: Verify baseline restored

Reload `/` and `/blog/` — no Pinned section, layout identical to before
the change.

### Step 6: Confirm git state is clean

```bash
git status --short
```

Expected: clean. If the test post still shows as modified, revert it:

```bash
git checkout -- src/content/blog/<test-post>.md
```

### Step 7: Stop the dev server (Ctrl-C)

---

## Wrap-up

Run the full local review gate before considering the work complete:

```bash
pnpm build 2>&1 | tail -10
git log --oneline main..HEAD
```

Expected: 4 commits beyond main (metaTags, homepage, blog index, CSS).

The pre-commit hook will have run `code-reviewer` and `adversarial-reviewer`
on each commit; verify the latest review log:

```bash
head -6 $(git rev-parse --git-dir)/last-review-result.log
```

If clean, the branch is ready to push. **Do not push or open a PR
automatically — wait for explicit approval per Protocol 6.**

---

## Rollback

If anything goes sideways mid-implementation:

```bash
git reset --hard <commit-before-task-N>
```

Or to abandon the whole branch:

```bash
git switch main
git branch -D claude/feat-pinned-posts-20260428
```
