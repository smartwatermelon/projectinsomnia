# Project Insomnia — Spec & Status

**For**: Claude Code (CLI) handoff  
**Last updated**: March 13, 2026  
**Live preview**: <https://projectinsomnia.netlify.app/>  
**Repo**: <https://github.com/smartwatermelon/projectinsomnia> (private)  
**Local path**: ~/Developer/netlify/projectinsomnia

---

## What This Is

A personal site for Andrew Rich at `projectinsomnia.com` — a domain with continuous
history since 1997, currently parked at an about.me landing page. This Astro-based
rebuild consolidates a Medium blog archive with new original content and will become
the canonical "about me" presence: for potential employers, collaborators, and anyone
who finds a post via search.

**Night Owl Studio connection**: Andrew runs Night Owl Studio LLC
(nightowlstudio.us), a solo app development business. This site promotes
that work and will serve as a proof-of-concept for Yesteryear, an upcoming
app.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Astro 5 (static output) |
| Content | Markdown collections in `src/content/` |
| Styling | Plain CSS in `src/styles/global.css` |
| Code highlighting | astro-expressive-code |
| RSS | @astrojs/rss |
| Sitemap | @astrojs/sitemap |
| Hosting | Netlify (auto-deploy from `main` branch) |
| DNS (target) | Name.com → Netlify (cutover not yet done) |

---

## Current State (what's done)

### Content collections

Three collections defined in `src/content.config.ts`, all using the same schema:

```ts
{
  title: string,
  date: date,
  description?: string,
  tags: string[],
  mediumUrl?: string,   // attribution link back to original Medium post
  draft: boolean        // default false
}
```

**`src/content/blog/`** — 17 posts, main writing feed. Tech how-tos, live music
recaps, satire, trivia, personal essays. Dates range 2014–2026.

**`src/content/ouatrevisit/`** — 36 posts. Once Upon a Time TV recaps (S4–S7).
Intentionally separated from main feed; not shown on homepage or in RSS.

**`src/content/elections/`** — 5 posts. Ballot writeups and election night posts
(2014–2020). Also separated from main feed.

All content was migrated from a Medium export (`@smartwatermelon`). Images reference
Medium's CDN directly (`cdn-images-1.medium.com`) — this works in browsers but is
fragile long-term (see backlog).

### File naming convention

Files are named `YYYY-MM-DD-slug.md`. Slug extraction strips the date prefix and
`.md` extension — utility in `src/lib/slugFromId.ts`:

```ts
// Pattern: /^\d{4}-\d{2}-\d{2}-/.replace().replace(/\.mdx?$/)
// "2025-01-23-my-post.md" → "my-post"
```

This utility is used in all dynamic route files — do not change the naming convention
without updating all `[slug].astro` routes.

### Pages

```text
src/pages/
  index.astro              — homepage, recent posts from blog collection only
  rss.xml.js               — RSS feed, blog collection only
  blog/
    index.astro            — blog listing with section nav (All / OUaT / Elections)
    [...slug].astro        — dynamic blog post routes
    ouatrevisit/
      index.astro
      [...slug].astro
    elections/
      index.astro
      [...slug].astro
  about.astro              — DONE: real bio, links, contact
  projects.astro           — DONE: two-column layout (see below)
  now.astro                — DONE: lazy-loaded live feeds (see below)
```

### Layouts

`src/layouts/BaseLayout.astro` — global HTML shell, nav, footer. Imports
`src/styles/global.css`. Nav links: Blog · Now · Projects · About.

`src/layouts/PostLayout.astro` — post header (title, date, tags, Medium
attribution link). Scoped styles for post chrome only.

### Styles

`src/styles/global.css` — all visual styling. Well-commented sections:
Variables → Reset → Base → Layout → Typography → Components.

**The dark theme is temporary.** A redesign to a light theme is planned.
CSS custom properties at the top of the file are the primary design surface:

```css
:root {
  --color-bg: #0f0f0f;
  --color-surface: #1a1a1a;
  --color-border: #2a2a2a;
  --color-text: #e0e0e0;
  --color-muted: #888;
  --color-accent: #7c6af7;
  --color-accent-hover: #9d8fff;
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', 'Cascadia Code', monospace;
  --measure: 68ch;
}
```

### RSS

Live at `/rss.xml`. Covers `blog` collection only (ouatrevisit and elections
excluded). Autodiscovery `<link>` tag present in BaseLayout head.

### About page

Complete. Includes: bio, He/Him, Spokane WA, links to GitHub (`smartwatermelon`),
Strava, Instagram, LinkedIn, Medium (archived). Night Owl Studio mention. Two
contact addresses. "Some things are worth keeping" note on domain history.

### Projects page

Complete. Two-column layout: left = Night Owl Studio products + client work;
right = grouped open source repos.

**Left column — Night Owl Studio:** Kebab (iOS & Android, launched Dec 2025),
Yesteryear (coming soon), Crazy Larry's Used Spaceships, freelance CTA.

**Left column — Client work:** T&J Cleaning (tnjcleaning.com), Amelia Boone
(commented out pending client announcement — search for the comment to re-enable),
freelance CTA.

**Right column — GitHub repos, grouped:**

- AI & Claude Code: claude-wrapper, claude-config, agents, headroom,
  smartwatermelon-marketplace
- macOS & Infrastructure: mac-server-setup, swift-progress-indicator,
  archive-resolver, transmission-filebot, homebrew-tap
- Utilities & Miscellany: github-workflows, pre-commit-testing, anniversary
- Interview Projects (own section, with explanatory note): sailpoint-sre,
  beam-sre-kata

Column collapses to single on mobile (projects above repos).
Repo names rendered in `var(--font-mono)` for visual distinction.

### /now page

Complete. Three sections: GitHub (contribution graph + activity), Strava,
Instagram. All feeds are lazy-loaded client-side so third-party resources
don't block page render. Rolling ~24hr window; extends automatically during
slow periods. Links to full profiles for each service.

---

## Immediate Next Tasks

All major pages are complete and live. Remaining work in priority order:

### 1. Design — light theme redesign

Active in a separate Claude.ai thread with Jen Rich (design consultant).
Do not make visual changes without checking with Andrew first.
All styling lives in `src/styles/global.css`. CSS variables at the top
are the primary surface. The current dark theme is a placeholder only.

### 2. DNS cutover

Point `projectinsomnia.com` at Netlify. Prerequisites are now met
(all pages have real content). Steps:

1. Add custom domain in Netlify site settings
2. Update A records at Name.com to Netlify's IPs
3. Verify split-DNS — for nightowlstudio.us, MX records were needed in
   BOTH Name.com and Netlify DNS. Expect the same here.
4. Confirm SSL provisioned and all pages load at projectinsomnia.com
5. Cancel about.me subscription
6. Edit Medium posts with "moved to" notices (see backlog)

### 3. /then page

See BACKLOG.md for full spec. Build after DNS cutover.

### 4. Amelia Boone project entry

Commented out in `projects.astro`. Uncomment when client is ready to announce.
Search for: `Amelia Boone — uncomment when client is ready to announce`

---

## Backlog (not immediate, not forgotten)

Full details in `BACKLOG.md` in the repo root. Summary:

**`/then` page — "on this day"**: Query blog collection for posts where
month+day matches today. Display as retrospective. Filter out ouatrevisit
and elections. This is intentionally connected to the Yesteryear app concept —
keep the data model source-agnostic so the same logic can power both.

**Image localization**: Medium CDN images work now but are fragile. True fix
requires downloading via a logged-in browser session (Cloudflare blocks
headless scripts). Defer until after DNS cutover.

**Post improvements**: Reading time in post header, prev/next navigation,
better image captions/lightbox.

**Additional RSS feeds**: /blog/ouatrevisit/rss.xml when there's demand.

**DNS cutover**: projectinsomnia.com → Netlify. Not yet done. Andrew's
Name.com setup has a split-DNS configuration (records needed in both Name.com
AND Netlify DNS — this was the case for nightowlstudio.us too). After cutover:
edit Medium posts with "moved to projectinsomnia.com" notices, cancel about.me
subscription.

**Photos section**: Back burner. Google Photos API is effectively closed.
Options: static files in repo, object storage (R2/B2), or punt and let
Instagram on /now cover it.

---

## Design Notes

The current dark theme (`#0f0f0f` background, `#7c6af7` purple accent) is a
functional placeholder, not a design decision. A light theme redesign is planned.
Andrew is leading the design direction; Jen Rich (designer) will provide feedback.

Direction is still being defined. When working on design, ask Andrew for:

- Reference sites (personal sites, not brands) that approximate the target feel
- A few adjectives describing the desired tone
- Whether the accent color / typographic style should carry over or start fresh

Do not invest significant effort in the dark theme. The CSS variables in
`global.css` are the right lever; structural HTML in the layouts is stable.

---

## Key Decisions & Conventions

- **Content and markup are fully separated.** Never put styling in content files.
  Page templates are thin; all styles live in `global.css` or scoped in layouts.
- **Slug convention**: date-prefixed filename, strip prefix at route time via
  `slugFromId()`. Do not change without updating all dynamic routes.
- **Collections ouatrevisit and elections are intentionally siloed.** They do
  not appear on the homepage, in the main blog feed, in RSS, or (eventually)
  on the /then page. They have their own index and post pages under `/blog/`.
- **No client-side JavaScript unless explicitly needed.** Astro's default is
  zero JS. Keep it that way for content pages. The /now page will be the first
  exception if it needs any interactivity.
- **Privacy-first**: No analytics, no tracking, no ad networks. This is a
  personal site, not a product.

---

## Environment & Credentials

Netlify project name: `projectinsomnia`  
Netlify auto-deploys on push to `main`.  
No environment variables currently set.

Andrew manages credentials via 1Password. When API keys are needed, ask him
to add them as Netlify environment variables rather than putting them anywhere
in the repo.

## Docs Location

This file and BACKLOG.md live in `docs/` and are committed to the repo.
Update both at the end of significant work sessions.
