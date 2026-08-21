# Dependency audit triage

Tracking the `npm audit` state and the reasoning behind what is fixed versus
accepted. Issue #123 asked for the residual risk to be a documented conclusion
rather than an assumption, so this file records that.

Last reviewed: 2026-08-20

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

## Re-checking

```bash
npm audit
```

If the count rises above 10, or any advisory appears that is *not* in the
`image-size` / `extract-zip` chain above, triage it rather than assuming it
falls under this acceptance.
