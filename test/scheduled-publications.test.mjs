import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

let scheduledPublications = {};
try {
  scheduledPublications = await import("../scripts/scheduled-publications.mjs");
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

test("records only non-draft publications that are still future-dated at build time", () => {
  const publications = scheduledPublications.pendingPublications?.(
    [
      { date: "2026-11-06", draft: false },
      { date: "2026-11-06", draft: true },
      { date: "2026-11-05", draft: false },
      { date: "2026-10-01", draft: false },
    ],
    new Date("2026-11-05T12:00:00.000Z"),
  );

  assert.deepEqual(publications, ["2026-11-06T00:00:00.000Z"]);
});

test("recognizes a pending publication only once its date has arrived", () => {
  const hasDuePublication = scheduledPublications.hasDuePublication;

  assert.equal(
    hasDuePublication?.(["2026-11-06T00:00:00.000Z"], new Date("2026-11-05T13:00:00.000Z")),
    false,
  );
  assert.equal(
    hasDuePublication?.(["2026-11-06T00:00:00.000Z"], new Date("2026-11-06T13:00:00.000Z")),
    true,
  );
});

test("writes a manifest from the current content tree", async () => {
  const root = await mkdtemp(join(tmpdir(), "scheduled-publications-"));
  const contentDirectory = join(root, "content");
  const outputFile = join(root, "scheduled-publications.json");

  try {
    await mkdir(join(contentDirectory, "blog"), { recursive: true });
    await Promise.all([
      writeFile(
        join(contentDirectory, "blog", "future.md"),
        "---\ntitle: Future\ndate: 2026-11-06\ndraft: false\n---\n",
      ),
      writeFile(
        join(contentDirectory, "blog", "draft.md"),
        "---\ntitle: Draft\ndate: 2026-11-06\ndraft: true\n---\n",
      ),
      writeFile(
        join(contentDirectory, "blog", "published.md"),
        "---\ntitle: Published\ndate: 2026-11-05\n---\n",
      ),
    ]);

    await scheduledPublications.generateScheduledPublications?.({
      contentDirectory,
      outputFile,
      buildTime: new Date("2026-11-05T12:00:00.000Z"),
    });

    let manifest;
    try {
      manifest = JSON.parse(await readFile(outputFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    assert.deepEqual(manifest, ["2026-11-06T00:00:00.000Z"]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
