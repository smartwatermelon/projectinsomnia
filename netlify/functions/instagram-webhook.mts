import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const BLOB_STORE = "now-feeds";
const BLOB_KEY = "instagram-posts";
const MAX_POSTS = 9;

interface InstagramPost {
  imageUrl: string;
  caption: string;
  postUrl: string;
  timestamp: string;
}

interface InstagramData {
  lastUpdated: string;
  posts: InstagramPost[];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!process.env.INSTAGRAM_WEBHOOK_SECRET) {
    console.error("instagram-webhook: INSTAGRAM_WEBHOOK_SECRET is not set");
    return new Response("Service misconfigured", { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const secret = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!secret || secret !== process.env.INSTAGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use IFTTT's <<<{{Ingredient}}>>> escaping in the body template to safely embed
  // values in JSON (handles quotes in captions, & in CDN URLs, etc.)
  let post: InstagramPost;
  try {
    post = (await req.json()) as InstagramPost;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!post.imageUrl || !post.postUrl) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Validate URLs are safe https: links before storing
  try {
    const imageUrl = new URL(post.imageUrl);
    const postUrl = new URL(post.postUrl);
    if (imageUrl.protocol !== "https:" || postUrl.protocol !== "https:") {
      return new Response("URLs must use https", { status: 400 });
    }
  } catch {
    return new Response("Invalid URLs", { status: 400 });
  }

  try {
    const store = getStore(BLOB_STORE);
    const existing = (await store.get(BLOB_KEY, {
      type: "json",
    })) as InstagramData | null;

    const posts = [post, ...(existing?.posts ?? [])].slice(0, MAX_POSTS);

    await store.setJSON(BLOB_KEY, {
      lastUpdated: new Date().toISOString(),
      posts,
    } satisfies InstagramData);

    console.log(
      `instagram-webhook: stored post ${post.postUrl} (${posts.length} total)`
    );
  } catch (e) {
    console.error(
      `instagram-webhook: blob store error: ${e instanceof Error ? e.message : String(e)}`
    );
    return new Response("Storage error", { status: 503 });
  }

  return new Response("OK", { status: 200 });
}

export const config: Config = {
  path: "/api/instagram-webhook",
};
