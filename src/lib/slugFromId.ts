/**
 * Strip the date prefix and file extension from an Astro 5 content collection ID.
 * e.g. "2026-01-24-baumgartner-must-go.md" → "baumgartner-must-go"
 */
export function slugFromId(id: string): string {
  return id.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.mdx?$/, "");
}
