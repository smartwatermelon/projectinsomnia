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
    `https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=100`,
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
