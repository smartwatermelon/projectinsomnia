/** Collection-level tags excluded from display and the tag cloud. */
export const metaTags = ["blog", "ouatrevisit", "elections"] as const;

/** Returns true if the given tag is a collection-level meta tag. */
export function isMetaTag(t: string): boolean {
  return (metaTags as readonly string[]).includes(t);
}
