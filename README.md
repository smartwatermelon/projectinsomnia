# Project Insomnia

Personal site for [Andrew Rich](https://projectinsomnia.com) — writing, projects, and a live /now page.

Built with [Astro 5](https://astro.build), hosted on [Netlify](https://netlify.com).

## Stack

- **Astro 5** — static output with selective SSR for the /now page
- **@astrojs/netlify** — adapter for Netlify on-demand functions
- **@netlify/blobs** — blob store for /now page feed data
- **MDX** — blog posts
- **astro-expressive-code** — syntax highlighting (Dracula theme)

## Pages

| Route | Description |
| :---- | :---------- |
| `/` | Homepage with recent posts |
| `/blog/` | Full post archive |
| `/now/` | Live feed: GitHub activity, Strava, Instagram |
| `/projects/` | Apps, client work, and open source repos |
| `/about/` | About page |

## /now page feeds

The /now page lazy-loads three live feeds via Netlify on-demand functions:

| Feed | Function | Source |
| :--- | :------- | :----- |
| GitHub | `/api/github-feed` | Public Atom feed |
| Strava | `/api/strava-feed` | Strava API v3 (OAuth 2.0) |
| Instagram | `/api/instagram-feed` | IFTTT webhook → Netlify Blobs |

Instagram posts are pushed via IFTTT Maker Webhooks to `/api/instagram-webhook` and stored in Netlify Blobs.

## Environment variables

Set in Netlify dashboard (not committed):

| Variable | Used by |
| :------- | :------ |
| `STRAVA_CLIENT_ID` | strava-feed function |
| `STRAVA_CLIENT_SECRET` | strava-feed function |
| `STRAVA_REFRESH_TOKEN` | strava-feed function |
| `INSTAGRAM_WEBHOOK_SECRET` | instagram-webhook function |
| `BUILD_HOOK_URL` | scheduled-rebuild function |

## Blog Publishing

Posts use two frontmatter fields to control visibility:

- **`draft: true`** — never published, regardless of date
- **`date`** — the publish date; future-dated posts are hidden until that date arrives

### Publish modes

| Mode | How | When it goes live |
| :--- | :-- | :---------------- |
| Scheduled | Set `date` to a future date, `draft: false`, merge to main | Automatically at ~6am PT on/after that date |
| Immediate | Set `date` to today, merge, then trigger the build hook | Minutes after triggering |
| Draft | Set `draft: true` | Never (until you remove the flag) |

### Manual publish trigger

```sh
curl -sX POST "$BUILD_HOOK_URL"
```

The build hook URL is stored as `BUILD_HOOK_URL` in Netlify environment variables. A Netlify Scheduled Function triggers a rebuild daily at ~6am PT (1pm UTC) to sweep up any posts whose date has arrived.

## Development

```sh
npm install
npm run dev       # localhost:4321
npm run build     # production build to ./dist/
npm run preview   # preview production build locally
```

Deploys automatically from `main` via Netlify.
