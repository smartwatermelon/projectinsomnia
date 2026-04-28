/** Collection-level tags excluded from display and the tag cloud. */
export const metaTags = ["blog", "ouatrevisit", "elections", "pinned"] as const;

/** The tag literal that flags a post as pinned to the top of post lists. */
export const PINNED_TAG = "pinned";

/** Returns true if the given tag is a collection-level meta tag. */
export function isMetaTag(t: string): boolean {
  return (metaTags as readonly string[]).includes(t);
}

/** Returns true if the post is pinned (carries the `pinned` tag). */
export function isPinned(post: { data: { tags?: string[] } }): boolean {
  return (post.data.tags ?? []).includes(PINNED_TAG);
}
