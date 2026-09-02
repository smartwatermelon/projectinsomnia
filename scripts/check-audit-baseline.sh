#!/usr/bin/env bash
# Guard the accepted npm audit baseline.
#
# docs/SECURITY-AUDIT.md enumerates the advisories this repo accepts: ones
# that are build-time-only with no patched release upstream. That acceptance
# is only safe if something notices when the situation changes.
#
# As of 2026-09-02 that list is EMPTY (a lone `none` sentinel) -- the audit is
# at zero, so any advisory at all fails this check. The parsing below still
# supports a populated list for when something has to be accepted again.
#
# This fails when a NEW advisory appears outside the accepted set, and reports
# (without failing) when an accepted root becomes fixable -- the signal that
# netlify/framework-adapters#47 or an upstream release has landed.
#
# The accepted list is parsed from docs/SECURITY-AUDIT.md rather than
# duplicated here, so the rationale and the enforced list cannot drift apart.
#
# Usage: scripts/check-audit-baseline.sh
#
# Env:
#   SKIP_ADVISORY_API=1  skip the GitHub Advisory API lookup (offline runs)

set -euo pipefail

REPO_ROOT="$(unset CDPATH && cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "${REPO_ROOT}"

BASELINE_DOC="docs/SECURITY-AUDIT.md"
FAILURES=0
LOOKUPS_ATTEMPTED=0
LOOKUPS_FAILED=0

echo "🔍 Checking npm audit against the accepted baseline"
echo "   baseline source: ${BASELINE_DOC}"
echo

# --- Parse the accepted baseline from the doc ------------------------------
if [[ ! -f "${BASELINE_DOC}" ]]; then
  echo "❌ ${BASELINE_DOC} not found — cannot determine the accepted baseline"
  exit 1
fi

# Exactly one delimited block, or the parse is ambiguous. Duplicated markers
# would silently yield a doubled list -- the same kind of unnoticed config
# drift this check exists to prevent.
BEGIN_COUNT=$(grep -c 'BEGIN ACCEPTED-BASELINE' "${BASELINE_DOC}" || true)
END_COUNT=$(grep -c 'END ACCEPTED-BASELINE' "${BASELINE_DOC}" || true)
if [[ "${BEGIN_COUNT}" != "1" || "${END_COUNT}" != "1" ]]; then
  echo "❌ ${BASELINE_DOC} must contain exactly one ACCEPTED-BASELINE block"
  echo "     found ${BEGIN_COUNT} BEGIN marker(s), ${END_COUNT} END marker(s)"
  exit 1
fi

BASELINE_BLOCK=$(sed -n '/BEGIN ACCEPTED-BASELINE/,/END ACCEPTED-BASELINE/p' "${BASELINE_DOC}" \
  | grep -E '^(root|chain)[[:space:]]+' || true)

# An empty accepted list is a legitimate -- indeed the desired -- state, but it
# is indistinguishable from a block that failed to parse. A literal `none` line
# is the sentinel for "deliberately empty", so a typo'd or truncated block
# still fails loudly instead of silently accepting nothing and passing.
BASELINE_NONE=$(sed -n '/BEGIN ACCEPTED-BASELINE/,/END ACCEPTED-BASELINE/p' "${BASELINE_DOC}" \
  | grep -cE '^none[[:space:]]*$' || true)

if [[ -z "${BASELINE_BLOCK}" && "${BASELINE_NONE}" == "0" ]]; then
  echo "❌ no ACCEPTED-BASELINE block found in ${BASELINE_DOC}"
  echo "     Expected lines of the form 'root <pkg>' / 'chain <pkg>' between"
  echo "     the BEGIN/END ACCEPTED-BASELINE markers, or a lone 'none' line"
  echo "     to declare the accepted list deliberately empty."
  exit 1
fi

if [[ -n "${BASELINE_BLOCK}" && "${BASELINE_NONE}" != "0" ]]; then
  echo "❌ ${BASELINE_DOC} has both 'none' and root/chain entries"
  echo "     The sentinel means the list is empty; it cannot coexist with"
  echo "     accepted packages. Remove whichever is wrong."
  exit 1
fi

ACCEPTED_ROOTS=$(awk '$1=="root" && NF>=2 {print $2}' <<<"${BASELINE_BLOCK}")
ACCEPTED_ALL=$(awk 'NF>=2 {print $2}' <<<"${BASELINE_BLOCK}")

ROOTS_ONELINE=$(tr '\n' ' ' <<<"${ACCEPTED_ROOTS}")
if [[ -z "${ROOTS_ONELINE// /}" ]]; then
  echo "   accepted roots: (none — any advisory fails this check)"
else
  echo "   accepted roots: ${ROOTS_ONELINE}"
fi
echo

# --- Read the current advisory set -----------------------------------------
AUDIT_JSON="$(npm audit --json 2>/dev/null || true)"
if [[ -z "${AUDIT_JSON}" ]]; then
  echo "❌ could not run npm audit"
  exit 1
fi

# `|| true` so a parse failure surfaces through the explicit check below with
# a readable message, rather than aborting under `set -e` with a bare exit code.
CURRENT=$(printf '%s' "${AUDIT_JSON}" \
  | node -e "
    let s='';
    process.stdin.on('data', d => s += d).on('end', () => {
      let j;
      try { j = JSON.parse(s); } catch { process.exit(3); }
      console.log(Object.keys(j.vulnerabilities || {}).join('\n'));
    });
  " || true)

if [[ -z "${CURRENT}" ]] && ! printf '%s' "${AUDIT_JSON}" | grep -q '"vulnerabilities"'; then
  echo "❌ could not parse npm audit output"
  exit 1
fi

# --- Fail on anything outside the accepted set -----------------------------
for pkg in ${CURRENT}; do
  # Exact match against the parsed list. grep -x avoids the substring and
  # word-boundary pitfalls of matching scoped names inside a flat string.
  if ! grep -qxF -- "${pkg}" <<<"${ACCEPTED_ALL}"; then
    echo "❌ NEW advisory outside the accepted baseline: ${pkg}"
    echo "     Triage it; do not assume ${BASELINE_DOC} covers it."
    FAILURES=$((FAILURES + 1))
  fi
done

# --- Report when an accepted root becomes fixable --------------------------
# Primary signal is GitHub's Advisory API, whose first_patched_version is a
# documented field. npm's own fixAvailable is deliberately NOT used: for these
# advisories npm reports a fix of "@astrojs/netlify@6.4.1", which is a major
# DOWNGRADE that would re-break the site (see the "What was NOT done" section
# in the baseline doc). npm's affected range of '*' is kept only as an offline
# fallback -- an observed convention, not a guarantee.
for root in ${ACCEPTED_ROOTS}; do
  if [[ -z "${CURRENT}" ]] || ! grep -qxF -- "${root}" <<<"${CURRENT}"; then
    echo "🎉 ${root} no longer appears in npm audit — update ${BASELINE_DOC}"
    continue
  fi

  # Only the advisories our own tree actually cites. Querying by package name
  # alone returns every advisory ever filed against it -- including ones
  # already fixed in the installed version -- which produces a false "a fix
  # exists" report.
  ghsa_ids=$(printf '%s' "${AUDIT_JSON}" \
    | node -e "
      let s='';
      const root = process.argv[1];
      process.stdin.on('data', d => s += d).on('end', () => {
        let j;
        try { j = JSON.parse(s); } catch { process.exit(3); }
        const v = (j.vulnerabilities || {})[root];
        if (!v) return;
        const ids = (v.via || [])
          .filter(x => x && typeof x === 'object' && typeof x.url === 'string')
          .map(x => x.url.split('/').pop())
          .filter(x => /^GHSA-[0-9a-zA-Z-]+$/.test(x));
        console.log([...new Set(ids)].join('\n'));
      });
    " "${root}" || true)

  patched=""
  root_lookup_failed=0
  if [[ "${SKIP_ADVISORY_API:-}" != "1" ]] && command -v gh >/dev/null 2>&1; then
    # Unpatched advisories report first_patched_version: null. Any non-null
    # value means a fixed release exists for an advisory we actually carry.
    for ghsa in ${ghsa_ids}; do
      # gh api has no --arg flag, so pipe the raw response to jq, which does.
      # That keeps the package name out of the filter string entirely.
      LOOKUPS_ATTEMPTED=$((LOOKUPS_ATTEMPTED + 1))
      if ! advisory_json=$(gh api "https://api.github.com/advisories/${ghsa}" 2>/dev/null); then
        LOOKUPS_FAILED=$((LOOKUPS_FAILED + 1))
        root_lookup_failed=1
        echo "⚠️  ${root}: advisory lookup failed for ${ghsa} (network or auth?);"
        echo "     falling back to npm's affected-range heuristic"
        continue
      fi
      fix=$(printf '%s' "${advisory_json}" \
        | jq -r --arg root "${root}" \
          '[.vulnerabilities[]?
            | select(.package.name == $root)
            | .first_patched_version // empty] | unique | join(", ")' 2>/dev/null || true)
      if [[ -n "${fix}" ]]; then
        patched="${patched:+${patched}; }${ghsa} → ${fix}"
      fi
    done
  fi

  if [[ -n "${patched}" ]]; then
    echo "🎉 ${root}: a patched release now exists (${patched})"
    echo "     Revisit ${BASELINE_DOC} and netlify/framework-adapters#47"
    continue
  fi

  range=$(printf '%s' "${AUDIT_JSON}" \
    | node -e "
      let s='';
      const root = process.argv[1];
      process.stdin.on('data', d => s += d).on('end', () => {
        let j;
        try { j = JSON.parse(s); } catch { process.exit(3); }
        const v = (j.vulnerabilities || {})[root];
        console.log(v ? v.range : '');
      });
    " "${root}" || true)

  if [[ "${range}" == "*" ]]; then
    if [[ "${root_lookup_failed}" == "1" ]]; then
      echo "❓ ${root}: no patched release per npm's heuristic (advisory API unavailable)"
    else
      echo "✅ ${root}: still no patched release upstream (as accepted)"
    fi
  else
    echo "🎉 ${root}: npm now reports a bounded range (${range}) — a fix may exist;"
    echo "     revisit ${BASELINE_DOC} and netlify/framework-adapters#47"
  fi
done

echo
if [[ "${FAILURES}" -gt 0 ]]; then
  echo "Audit baseline check FAILED (${FAILURES} new advisory/advisories)."
  exit 1
fi

# A wholly-failing lookup path is not a security finding, but it silently
# disables the "upstream shipped a fix" signal this check exists to provide.
# If every attempt errored, say so loudly rather than printing a clean pass
# that is indistinguishable from healthy operation.
if [[ "${LOOKUPS_ATTEMPTED}" -gt 0 && "${LOOKUPS_FAILED}" -eq "${LOOKUPS_ATTEMPTED}" ]]; then
  echo "❌ every advisory lookup failed (${LOOKUPS_FAILED}/${LOOKUPS_ATTEMPTED})."
  echo "     No advisory outside the accepted set was found, but the"
  echo "     patched-release check did not run: a fix could have shipped"
  echo "     without this reporting it. Check GH_TOKEN, rate limits, and"
  echo "     network access, or set SKIP_ADVISORY_API=1 to accept the"
  echo "     npm heuristic deliberately."
  exit 1
fi

if [[ "${LOOKUPS_FAILED}" -gt 0 ]]; then
  echo "⚠️  ${LOOKUPS_FAILED}/${LOOKUPS_ATTEMPTED} advisory lookups failed;"
  echo "     those roots fell back to npm's heuristic."
fi

echo "Audit baseline check passed — no advisories outside the accepted set."
