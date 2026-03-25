import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const BLOB_STORE = "now-feeds";
const BLOB_KEY = "instagram-posts";
const MAX_POSTS = 27;

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

/** Extract shortcode from an Instagram post URL.
 *  Handles both classic and username-prefixed formats:
 *    https://www.instagram.com/p/ABC123/
 *    https://www.instagram.com/username/p/ABC123/
 */
function extractShortcode(postUrl: string): string | null {
  const match = postUrl.match(
    /instagram\.com\/(?:[\w.]+\/)?(?:p|reel)\/([A-Za-z0-9_-]+)/
  );
  return match?.[1] ?? null;
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

  const shortcode = extractShortcode(post.postUrl);
  if (!shortcode) {
    console.error(
      `instagram-webhook: could not extract shortcode from postUrl: ${post.postUrl}`
    );
    return new Response("Could not extract shortcode from postUrl", {
      status: 400,
    });
  }

  try {
    const store = getStore(BLOB_STORE);

    // Download the image from Instagram CDN before the URL expires
    const imgResponse = await fetch(post.imageUrl);
    if (!imgResponse.ok) {
      console.error(
        `instagram-webhook: image fetch failed: ${imgResponse.status} ${imgResponse.statusText}`
      );
      return new Response("Failed to fetch image", { status: 502 });
    }

    const imgBytes = await imgResponse.arrayBuffer();
    const contentType =
      imgResponse.headers.get("content-type") ?? "image/jpeg";

    // Store the image bytes in a separate blob key
    await store.set(`instagram-img/${shortcode}`, imgBytes, {
      metadata: { contentType },
    });

    // Replace the expiring CDN URL with our permanent serving URL
    const cachedPost: InstagramPost = {
      ...post,
      imageUrl: `/api/instagram-image/${shortcode}`,
    };

    const existing = (await store.get(BLOB_KEY, {
      type: "json",
    })) as InstagramData | null;

    const allPosts = [cachedPost, ...(existing?.posts ?? [])];
    const posts = allPosts.slice(0, MAX_POSTS);
    const evicted = allPosts.slice(MAX_POSTS);

    await store.setJSON(BLOB_KEY, {
      lastUpdated: new Date().toISOString(),
      posts,
    } satisfies InstagramData);

    // Delete cached image blobs for evicted posts
    for (const old of evicted) {
      const oldCode = old.imageUrl.match(/\/api\/instagram-image\/(.+)/)?.[1];
      if (oldCode) {
        await store.delete(`instagram-img/${oldCode}`).catch(() => {});
      }
    }

    console.log(
      `instagram-webhook: stored post ${post.postUrl} with cached image (${posts.length} total, ${evicted.length} evicted)`
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
