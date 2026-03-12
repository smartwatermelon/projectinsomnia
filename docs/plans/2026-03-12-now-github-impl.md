# /now Page — GitHub Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a GitHub push event feed to the `/now` page, polling hourly via a Netlify scheduled function and caching in Netlify Blobs.

**Architecture:** Netlify scheduled function fetches `smartwatermelon`'s public GitHub push events hourly and writes to a Netlify Blob. The `/now` page is SSR (via `@astrojs/netlify` adapter in hybrid mode), reads the Blob at request time, applies a tiered window filter (24h → 7d → 30d), and renders server-side with no client JS.

**Tech Stack:** Astro 5 (hybrid SSR), `@astrojs/netlify`, `@netlify/blobs`, Netlify Functions v2 (TypeScript), GitHub Events REST API.

**Design doc:** `docs/plans/2026-03-12-now-github-design.md`

---

## Task 1: Install dependencies and add Netlify adapter

**Files:**

- Modify: `package.json`
- Modify: `astro.config.mjs`
- Create: `netlify.toml`

**Step 1: Install packages**

```bash
cd /Users/andrewrich/Developer/netlify/projectinsomnia
npm install @astrojs/netlify @netlify/blobs
```

Expected: packages added to `node_modules` and `package.json` dependencies.

**Step 2: Update `astro.config.mjs`**

Replace the full file contents:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
  site: 'https://projectinsomnia.com',
  integrations: [
    expressiveCode({
      themes: ['dracula'],
    }),
    mdx(),
    sitemap(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'dracula',
    },
  },
});
```

**Step 3: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

**Step 4: Verify the build compiles**

```bash
npm run build
```

Expected: build succeeds, `dist/` populated. The site still works as static — `hybrid` mode preserves static prerendering for all existing pages.

**Step 5: Commit**

```bash
git add astro.config.mjs netlify.toml package.json package-lock.json
git commit -m "feat(now): add Netlify adapter and Blobs dependency"
```

---

## Task 2: Create the GitHub scheduled function

**Files:**

- Create: `netlify/functions/poll-github.mts`

**Step 1: Create the functions directory and file**

```bash
mkdir -p /Users/andrewrich/Developer/netlify/projectinsomnia/netlify/functions
```

Create `netlify/functions/poll-github.mts`:

```typescript
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const GITHUB_USERNAME = "smartwatermelon";
const BLOB_STORE = "now-feeds";
const BLOB_KEY = "github-activity";

export default async function handler(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN not set — add it to Netlify environment variables"
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "projectinsomnia-now-page",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=100`,
    { headers }
  );

  if (response.status === 401) {
    throw new Error(
      "GitHub API returned 401 — GITHUB_TOKEN may be expired or invalid"
    );
  }

  if (!response.ok) {
    // Transient error: log but soft-fail so stale cache is preserved
    console.error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
    return;
  }

  const events = await response.json() as Array<{ type: string }>;
  const pushEvents = events.filter((e) => e.type === "PushEvent");

  const store = getStore(BLOB_STORE);

  await store.setJSON(BLOB_KEY, {
    lastFetched: new Date().toISOString(),
    events: pushEvents,
  });

  console.log(
    `poll-github: stored ${pushEvents.length} push events at ${new Date().toISOString()}`
  );
}

export const config: Config = {
  schedule: "@hourly",
};
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors. If `@netlify/functions` types are missing, install them:

```bash
npm install --save-dev @netlify/functions
```

Then rebuild.

**Step 3: Commit**

```bash
git add netlify/functions/poll-github.mts package.json package-lock.json
git commit -m "feat(now): add GitHub poll scheduled function (hourly)"
```

---

## Task 3: Replace `/now` placeholder with SSR page

**Files:**

- Modify: `src/pages/now.astro`

Replace the entire file:

```astro
---
export const prerender = false;

import BaseLayout from '../layouts/BaseLayout.astro';
import { getStore } from '@netlify/blobs';

interface Commit {
  sha: string;
  message: string;
  author: { name: string };
}

interface PushEvent {
  id: string;
  repo: { name: string };
  created_at: string;
  payload: {
    commits: Commit[];
    ref: string;
  };
}

interface GitHubActivity {
  lastFetched: string;
  events: PushEvent[];
}

// --- Read from Blob cache ---
let activity: GitHubActivity | null = null;

try {
  const store = getStore('now-feeds');
  activity = await store.getJSON('github-activity') as GitHubActivity | null;
} catch {
  // Blob doesn't exist yet — first deploy before function has run
}

// --- Tiered window filter ---
let windowLabel = '';
let displayEvents: PushEvent[] = [];

if (activity && activity.events.length > 0) {
  const now = Date.now();
  const ms = (h: number) => h * 60 * 60 * 1000;

  const filter = (cutoff: number) =>
    activity!.events.filter(
      (e) => new Date(e.created_at).getTime() > now - cutoff
    );

  const h24 = filter(ms(24));
  const d7  = filter(ms(24 * 7));
  const d30 = filter(ms(24 * 30));

  if (h24.length > 0) {
    displayEvents = h24;
    windowLabel = 'last 24 hours';
  } else if (d7.length > 0) {
    displayEvents = d7;
    windowLabel = 'last 7 days';
  } else if (d30.length > 0) {
    displayEvents = d30;
    windowLabel = 'last 30 days';
  }
}

// --- Helpers ---
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function branch(ref: string): string {
  return ref.replace('refs/heads/', '');
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const lastFetched = activity?.lastFetched
  ? relativeTime(activity.lastFetched)
  : null;
---

<BaseLayout title="Now">
  <h1>Now</h1>

  <section class="feed-section">
    <h2 class="feed-heading">
      GitHub
      {windowLabel && <span class="window-label">— {windowLabel}</span>}
    </h2>

    {!activity && (
      <p class="muted">Activity feed initializing — check back soon.</p>
    )}

    {activity && displayEvents.length === 0 && (
      <p class="muted">No recent public activity.</p>
    )}

    {displayEvents.length > 0 && (
      <ul class="event-list">
        {displayEvents.map((event) => (
          <li class="event">
            <div class="event-meta">
              <a
                href={`https://github.com/${event.repo.name}`}
                target="_blank"
                rel="noopener noreferrer"
                class="repo-name"
              >
                {event.repo.name}
              </a>
              <span class="branch-name">{branch(event.payload.ref)}</span>
              <span class="event-time">{relativeTime(event.created_at)}</span>
            </div>
            <div class="commit-summary">
              {event.payload.commits.length} commit{event.payload.commits.length !== 1 ? 's' : ''} —
              <span class="commit-message">
                {truncate(event.payload.commits[0]?.message ?? '')}
              </span>
            </div>
          </li>
        ))}
      </ul>
    )}

    {lastFetched && (
      <p class="updated">Updated {lastFetched}</p>
    )}
  </section>
</BaseLayout>

<style>
  .feed-section {
    margin-bottom: 3rem;
  }

  .feed-heading {
    margin-bottom: 1rem;
  }

  .window-label {
    font-weight: 400;
    color: var(--color-muted);
    font-size: 0.9em;
  }

  .event-list {
    list-style: none;
    padding: 0;
  }

  .event {
    padding: 1rem 0;
    border-bottom: 1px solid var(--color-border);
  }

  .event:last-child {
    border-bottom: none;
  }

  .event-meta {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .repo-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .repo-name:hover {
    color: var(--color-accent);
  }

  .branch-name {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-muted);
    background: var(--color-surface);
    padding: 0.1em 0.4em;
    border-radius: 3px;
  }

  .event-time {
    font-size: 0.85rem;
    color: var(--color-muted);
    margin-left: auto;
  }

  .commit-summary {
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .commit-message {
    color: var(--color-text);
  }

  .updated {
    margin-top: 1.5rem;
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .muted {
    color: var(--color-muted);
  }
</style>
```

**Step 2: Verify build compiles**

```bash
npm run build
```

Expected: succeeds, no TS errors. The `/now` route exists in `dist/`.

**Step 3: Smoke-test locally**

```bash
npm run dev
```

Open `http://localhost:4321/now`. Expected: page renders with "Activity feed initializing — check back soon." (no Blob exists locally — correct behavior).

**Step 4: Commit**

```bash
git add src/pages/now.astro
git commit -m "feat(now): SSR /now page with GitHub push event feed"
```

---

## Task 4: Push, deploy preview, and wire up the token

**Step 1: Push the branch**

```bash
git push -u origin claude/now-github-20260312
```

**Step 2: Open a PR**

```bash
gh pr create --title "feat(now): GitHub push event feed via scheduled function" --body "..."
```

**Step 3: Add `GITHUB_TOKEN` to Netlify**

- Go to Netlify dashboard → projectinsomnia → Site configuration → Environment variables
- Add `GITHUB_TOKEN` with a fine-grained PAT scoped to: **public repositories, read-only** for the `smartwatermelon` account
- Redeploy (or wait for PR deploy preview to pick it up)

**Step 4: Trigger the function manually (first run)**

In Netlify dashboard → Functions → `poll-github` → trigger manually (or wait up to an hour for the schedule).

**Step 5: Verify `/now` on the deploy preview**

- Events list appears with push activity
- Window label shows correct tier
- "Updated X minutes ago" footer present
- Repo links open correctly

**Step 6: Configure error notifications**

In Netlify dashboard → Site → Notifications → Email → Add notification → "Function error" → your email.

---

## Notes

- **No unit tests:** This feature is pure integration — Netlify Blobs, Netlify Functions runtime, GitHub API. TypeScript compilation is the primary static quality gate; integration is verified on the Netlify deploy preview.
- **Local dev:** `/now` will always show "initializing" placeholder locally since no Blob exists. This is correct and expected.
- **Strava/Instagram:** When those are added, they'll follow the same pattern — new function + new section in `now.astro`. The `now-feeds` Blob store name is shared; they'll use different keys (`strava-activity`, `instagram-posts`).
