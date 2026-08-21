# Dependency audit triage

Tracking the `npm audit` state and the reasoning behind what is fixed versus
accepted. Issue #123 asked for the residual risk to be a documented conclusion
rather than an assumption, so this file records that.

Last reviewed: 2026-08-21

## Current state

`npm audit` reports **10 high advisories, 0 critical/moderate/low**, down from
15 at the time #123 was filed.

## What was fixed

| Package | Action | Result |
| --- | --- | --- |
| `@netlify/blobs` | bumped `^10.7.2` → `^11.0.1` | direct fix; cleared |
| `sharp` | `overrides` → `^0.35.3` | advisory required `>=0.35.0`; cleared |
| `picomatch` | `overrides` → `^4.0.5` | ReDoS + method injection; cleared |
| `nanoid` | `overrides` → `^5.1.6` | zero-size infinite loop; cleared |
| `ipx` | — | cleared transitively by the `sharp` override |

`@netlify/blobs` 10 → 11 is a major bump. The three call sites
(`netlify/functions/instagram-{feed,image,webhook}.mts`) use `getStore`,
`.get()`, `.set()`, and `.setJSON()`; all are present in v11 with compatible
signatures, and the functions type-check clean against the v11 declarations.

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

## Accepted residual risk (10 advisories)

All 10 trace to two transitive packages with **no fixed release published
upstream** — both report an affected range of `*`, meaning every existing
version is affected:

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

- This site has **no user uploads**. Nothing untrusted is ever handed to an
  image parser. `image-size` processes only images committed to this repo.
- `extract-zip` is used by the local dev/functions tooling for archive
  extraction, not by anything running in production.
- The deployed surface is static HTML plus a small SSR function and the
  Instagram/GitHub functions, none of which parse images or archives.

A DoS advisory against a build-time parser operating exclusively on
repo-controlled input is not a meaningful risk to this site. The realistic
worst case is a local build hanging on a malformed image the author added
themselves.

**Conclusion: accepted.** Revisit when `image-size` or `extract-zip` publish a
patched release, or when `@netlify/dev` moves off them. Do not resolve by
downgrading `@astrojs/netlify`.

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

## Re-checking

```bash
npm audit
```

If the count rises above 10, or any advisory appears that is *not* in the
`image-size` / `extract-zip` chain above, triage it rather than assuming it
falls under this acceptance.
