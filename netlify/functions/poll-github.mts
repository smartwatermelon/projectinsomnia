import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Parser from "rss-parser";

const GITHUB_USERNAME = "smartwatermelon";
const ATOM_URL = `https://github.com/${GITHUB_USERNAME}.atom`;
const BLOB_STORE = "now-feeds";
const BLOB_KEY = "github-activity";
const MAX_ITEMS = 10;

export interface ActivityItem {
  title: string;
  link: string;
  published: string;
}

export interface GitHubActivity {
  lastFetched: string;
  items: ActivityItem[];
}

export default async function handler(): Promise<void> {
  const parser = new Parser();

  let feed;
  try {
    feed = await parser.parseURL(ATOM_URL);
  } catch (e) {
    console.error(
      `poll-github: failed to fetch Atom feed: ${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  const items: ActivityItem[] = (feed.items ?? [])
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      title: (item.title ?? "").replace(`${GITHUB_USERNAME} `, ""),
      link: item.link ?? "",
      published: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    }));

  const store = getStore(BLOB_STORE);
  await store.setJSON(BLOB_KEY, {
    lastFetched: new Date().toISOString(),
    items,
  } satisfies GitHubActivity);

  console.log(
    `poll-github: stored ${items.length} activity items at ${new Date().toISOString()}`
  );
}

export const config: Config = {
  schedule: "@hourly",
};
