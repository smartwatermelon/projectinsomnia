import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function publicationDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

export function pendingPublications(publications, buildTime) {
  return publications
    .filter(({ date, draft }) => {
      const publicationDateValue = publicationDate(date);
      return draft !== true && publicationDateValue && publicationDateValue > buildTime;
    })
    .map(({ date }) => publicationDate(date).toISOString())
    .sort();
}

export function hasDuePublication(publicationDates, now) {
  return publicationDates.some((date) => new Date(date) <= now);
}

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^(date|draft):\s*(.*?)\s*$/);
    if (!field) continue;
    fields[field[1]] = field[2].replace(/^['"]|['"]$/g, "");
  }
  return { date: fields.date, draft: fields.draft === "true" };
}

async function contentFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return contentFiles(path);
      return [".md", ".mdx"].includes(extname(entry.name)) ? [path] : [];
    }),
  );
  return files.flat();
}

export async function generateScheduledPublications({
  contentDirectory,
  outputFile,
  buildTime = new Date(),
}) {
  const publications = await Promise.all(
    (await contentFiles(contentDirectory)).map(async (file) =>
      frontmatter(await readFile(file, "utf8")),
    ),
  );
  const pending = pendingPublications(publications, buildTime);

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(pending, null, 2)}\n`);
  return pending;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateScheduledPublications({
    contentDirectory: resolve("src/content"),
    outputFile: resolve("netlify/functions/scheduled-publications.json"),
  });
}
