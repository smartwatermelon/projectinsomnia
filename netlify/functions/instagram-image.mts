import type { Config } from "@netlify/functions";
import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const BLOB_STORE = "now-feeds";

export default async function handler(
  _req: Request,
  context: Context
): Promise<Response> {
  const { id } = context.params;

  if (!id) {
    return new Response("Missing image ID", { status: 400 });
  }

  try {
    const store = getStore(BLOB_STORE);
    const { data, metadata } = await store.getWithMetadata(
      `instagram-img/${id}`,
      { type: "arrayBuffer" }
    );

    if (!data) {
      return new Response("Image not found", { status: 404 });
    }

    return new Response(data, {
      headers: {
        "Content-Type": (metadata?.contentType as string) ?? "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error(
      `instagram-image: blob read failed for ${id}: ${e instanceof Error ? e.message : String(e)}`
    );
    return new Response("Image not found", { status: 404 });
  }
}

export const config: Config = {
  path: "/api/instagram-image/:id",
};
