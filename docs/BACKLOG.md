# Project Insomnia — Backlog

A living document. Items are roughly grouped by theme, not strictly prioritized.

---

## Content & Pages

### About page ✓ DONE

Bio, links, contact, "Some things are worth keeping" footer note.

### Projects page ✓ DONE

Two-column layout. Night Owl Studio + client work on left; grouped GitHub
repos on right. T&J Cleaning live. Amelia Boone commented out pending
announcement. Interview projects in their own section with explanatory note.

### Photos section

Back burner. Google Photos API is effectively closed; options are:

- Static images committed to repo (fine for small quantities)
- Object storage (Cloudflare R2, Backblaze B2) with a custom gallery component
- Punt indefinitely and let Instagram on /now cover it

Decide structure first: chronological stream, albums, or both?

---

## Features

### /now page ✓ DONE

Lazy-loaded client-side feeds: GitHub (contribution graph + activity),
Strava, Instagram. Rolling ~24hr window with slow-period extension.
Implemented without Netlify scheduled functions — loads directly in browser.

### /then page — "on this day"

Query the blog collection for posts where month + day matches today's date.
Display them as a "on this day in [year]" retrospective.

Notes:

- Filter out ouatrevisit and elections collections — too noisy
- Thin right now, gets richer every year you keep writing
- Future data sources: photos with EXIF dates, Strava history
- If nothing matches today, show the nearest past date with content

### RSS — additional feeds

Currently one feed at /rss.xml covering the main blog collection.
Candidates for additional feeds when there's demand:

- /blog/ouatrevisit/rss.xml
- /blog/elections/rss.xml

---

## Yesteryear Integration

### /then as Yesteryear proof of concept

The /then page and the Yesteryear app should share the same underlying
data model and logic — not diverge into two separate implementations.

Being intentional about this now means:

- /then becomes a live demo of the Yesteryear concept in a browser
- If Yesteryear ever supports web, projectinsomnia.com/then is the scaffold
- Data sources added to /then (posts, photos, Strava) feed Yesteryear too

Keep the data model clean and source-agnostic from the start.

---

## Design

### Light theme redesign

Current dark theme was a starting point, not a design decision.
Moving to a light theme; specifics TBD.
Jen will provide feedback; Andrew leading direction.

Key file: `src/styles/global.css` — CSS variables at the top are the
primary design surface. Structural changes in BaseLayout.astro and
PostLayout.astro.

### Reference / direction

To be filled in when direction is clearer. Some adjectives or reference
sites would help Jen have a starting point.

---

## Technical

### Image localization

Medium CDN images currently load from cdn-images-1.medium.com.
This works in browsers (Cloudflare only blocks headless scripts) but is
fragile long-term — if Medium changes CDN policy, images break sitewide.

True fix: download images using a logged-in Chrome session to bypass
Cloudflare, commit to repo or upload to object storage, rewrite Markdown
paths.

Defer until after DNS cutover; not blocking launch.

### Post improvements

- Reading time estimate in post header
- Previous / next post navigation
- Better image handling (captions, lightbox)

### DNS cutover

Point projectinsomnia.com at Netlify.
Prerequisites met — all pages have real content, site is ready.
Steps: add custom domain in Netlify, update A records at Name.com,
verify split-DNS (MX records needed in BOTH Name.com and Netlify —
confirmed pattern from nightowlstudio.us setup), cancel about.me subscription.

### Medium post updates

After DNS cutover: edit each Medium post to add a "this post has moved
to projectinsomnia.com" notice with a direct link.

---

## Writing Ideas (not tracked here)

See a separate notes file or your preferred writing tool.
Topics mentioned: indie software development, Spokane as a California
transplant, photos, Night Owl Studio work.
