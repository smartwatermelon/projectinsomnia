import type { Config } from "@netlify/functions";
import Parser from "rss-parser";

const GITHUB_USERNAME = "smartwatermelon";
const MAX_ITEMS = 10;

export default async function handler(): Promise<Response> {
  const parser = new Parser();

  try {
    const feed = await parser.parseURL(
      `https://github.com/${GITHUB_USERNAME}.atom`
    );

    const items = (feed.items ?? [])
      .filter((item) => !item.title?.startsWith(`${GITHUB_USERNAME} deleted`))
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        title: (item.title ?? "").replace(`${GITHUB_USERNAME} `, ""),
        link: item.link ?? "",
        published: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
      }));

    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    console.error(
      `github-feed: fetch failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return Response.json({ items: [] }, { status: 502 });
  }
}

export const config: Config = {
  path: "/api/github-feed",
};
