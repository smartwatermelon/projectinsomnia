import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const BLOB_STORE = "now-feeds";
const BLOB_KEY = "instagram-posts";

export default async function handler(): Promise<Response> {
  try {
    const store = getStore(BLOB_STORE);
    const data = await store.get(BLOB_KEY, { type: "json" });

    return Response.json(
      { posts: (data as { posts: unknown[] } | null)?.posts ?? [] },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error(
      `instagram-feed: blob read failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return Response.json({ posts: [] }, { status: 502 });
  }
}

export const config: Config = {
  path: "/api/instagram-feed",
};
