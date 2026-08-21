#!/usr/bin/env bash
# Acceptance checks against a live Netlify deploy preview.
#
# Complements scripts/verify-build-output.sh: that one inspects dist/ on the
# runner, this one exercises the site Netlify actually served. It therefore
# covers what a static build check structurally cannot -- the SSR route, the
# adapter, and the redirect rules in netlify.toml.
#
# Usage: scripts/verify-deploy-preview.sh <preview-url>
#
# Floors mirror verify-build-output.sh so the two cannot drift apart:
#   MIN_RSS_ITEMS

set -euo pipefail

PREVIEW_URL="${1:-}"
if [[ -z "${PREVIEW_URL}" ]]; then
  echo "usage: $0 <preview-url>" >&2
  exit 2
fi

# Trim any trailing slash so path concatenation below is unambiguous.
PREVIEW_URL="${PREVIEW_URL%/}"

MIN_RSS_ITEMS="${MIN_RSS_ITEMS:-20}"

FAILURES=0

fail() {
  echo "❌ $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "✅ $1"
}

# curl with retries: a preview can be reachable a moment before every asset
# is served. --location follows Astro's trailing-slash redirects, so these
# checks assert reachability rather than trailing-slash trivia.
fetch() {
  curl -sS --location --max-time 20 --retry 3 --retry-delay 2 "$@"
}

echo "🔍 Acceptance checks against ${PREVIEW_URL}"
echo

# --- Check 1: key routes are reachable -------------------------------------
# Catches routing and adapter breakage, plus SSR functions erroring at
# runtime -- none of which a dist/ inspection can see.
ROUTES=(
  "/"
  "/blog/"
  "/now/"
  "/projects/"
  "/about/"
  "/rss.xml"
  "/blog/five-races/"
)

for route in "${ROUTES[@]}"; do
  code=$(curl -sS --location --max-time 20 --retry 3 --retry-delay 2 \
    -o /dev/null -w "%{http_code}" "${PREVIEW_URL}${route}" || echo "000")
  if [[ "${code}" != "200" ]]; then
    fail "route ${route} returned HTTP ${code} (expected 200)"
  else
    pass "route ${route} → 200"
  fi
done

# --- Check 2: RSS feed is served with real content -------------------------
# The #120 regression served a syntactically valid but empty 274-byte feed,
# so presence and status alone are not enough -- count the items.
RSS_BODY=$(fetch "${PREVIEW_URL}/rss.xml" || true)
if [[ -z "${RSS_BODY}" ]]; then
  fail "could not fetch /rss.xml"
else
  RSS_ITEMS=$(printf '%s' "${RSS_BODY}" | { grep -o "<item>" || true; } | wc -l | tr -d " ")
  if [[ "${RSS_ITEMS}" -lt "${MIN_RSS_ITEMS}" ]]; then
    fail "served RSS feed has ${RSS_ITEMS} item(s), expected at least ${MIN_RSS_ITEMS}"
  else
    pass "served RSS feed has ${RSS_ITEMS} items (floor ${MIN_RSS_ITEMS})"
  fi
fi

# --- Check 3: homepage links to individual posts ---------------------------
# Matches a link to an actual post, not the bare /blog/ nav link, which is
# present even when the post list renders empty.
HOME_BODY=$(fetch "${PREVIEW_URL}/" || true)
if [[ -z "${HOME_BODY}" ]]; then
  fail "could not fetch homepage"
elif ! printf '%s' "${HOME_BODY}" | grep -qE 'href="/blog/[^"]+/"'; then
  fail "homepage contains no links to individual posts — post list rendered empty"
else
  pass "homepage links to individual blog posts"
fi

# --- Check 4: the SSR route actually renders -------------------------------
# /now is the only prerender:false route; it depends on the Netlify adapter
# and @netlify/blobs. An adapter or blobs bump can break it while the static
# build stays perfectly green, so assert on rendered markup, not just status.
NOW_BODY=$(fetch "${PREVIEW_URL}/now/" || true)
if [[ -z "${NOW_BODY}" ]]; then
  fail "could not fetch /now/"
else
  if ! printf '%s' "${NOW_BODY}" | grep -qE '<h1[^>]*>Now</h1>'; then
    fail "/now/ did not render its <h1>Now</h1> heading — SSR route may be erroring"
  else
    pass "/now/ rendered its heading"
  fi

  # The feed sections are server-rendered; their absence means the page
  # returned a shell rather than a real render.
  missing_sections=""
  for section in GitHub Strava Instagram; do
    if ! printf '%s' "${NOW_BODY}" | grep -q "${section}"; then
      missing_sections="${missing_sections} ${section}"
    fi
  done
  if [[ -n "${missing_sections}" ]]; then
    fail "/now/ is missing feed section(s):${missing_sections}"
  else
    pass "/now/ rendered all feed sections"
  fi
fi

# --- Check 5: trailing-slash routing is intact -----------------------------
# NOT a check of the netlify.toml apex-domain redirects. Those match on the
# project-insomnia.com host, and sending that Host header to a preview is
# answered by Netlify's platform-level domain routing rather than by this
# deploy -- verified by observing the identical 301 from an unrelated site,
# so such a check passes even when the deploy is completely broken. Netlify's
# own "Redirect rules" commit status already validates that config.
#
# What IS deploy-specific is Astro's trailing-slash behaviour, which comes
# from the adapter and breaks visibly if routing regresses.
REDIRECT_CODE=$(curl -sS --max-time 20 --retry 2 --retry-delay 2 \
  -o /dev/null -w "%{http_code}" "${PREVIEW_URL}/now" || echo "000")
REDIRECT_TARGET=$(curl -sS --max-time 20 --retry 2 --retry-delay 2 \
  -o /dev/null -w "%{redirect_url}" "${PREVIEW_URL}/now" || echo "")

if [[ "${REDIRECT_CODE}" != "301" ]]; then
  fail "/now returned HTTP ${REDIRECT_CODE}, expected a 301 to /now/"
elif [[ "${REDIRECT_TARGET}" != *"/now/" ]]; then
  fail "/now redirected to '${REDIRECT_TARGET:-none}', expected it to end in /now/"
else
  pass "/now → 301 → /now/ (trailing-slash routing intact)"
fi

echo
if [[ "${FAILURES}" -gt 0 ]]; then
  echo "Deploy preview acceptance FAILED (${FAILURES} problem(s))."
  exit 1
fi

echo "Deploy preview acceptance passed."
