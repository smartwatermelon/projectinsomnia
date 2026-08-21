#!/usr/bin/env bash
# Guard the accepted npm audit baseline.
#
# docs/SECURITY-AUDIT.md accepts a specific, enumerated set of advisories:
# they are build-time-only, and no patched release exists upstream. That
# acceptance is only safe if something notices when the situation changes.
#
# This fails when a NEW advisory appears outside the accepted set, and reports
# (without failing) when an accepted one becomes fixable -- the signal that
# netlify/framework-adapters#47 or an upstream release has landed.
#
# Usage: scripts/check-audit-baseline.sh

set -euo pipefail

REPO_ROOT="$(unset CDPATH && cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "${REPO_ROOT}"

# Roots accepted in docs/SECURITY-AUDIT.md. Everything else in `npm audit`
# output is the dependency chain that pulls these in, not a distinct problem.
ACCEPTED_ROOTS="image-size extract-zip"

# Chain packages reported as affected solely because of the roots above.
ACCEPTED_CHAIN="@astrojs/netlify @netlify/blobs @netlify/dev @netlify/dev-utils \
@netlify/edge-functions-dev @netlify/functions-dev @netlify/images \
@netlify/redirects @netlify/vite-plugin"

FAILURES=0

echo "🔍 Checking npm audit against the accepted baseline"
echo

AUDIT_JSON="$(npm audit --json 2>/dev/null || true)"
if [[ -z "${AUDIT_JSON}" ]]; then
  echo "❌ could not run npm audit"
  exit 1
fi

# Advisory names present now.
CURRENT=$(printf '%s' "${AUDIT_JSON}" \
  | node -e "
    let s='';
    process.stdin.on('data', d => s += d).on('end', () => {
      const j = JSON.parse(s);
      console.log(Object.keys(j.vulnerabilities || {}).join('\n'));
    });
  ")

# Anything not in the accepted set is new and must be triaged.
for pkg in ${CURRENT}; do
  if ! printf '%s %s' "${ACCEPTED_ROOTS}" "${ACCEPTED_CHAIN}" | grep -qw -- "${pkg}"; then
    echo "❌ NEW advisory outside the accepted baseline: ${pkg}"
    echo "     Triage it; do not assume docs/SECURITY-AUDIT.md covers it."
    FAILURES=$((FAILURES + 1))
  fi
done

# Report when an accepted root becomes fixable -- that is the good news case,
# and the cue to revisit the acceptance and the upstream issue.
for root in ${ACCEPTED_ROOTS}; do
  fixable=$(printf '%s' "${AUDIT_JSON}" \
    | node -e "
      let s='';
      process.stdin.on('data', d => s += d).on('end', () => {
        const j = JSON.parse(s);
        const v = (j.vulnerabilities || {})['${root}'];
        if (!v) { console.log('gone'); return; }
        console.log(v.range === '*' ? 'unfixed' : 'range:' + v.range);
      });
    ")
  case "${fixable}" in
    gone)
      echo "🎉 ${root} no longer appears in npm audit — update docs/SECURITY-AUDIT.md"
      ;;
    unfixed)
      echo "✅ ${root}: still no patched release upstream (as accepted)"
      ;;
    *)
      echo "🎉 ${root} now reports a bounded range (${fixable#range:}) — a fix may exist;"
      echo "     revisit docs/SECURITY-AUDIT.md and netlify/framework-adapters#47"
      ;;
  esac
done

echo
if [[ "${FAILURES}" -gt 0 ]]; then
  echo "Audit baseline check FAILED (${FAILURES} new advisory/advisories)."
  exit 1
fi

echo "Audit baseline check passed — no advisories outside the accepted set."
