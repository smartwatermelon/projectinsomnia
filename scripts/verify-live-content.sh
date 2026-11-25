#!/usr/bin/env bash
# Production content checks (#171). GET only, no token: no Netlify builds.
# Usage: $0 <base-url>. Env: see the defaults below.

set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "${BASE_URL}" ]]; then
  echo "usage: $0 <base-url>" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

EXPECTED_GITHUB_USER="${EXPECTED_GITHUB_USER:-twistedmelonman}"
EXPECTED_INSTAGRAM_USER="${EXPECTED_INSTAGRAM_USER:-smartwatermelon}"
KNOWN_FAILURES="${KNOWN_FAILURES:-}"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

FAILURES=0
WARNINGS=0

fail() {
  echo "❌ $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "✅ $1"
}

warn() {
  echo "⚠️  $1"
  WARNINGS=$((WARNINGS + 1))
}

is_known_failure() {
  [[ " ${KNOWN_FAILURES} " == *" $1 "* ]]
}

# Refuse anything under /.netlify/: that is where functions (including the
# build-hook caller) live. Checks go through the public paths only.
guard_path() {
  if [[ "$1" == *"/.netlify/"* ]]; then
    echo "refusing to request $1: /.netlify/ paths are off limits (cost rule)" >&2
    exit 2
  fi
}

# GET one URL. Prints "<status> <content-type>" on line 1, then the body.
# No retries (each is a billed invocation) and no redirects (a hop could reach /.netlify/).
get() {
  guard_path "$1"
  local tmp status
  tmp=$(mktemp)
  status=$(curl -sS --max-time 20 -o "${tmp}" \
    -w "%{http_code} %{content_type}" "$1" 2>/dev/null || echo "000 none")
  printf '%s\n' "${status}"
  cat "${tmp}"
  rm -f "${tmp}"
}

# Like get, but discards the body. For images: binary data does not belong
# in a shell variable.
get_head() {
  guard_path "$1"
  curl -sS --max-time 20 -o /dev/null \
    -w "%{http_code} %{content_type}" "$1" 2>/dev/null || echo "000 none"
}

status_of() { head -n 1 <<<"$1" | cut -d ' ' -f 1; }
type_of() { head -n 1 <<<"$1" | cut -d ' ' -f 2- | cut -d ';' -f 1; }
body_of() { tail -n +2 <<<"$1"; }

echo "🔍 Live content checks against ${BASE_URL}"
echo

# Check 1: each page's heading. A 200 can hide the wrong page; the heading shows which one rendered.
declare -A HEADINGS=(
  ["/"]="Project Insomnia"
  ["/blog/"]="Blog"
  ["/about/"]="About"
  ["/projects/"]="Projects"
  ["/now/"]="Now"
  ["/subscribe/"]="Subscribe"
)
NOW_HTML=""
for route in "/" "/blog/" "/about/" "/projects/" "/now/" "/subscribe/"; do
  resp=$(get "${BASE_URL}${route}")
  code=$(status_of "${resp}")
  html=$(body_of "${resp}")
  if [[ "${route}" == "/now/" ]]; then
    NOW_HTML="${html}"
  fi
  if [[ "${code}" != "200" ]]; then
    fail "${route} returned HTTP ${code}"
  elif ! grep -qE "<h1[^>]*>${HEADINGS[${route}]}</h1>" <<<"${html}"; then
    fail "${route} does not show <h1>${HEADINGS[${route}]}</h1>"
  else
    pass "${route} shows its heading '${HEADINGS[${route}]}'"
  fi
done

# Check 2: /now names the right accounts (the org-migration bug). ghchart returns 500 for an org.
CHART_URL="https://ghchart.rshah.org/4338ca/${EXPECTED_GITHUB_USER}"
# Tests point the fetch at a stub; the page must still show the real URL.
CHART_FETCH_URL="${GHCHART_BASE:-https://ghchart.rshah.org}/4338ca/${EXPECTED_GITHUB_USER}"
if grep -qF "src=\"${CHART_URL}\"" <<<"${NOW_HTML}"; then
  pass "/now/ contribution graph is for ${EXPECTED_GITHUB_USER}"
else
  fail "/now/ contribution graph is not ${CHART_URL}"
fi
if grep -qF "href=\"https://github.com/${EXPECTED_GITHUB_USER}\"" <<<"${NOW_HTML}"; then
  pass "/now/ GitHub profile link is ${EXPECTED_GITHUB_USER}"
else
  fail "/now/ GitHub profile link is not github.com/${EXPECTED_GITHUB_USER}"
fi
if grep -qF "href=\"https://www.instagram.com/${EXPECTED_INSTAGRAM_USER}/\"" <<<"${NOW_HTML}"; then
  pass "/now/ Instagram profile link is ${EXPECTED_INSTAGRAM_USER}"
else
  fail "/now/ Instagram profile link is not instagram.com/${EXPECTED_INSTAGRAM_USER}"
fi

# Third-party host, so no Netlify cost.
chart=$(get_head "${CHART_FETCH_URL}")
chart_code=$(status_of "${chart}")
chart_type=$(type_of "${chart}")
if [[ "${chart_code}" == "200" && "${chart_type}" == "image/svg+xml" ]]; then
  pass "contribution graph serves an SVG"
else
  fail "contribution graph returned HTTP ${chart_code} ${chart_type}, expected 200 image/svg+xml"
fi

# Check 3: feeds have items. github uses {items}, instagram {posts}.
# feed_check <name> <jq filter that must be true>
feed_check() {
  local name="$1" filter="$2" resp code body report
  resp=$(get "${BASE_URL}/api/${name}-feed")
  code=$(status_of "${resp}")
  body=$(body_of "${resp}")
  if [[ "${code}" == "200" ]] && jq -e "${filter}" >/dev/null 2>&1 <<<"${body}"; then
    if is_known_failure "${name}"; then
      warn "${name} feed now passes; remove it from KNOWN_FAILURES"
    else
      pass "${name} feed returns well-formed items"
    fi
    FEED_BODY="${body}"
    return 0
  fi
  report="${name} feed returned HTTP ${code} without well-formed items"
  if is_known_failure "${name}"; then
    warn "${report} (known failure, not counted)"
  else
    fail "${report}"
  fi
  FEED_BODY=""
}

FEED_BODY=""
feed_check github '(.items | length > 0) and all(.items[]; (.title | type == "string") and (.link | startswith("https://github.com/")))'
feed_check instagram '(.posts | length > 0) and all(.posts[]; (.imageUrl | type == "string") and (.postUrl | type == "string"))'
INSTAGRAM_BODY="${FEED_BODY}"

# Check 4: the image function serves the first listed Instagram image.
if [[ -n "${INSTAGRAM_BODY}" ]]; then
  image_path=$(jq -r '.posts[0].imageUrl' <<<"${INSTAGRAM_BODY}")
  if [[ "${image_path}" != /api/instagram-image/* ]]; then
    fail "first Instagram imageUrl '${image_path}' is not under /api/instagram-image/"
  else
    image=$(get_head "${BASE_URL}${image_path}")
    image_code=$(status_of "${image}")
    image_type=$(type_of "${image}")
    if [[ "${image_code}" == "200" && "${image_type}" == image/* ]]; then
      pass "first Instagram image is served (${image_type})"
    else
      fail "${image_path} returned HTTP ${image_code} ${image_type}, expected 200 image/*"
    fi
  fi
fi

echo
if [[ "${FAILURES}" -gt 0 ]]; then
  echo "Live content checks FAILED (${FAILURES} problem(s), ${WARNINGS} warning(s))."
  exit 1
fi
echo "Live content checks passed (${WARNINGS} warning(s))."
