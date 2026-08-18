/**
 * Strip the date prefix from a content collection entry ID to build the route slug.
 * e.g. "2026-01-24-baumgartner-must-go" → "baumgartner-must-go"
 *
 * The extension strip is retained for safety: Astro's glob loader yields IDs
 * without a file extension, but older callers may still pass a filename.
 */
export function slugFromId(id: string): string {
  return id.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.mdx?$/, "");
}
