# Dependency audit triage

Tracking the `npm audit` state and the reasoning behind what is fixed versus
accepted. Issue #123 asked for the residual risk to be a documented conclusion
rather than an assumption, so this file records that.

Last reviewed: 2026-10-06

## Current state

`npm audit` reports **12 advisories** (all high): two roots with no patched
release, `braces` and `node-forge`, plus ten chain entries flagged only for
depending on them. Both roots are accepted until **2026-11-05**; see
"Re-triaged 2026-10-05" below. Three new roots that appeared on 2026-10-06
(`postcss-selector-parser`, `sharp`, `source-map-js`) are fixed, not
accepted; see "Re-triaged 2026-10-06". Earlier clears: `sharp` on
2026-09-10 and `toml` on 2026-09-05 (`overrides`), `image-size` and
`extract-zip` on 2026-09-02 (the `@netlify/vite-plugin` override).

## What was fixed

| Package | Action | Result |
| --- | --- | --- |
| `@netlify/blobs` | bumped `^10.7.2` → `^11.0.1` | direct fix; cleared |
| `sharp` | `overrides` → `^0.35.5` | libheif advisory required `>=0.35.4`, librsvg advisory `>=0.35.5`; cleared |
| `postcss-nested` | `overrides` → `^7.0.2` | pulls `postcss-selector-parser` 7.1.6 (quadratic parsing); cleared |
| `picomatch` | `overrides` → `^4.0.5` | ReDoS + method injection; cleared |
| `nanoid` | `overrides` → `^5.1.6` | zero-size infinite loop; cleared |
| `fast-uri` | `overrides` → `^3.1.6` | 4 SSRF/host-confusion; cleared |
| `ipx` | — | cleared transitively by the `sharp` override |
| `@netlify/vite-plugin` | `overrides` → `^3.0.1` | cleared both roots + chain |

`@netlify/blobs` 10 → 11 is a major bump. The three call sites
(`netlify/functions/instagram-{feed,image,webhook}.mts`) use `getStore`,
`.get()`, `.set()`, and `.setJSON()`; all are present in v11 with compatible
signatures, and the functions type-check clean against the v11 declarations.

## Re-triaged 2026-09-10 — the `sharp` libheif advisory

`sharp` appeared on 2026-09-09 as a new advisory outside the accepted
baseline (empty), and `scripts/check-audit-baseline.sh` failed the build as
designed. `build` was red on `main` from 2026-09-09 until this fix.

| Advisory | Issue | Fixed in |
| --- | --- | --- |
| [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | libheif vulnerabilities (GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545) | `>=0.35.4` |

`npm audit` reported six advisories, but they are one root and five
chain-only entries flagged solely for depending on it:

```text
@astrojs/netlify → @netlify/vite-plugin → @netlify/dev
  → @netlify/images → ipx → sharp
```

The prior override pinned `^0.35.3`, which cleared the earlier advisory
requiring `>=0.35.0`. The caret would have permitted 0.35.4, but the
lockfile stayed resolved at 0.35.3, so the floor was raised to `^0.35.4`
and the lockfile regenerated.

**`npm audit fix --force` is the wrong tool here**, and proposes the same
downgrade #123 documents: `@astrojs/netlify` 8.2.4 → 6.4.1, a semver-major
rollback that reintroduces the Astro 5 content-collection API and re-breaks
the site the way #120 fixed. It is also unnecessary, since a real patch
exists one patch version up. Verified after this change that
`@astrojs/netlify` remains at 8.2.4.

Verified: `scripts/check-audit-baseline.sh` → passed, `npm audit` → 0
vulnerabilities, `npm run build` → succeeds.

## Re-triaged 2026-10-05 — `braces`, `node-forge`, `http-cache-semantics`

`build` was red on `main` from 2026-10-02: advisories published 2026-09-03
onward landed outside the empty baseline. A fresh `npm ci` on `main` on
2026-10-05 reports 14 (four roots, ten chain entries); this change brings it
to 12.

| Advisory | Package | Severity | Resolution |
| --- | --- | --- | --- |
| [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) | `http-cache-semantics` | high | fixed: lockfile 4.2.0 → 4.3.0 |
| [GHSA-xjh9-v7x6-24jw](https://github.com/advisories/GHSA-xjh9-v7x6-24jw), [GHSA-x8mw-p69m-v3mx](https://github.com/advisories/GHSA-x8mw-p69m-v3mx) | `@fastify/busboy` | high | fixed: lockfile 3.2.0 → 3.2.2 |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces` | high | accepted, review by 2026-11-05 |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge` | high | accepted, review by 2026-11-05 |

The two fixes were targeted in-range updates
(`npm update @fastify/busboy http-cache-semantics --package-lock-only`).
`npm audit fix` was not used as-is: it also refreshed about thirty unrelated
Netlify packages.

**Why `braces` and `node-forge` are accepted.** Both have no patched release:
the GitHub Advisory API reports `first_patched_version: null`, and the newest
published versions (`braces@3.0.3`, `node-forge@1.4.0`) are the affected ones.
The only fix npm offers is the `@astrojs/netlify@6.4.1` downgrade rejected
below.

Paths, both build-time tooling:

```text
@astrojs/netlify → @netlify/vite-plugin → @netlify/dev
  → @netlify/functions-dev → @netlify/zip-it-and-ship-it
  → fast-glob → micromatch → braces
@astrojs/netlify → @netlify/vite-plugin → @netlify/dev
  → @netlify/images → ipx → listhen → node-forge
```

Not reachable from deployed code. Verified 2026-10-05 after `npm run build`:
the SSR function's `node_modules` holds only `@netlify/blobs`, `@netlify/otel`
and a few small libraries; no word-boundary match for `braces`, `node-forge`,
`micromatch`, `fast-glob` or `listhen` in `dist/` or `.netlify/` code, and no
import of `ipx` or `@netlify/images`. `braces` expands globs in the bundler
(repo-controlled patterns); `node-forge` serves the `ipx` dev server's TLS.

Revisit by 2026-11-05, or sooner when `braces` or `node-forge` publishes a
fix (the check reports it) or netlify/framework-adapters#47 lands.

## Re-triaged 2026-10-06 — `postcss-selector-parser`, `sharp`, `source-map-js`

`build` was red on `main` from 2026-10-06 15:15Z: `npm audit` reported 23
advisories, 11 of them outside the baseline. Those 11 are three roots and
eight chain entries. All three roots have a patched release, so all three
are fixed and nothing new is accepted. `npm audit` is back to the 12
accepted entries above.

| Advisory | Package | Severity | Resolution |
| --- | --- | --- | --- |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | `postcss-selector-parser` | moderate | fixed: `overrides` `postcss-nested` → `^7.0.2`, which pulls 6.1.4 → 7.1.6 |
| [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | `sharp` | high | fixed: lockfile 0.35.4 → 0.35.5, override floor raised to `^0.35.5` |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `source-map-js` | high | fixed: lockfile 1.2.1 → 1.2.2 |

The eight chain entries (`postcss-nested`, `@expressive-code/core`,
`@expressive-code/plugin-frames`, `@expressive-code/plugin-shiki`,
`@expressive-code/plugin-text-markers`, `expressive-code`,
`rehype-expressive-code`, `astro-expressive-code`) were flagged only for
depending on `postcss-selector-parser`, and cleared with it:

```text
astro-expressive-code → rehype-expressive-code → expressive-code
  → @expressive-code/core → postcss-nested → postcss-selector-parser
```

`sharp` and `source-map-js` were in-range updates
(`npm update sharp source-map-js --package-lock-only`). The lockfile diff
touches only those two and sharp's `@img/*` platform binaries. The `sharp`
floor goes to `^0.35.5` for the same reason as on 2026-09-10: the caret
already allowed the fix, so the floor keeps a fresh resolve from going back.
This is the librsvg advisory (CVE-2026-96889), a different one from the
libheif advisory above.

**Why `postcss-nested` needs an override.** `@expressive-code/core@0.44.2`
(the latest) depends on `postcss-nested@^6.0.1`, and `postcss-nested@6.2.0`
(the last 6.x) pins `postcss-selector-parser@^6.1.1`. No 6.x parser has
the fix, so no in-range update exists. Per its changelog,
`postcss-nested@7.0.0` moves the parser range to `^7.0.0`, drops Node 12 to
16 (the repo runs Node 24), and changes when comments are moved out of
nested rules; 7.0.1 and 7.0.2 are fixes. The override is on
`postcss-nested`, not on the parser, so every package still gets a parser
inside its own declared range. 7.0.2 rather than 8.x because 8 also moves
the package to ESM and drops Node 18 and 20. Verified after
`npm run build`: 26 pages under `dist/` render `class="expressive-code`
blocks, and the emitted CSS has flattened `.expressive-code …` selectors,
so the plugin still nests correctly.

`npm audit fix --force` was not used. It proposes the same rejected
downgrades as before: `astro-expressive-code` 0.44.2 → 0.34.2 and
`@astrojs/netlify` 8.2.6 → 6.4.1.

Verified: `scripts/check-audit-baseline.sh` → passed, `npm audit` → 12
(the accepted set), `npm run check` → 0 errors, `npm run build` →
succeeds, `scripts/verify-build-output.sh` → passed.

## The `toml` override

`toml` appeared on 2026-09-05 as a new advisory outside the accepted
baseline (empty), and `scripts/check-audit-baseline.sh` failed the build as
designed. Two advisories, both fixed by 4.3.0, the newest published release:

| Advisory | Issue | Fixed in |
| --- | --- | --- |
| [GHSA-82x6-q7mm-w9cf](https://github.com/advisories/GHSA-82x6-q7mm-w9cf) | Uncontrolled recursion | `>=4.2.0` |
| [GHSA-v5mp-jgw5-2x6j](https://github.com/advisories/GHSA-v5mp-jgw5-2x6j) | Prototype pollution via `__proto__` key-path desync | `>=4.1.2` |

The path is build-time only, like the accepted roots and the `fast-uri`
case below:

```text
@astrojs/netlify → @netlify/vite-plugin → @netlify/dev
  → @netlify/functions-dev → @netlify/zip-it-and-ship-it → toml
```

`zip-it-and-ship-it` has exactly one call site
(`dist/runtimes/rust/builder.js`), `toml.parse(manifest)`, reading a Rust
function's `Cargo.toml` while bundling. That top-level `.parse()` call is
`toml`'s stable entry point and is unchanged from 3.x to 4.x; nothing else
in the resolved tree imports the package.

An `overrides` entry (`"toml": "^4.1.2"`) rather than declaring `^4.3.0`
directly, matching the `fast-uri` convention below: pin the floor that
clears the advisories and let npm resolve forward. It resolved to 4.3.0 on
install, which clears both. Verified: `npm audit` → 0 vulnerabilities,
`npm run build` → succeeds, `npx tsc --noEmit` → exit 0.

## The `fast-uri` override

`fast-uri` appeared on 2026-09-02 as a new advisory outside the accepted
baseline, and `scripts/check-audit-baseline.sh` failed the build as designed.
It is not part of the accepted set: unlike `image-size` and `extract-zip`, a
patched release exists, so the correct response was to take it.

Four advisories, all fixed in 3.1.6:

| Advisory | Issue |
| --- | --- |
| [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | SSRF via malformed IPv6 normalization |
| [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | SSRF via repeated hostname percent-decoding |
| [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | Host confusion via percent-encoded scheme normalization |
| [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) | Host confusion via skipped IDN canonicalization |

The path is build-time only, like the accepted roots:

```text
@astrojs/netlify → @netlify/vite-plugin → @netlify/dev
  → @netlify/edge-functions-dev → @netlify/edge-bundler → ajv → fast-uri
```

An `overrides` entry rather than `npm update fast-uri`, for two reasons. The
override records the constraint in `package.json`, where the other three
already live, so a future `npm install` cannot quietly resolve back to 3.1.5.
And `npm update` pulled unrelated subtrees (`@netlify/blobs`,
`@netlify/dev-utils`) into the lockfile alongside the fix; the override moves
exactly one package.

No compatibility risk: `ajv@8.20.0` declares `fast-uri: ^3.0.1`, which 3.1.7
satisfies, so the override supplies a version the consumer already accepts.
This is unlike the `picomatch` case below, where the override deliberately
exceeds the declared range.

## What was NOT done, and why

**`npm audit fix --force` must not be run on this repo.** The fix npm proposes
for the bulk of these advisories is:

```text
@astrojs/netlify -> 6.4.1  (isSemVerMajor: true)
```

That is a **downgrade** from the 8.x line. It would reintroduce the Astro 5
content-collection API and re-break the site in exactly the way #120 fixed —
empty collections, no blog posts, a 274-byte RSS feed, and a build that still
exits 0. See #121 for why that failure is silent.

Upgrading `@astrojs/netlify` to the newest 8.x (8.2.3) was tested and does
**not** clear the remaining advisories.

## Override side effect: picomatch vs anymatch

The `picomatch` override to `^4.0.5` is applied tree-wide, so `anymatch@3.1.3`
receives it despite declaring `picomatch: ^2.0.4`. This is a deliberate,
accepted trade-off, not an oversight.

It is safe because `anymatch` uses only the top-level callable form,
`picomatch(matcher, options)`, whose signature is unchanged between v2 and v4.
Build and deploy both verified.

The residual risk is that this holds by convention rather than by contract —
nothing enforces it, and the override silently wins. Accepted because
`anymatch@3.1.3` is stable, the advisory is real, and the build CI would catch
a regression. Scoping the override to specific paths would restore the
declared range at the cost of a more complex `overrides` block; revisit only
if `anymatch` or `picomatch` move. See issue #126.

## Accepted residual risk (10 advisories) — RESOLVED 2026-09-02

> **Historical.** These 10 were cleared by the `@netlify/vite-plugin` override;
> nothing in this section is still accepted. It is kept because the exposure
> assessment records why the risk was tolerable while it stood, and because the
> "Astro vendors its own `image-size`" subsection below is **still live** — that
> copy is private to Astro and was never part of this baseline.

All 10 traced to two transitive packages with no fixed release published
upstream at the time — both reported an affected range of `*`, meaning every
existing version was affected:

- **`image-size`** — DoS via infinite loop in the ICNS parser
  ([GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr))
  and the JXL/HEIF parsers
  ([GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)).
  Reached via `@netlify/dev-utils`.
- **`extract-zip`** — unvalidated symlink path traversal
  ([GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)).
  Reached via `@netlify/functions-dev`.

One of the 10 is a nested `@netlify/blobs` at 10.7.12, pulled in privately by
`@netlify/dev` and `@netlify/functions-dev`. The repo's own direct dependency
is on 11.0.1 and is not affected. Adding `@netlify/blobs` to `overrides` was
tested and does clear it (10 → 9), but it forces the entire Netlify dev
toolchain onto a major version it does not pin, which is a broader change than
the one build-time advisory justifies. Deliberately not done.

The remaining seven entries (`@astrojs/netlify`, `@netlify/dev`,
`@netlify/dev-utils`, `@netlify/edge-functions-dev`, `@netlify/functions-dev`,
`@netlify/images`, `@netlify/redirects`, `@netlify/vite-plugin`) are not
separate vulnerabilities — they are the dependency chain reported as affected
because they pull in those packages.

### Exposure assessment

Both are **build- and dev-time only**, in the `@netlify/dev` toolchain. Neither
is reachable from deployed code:

- Nothing untrusted is ever handed to an image parser. `image-size` processes
  only images committed to this repo. Note this is **not** because the site has
  no user input: `netlify/functions/instagram-webhook.mts:88` fetches an
  attacker-supplied `post.imageUrl` and stores the bytes. That path is
  bearer-token gated (`:44`) and never parses the image, so it does not reach a
  parser — but "no user uploads" overstates the case and should not be relied on
  as the reason.
- `extract-zip` is used by the local dev/functions tooling for archive
  extraction, not by anything running in production.
- The deployed surface is static HTML plus a small SSR function and the
  Instagram/GitHub functions, none of which parse images or archives. Note the
  site is **not** fully static: `src/pages/blog/index.astro:7` sets
  `export const prerender = false`, and the built manifest carries six
  `"prerender":false` routes deployed at `path: /*`. SSR does execute at request
  time; it just does not parse images or archives.

A DoS advisory against a build-time parser operating exclusively on
repo-controlled input is not a meaningful risk to this site. The realistic
worst case is a local build hanging on a malformed image the author added
themselves.

**Conclusion at the time: accepted.** The revisit condition named here —
"when `@netlify/dev` moves off them" — is exactly what happened on 2026-09-02,
and it was resolved that way, not by downgrading `@astrojs/netlify`.

### Re-triaged 2026-09-02 — cleared to zero

`npm audit` now reports **0 vulnerabilities**. One line did it:

```json
"@netlify/vite-plugin": "^3.0.1"
```

That single override pulls the whole Netlify dev chain forward — `@netlify/dev`
5.0.5, `dev-utils` 6.0.1, `functions-dev` 2.0.5, `edge-functions-dev` 2.0.1,
`redirects` 4.0.2 — because 3.0.1 declares those ranges itself. `image-size`
and `extract-zip` are no longer anywhere in the tree (`npm ls` returns empty
for both), so all 10 findings and both accepted roots are gone.

**This is the same override route rejected on 2026-08-21. Both reasons it was
rejected have since expired**, which is why it ships now and did not then:

**Objection 1 — "`extract-zip` is irreducible from here."** It cleared only
`image-size`, because `functions-dev@2.0.1` still required `extract-zip`.

*Expired.* `functions-dev@2.0.5` replaced `extract-zip` with `yauzl@^3.4.0`.
Verified with `npm view`; nothing in the resolved tree depends on it.

**Objection 2 — "an untested major, the #120 failure shape."** The override
forced `@netlify/dev` v5 underneath a `vite-plugin@2.12.9` that declared
`^4.18.7`.

*Expired.* The override is now on `vite-plugin` itself, and **3.0.1 declares
`@netlify/dev: ^5.0.2`**. Upstream did the integration; no declared range is
being fought.

The second is the important one. The August override contradicted a
maintainer's declared range; this one satisfies it. That is the difference
between forcing an untested combination and taking a tested one.

The one range still exceeded is `@astrojs/netlify@8.2.5`, which declares
`@netlify/vite-plugin: ^2.12.3` and so cannot reach 3.x on its own — that
caret is precisely why an override is still needed rather than a plain
`npm update`. The gap is a Node engines bump, not an API break:
`vite-plugin` 2.12.9 → 3.0.1 changes `engines.node` from `^20.6.1 || >=22` to
`>=22.12.0` and leaves `peerDependencies` (`vite: ^5 || ^6 || ^7 || ^8`)
untouched. This repo already sets `engines.node: >=22.12.0`, and both CI
(`.nvmrc`) and Netlify (`NODE_VERSION`) build on Node 24, so the new floor is
already met everywhere the site builds.

Verified on Node 24 with a clean `node_modules`:

- `npm audit` → 0 vulnerabilities
- `npm run build` → succeeds
- `npx tsc --noEmit` → exit 0
- Output checked against the #120/#121 silent-failure signature, which a green
  build does not rule out: `dist/rss.xml` is 14,949 bytes with 30 `<item>`
  entries (not the 274-byte empty feed), 33 blog directories emitted, homepage
  post links present.
- Top-level `@netlify/blobs` stays at 11.0.2, so the functions' own dependency
  is untouched by the chain move.

`netlify/framework-adapters#47` is still the real fix: with `vite-plugin`'s
range widened in `@astrojs/netlify`, this override becomes unnecessary and
should be dropped. Until then it is load-bearing — removing it silently
restores all 10 advisories.

### Re-triaged 2026-08-21

Re-checked whether upstream had moved. `image-size` (last published 2025-04)
and `extract-zip` (2023-03) still have no patched release, and GitHub's
Dependabot alerts agree — all three report `fixed_in=NONE`.

Two things did change, and one path to clearing `image-size` now exists:

- `@netlify/dev-utils@6.0.1` **dropped the `image-size` dependency entirely**.
- `@netlify/dev@5.0.1` and `@netlify/functions-dev@2.0.1` are available.

Forcing that newer chain via `overrides` was tested and takes `npm audit` from
10 findings to 5, clearing `image-size` completely. The build passes and
output verification succeeds.

**It was deliberately not shipped.** `@netlify/vite-plugin@2.12.9` declares
`@netlify/dev@^4.18.7`; the override forces v5, a major it has never been
tested against. That is the same shape as the failure behind #120 — a
dependency moving underneath the site and breaking something the build does
not flag — with less warning and no upstream compatibility guarantee. The
override would lower the audit count without lowering actual exposure, since
every one of these is build-time-only tooling.

`extract-zip` is irreducible from here regardless: even
`@netlify/functions-dev@2.0.1` still depends on it.

Filed upstream instead: **netlify/framework-adapters#47**, asking that
`vite-plugin` widen its range so consumers can reach the fixed chain through a
normal dependency update rather than an override that fights declared ranges.
That issue resolving is the real fix; everything else is a workaround.

### A note on the numbers

Three different counts describe the same two root packages, which makes this
look worse than it is:

| Source | Count | What it counts |
| --- | --- | --- |
| GitHub Dependabot alerts | 3 | the actual distinct advisories |
| `npm audit` | 10 | every chain package that pulls them in |
| GitHub push warning | higher | the full graph, not the resolved tree |

The 3 is the honest number: two `image-size` advisories and one `extract-zip`.

GitHub labels them `scope=runtime`, which is npm's dependency-type label — it
means "not declared under devDependencies", **not** that the code executes in
production. The exposure assessment above still holds.

## Accepted baseline (machine-readable)

`scripts/check-audit-baseline.sh` parses the block below, so this document is
the single source of truth for what CI enforces. Editing the list here changes
the check; there is no second copy in the script to keep in sync.

Lines are `root <name>` or `chain <name>`. A **root** is a package with an
actual advisory that has no patched release upstream. A **chain** entry is
reported by `npm audit` only because it depends on a root — not a distinct
problem. Anything appearing in `npm audit` that is not listed here fails CI.

The list holds two roots and ten chain entries, accepted until 2026-11-05
(see "Re-triaged 2026-10-05"). When it empties again, replace the lines with
a lone `none` sentinel: the script distinguishes it from a missing or
malformed block, which is still an error.

<!-- BEGIN ACCEPTED-BASELINE -->
```text
root braces
root node-forge
chain fast-glob
chain micromatch
chain ipx
chain listhen
chain @netlify/images
chain @netlify/zip-it-and-ship-it
chain @netlify/functions-dev
chain @netlify/dev
chain @netlify/vite-plugin
chain @astrojs/netlify
```
<!-- END ACCEPTED-BASELINE -->

### Re-triaged 2026-08-29

Count is now **10 high**, down from the 15 this document and #123 were opened
against. `sharp`, `picomatch`, `nanoid`, `ipx` and top-level `@netlify/blobs`
were cleared by #127 and the blobs 10 -> 11 bump. Only three distinct CVEs
remain — two against `image-size`, one against `extract-zip`; the other seven
entries are chain packages flagged for depending on them.

All three still have `first_patched_version: null` (verified against the GitHub
Advisory API), and `npm view` confirms 2.0.2 and 2.0.1 are the newest published
versions. There is nothing to upgrade to. npm still proposes the
`@astrojs/netlify@6.4.1` downgrade for 9 of the 10 — still the trap.

Retired `chain @netlify/images` from the baseline: it no longer appears in
`npm audit` (the `sharp` override cleared it). Removing it is safe because the
check only fails on *unlisted* packages, so a stale extra line could never mask
a new finding — it was noise, not coverage.

Also corrected two claims in the accepted-risk rationale above that were
factually wrong, though the conclusion they support still holds: the site does
have a user-influenced input path, and it does run SSR at request time.

`@astrojs/netlify` 8.1.2 -> 8.2.4 is available and compatible (peer
`astro: ^7.0.0` against the installed 7.1.6) but clears **zero** advisories: it
declares the same `@netlify/vite-plugin: ^2.12.3`, which already resolves to
2.12.9. Hygiene only, not a fix.

#### Astro vendors its own `image-size`, invisible to this baseline

`node_modules/astro/dist/assets/utils/vendor/image-size/` is a private copy that
**ships in the deployed SSR bundle**. `npm audit` cannot see it, the `overrides`
block does not cover it, and `check-audit-baseline.sh` — which reads only
`npm audit` — will never report it. Its ICNS parser is logically identical to
vulnerable upstream 2.0.2: same missing zero-length guard, so a crafted header
declaring a zero-length entry pins `imageOffset` and loops.

It is **not exploitable here**, and it fails closed twice:

- `astro.config.mjs` declares no `image:` block, so `domains` and
  `remotePatterns` are both empty and `isRemoteAllowed` returns `false` for
  every remote URL — 403 before any fetch.
- The configured service is `@astrojs/netlify/image-service.js`, whose exported
  `service` object has **no `transform` method**. The `/_image` endpoint's first
  check is `if (!("transform" in imageService)) throw` — 500 before a parser
  runs.

Recorded because **both guards are configuration, not code**. Adding a single
`image.domains` entry, or switching to a local/sharp image service, removes them
and makes the vendored parser reachable. Re-check this section before changing
either.

To retire an entry: confirm it no longer appears in `npm audit`, delete its
line, and record why in the re-triage section above.

## Re-checking

```bash
scripts/check-audit-baseline.sh
```

Runs in CI on every PR. It reads the accepted list from the block above, so
this document is what CI enforces.

- **Fails** when an advisory appears that is not listed above. Triage it;
  do not assume this acceptance covers it.
- **Reports without failing** when an accepted root gains a patched release,
  which is the cue to retire its line here.

The patched-release check queries the GitHub Advisory API for the specific
GHSA IDs the current `npm audit` cites, and reads `first_patched_version`.
Two deliberate choices there:

- npm's own `fixAvailable` is **not** used. For these advisories npm reports a
  fix of `@astrojs/netlify@6.4.1` — the major downgrade described above, which
  would re-break the site. Keying on it would recommend the trap.
- Querying by package name alone returns every advisory ever filed against it,
  including ones already fixed in the installed version. That produced a false
  "a fix exists" report for `image-size`, whose GHSA-m5qc-5hw7-8vg7 was patched
  in 2.0.2 — the version already installed. Scoping to the cited GHSA IDs fixes
  it.

`SKIP_ADVISORY_API=1` skips the lookup for offline runs, falling back to npm's
affected-range heuristic.

A lookup failure is reported rather than hidden. Individual failures warn and
fall back, and the affected root prints `❓` instead of `✅` so an unverified
result is never mistaken for a confirmed one. If **every** lookup in a run
fails, the check exits non-zero: a broken token or rate limit would otherwise
disable the patched-release signal indefinitely while still printing a clean
pass. That is a reporting failure, not a security finding — it cannot mask a
new advisory, which is caught by the separate check above.
