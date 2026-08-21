#!/usr/bin/env bash
# Verify that a completed Astro build actually produced content.
#
# Why this exists: a build with broken content collections still exits 0.
# Astro reports "The collection ... does not exist or is empty" as a warning,
# so exit status alone cannot distinguish a healthy site from an empty one.
# See https://github.com/smartwatermelon/projectinsomnia/issues/121 and the
# regression it describes (#106 -> #120), where main deployed a site with no
# blog posts and a 274-byte RSS feed.
#
# Usage: scripts/verify-build-output.sh [build-log-file]
#
# Reads floors from the environment so they can be tuned without editing:
#   MIN_RSS_ITEMS, MIN_BLOG_POSTS, MIN_OUATREVISIT_POSTS, MIN_ELECTIONS_POSTS

set -euo pipefail

# Resolve repo root independently of CDPATH, which can make a bare `cd` both
# print its destination and resolve somewhere unexpected.
REPO_ROOT="$(unset CDPATH && cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "${REPO_ROOT}"

BUILD_LOG="${1:-}"
DIST="dist"

# Floors deliberately sit below current counts so ordinary additions don't
# trip them, while a collapse to zero (the actual failure mode) always does.
MIN_RSS_ITEMS="${MIN_RSS_ITEMS:-20}"
MIN_BLOG_POSTS="${MIN_BLOG_POSTS:-25}"
MIN_OUATREVISIT_POSTS="${MIN_OUATREVISIT_POSTS:-30}"
MIN_ELECTIONS_POSTS="${MIN_ELECTIONS_POSTS:-3}"

FAILURES=0

fail() {
  echo "❌ $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "✅ $1"
}

echo "🔍 Verifying build output in ${DIST}/"
echo

# --- Check 0: the build directory exists at all -----------------------------
if [[ ! -d "${DIST}" ]]; then
  fail "${DIST}/ does not exist — did the build run?"
  echo
  echo "Build output verification FAILED (${FAILURES} problem(s))."
  exit 1
fi

# --- Check 1: the collection-empty warning ---------------------------------
# The most direct signal. Astro emits this as a warning, not an error, so it
# never affects the exit code — grepping for it is the whole point.
if [[ -n "${BUILD_LOG}" ]]; then
  if [[ ! -f "${BUILD_LOG}" ]]; then
    fail "build log '${BUILD_LOG}' not found"
  elif grep -q "does not exist or is empty" "${BUILD_LOG}"; then
    fail "build log contains 'does not exist or is empty' — a content collection failed to load:"
    grep "does not exist or is empty" "${BUILD_LOG}" | sed 's/^/     /'
  else
    pass "no empty-collection warnings in build log"
  fi
else
  echo "ℹ️  no build log passed; skipping collection-warning check"
fi

# --- Check 2: RSS feed has real items --------------------------------------
RSS="${DIST}/rss.xml"
if [[ ! -f "${RSS}" ]]; then
  fail "${RSS} was not generated"
else
  # grep -c counts matching lines, and the feed is minified onto one line,
  # so count occurrences with -o instead. grep exits 1 on no matches, which
  # under `set -e` + pipefail would abort the script precisely in the
  # zero-item case this check exists to catch — hence the `|| true`.
  RSS_ITEMS=$({ grep -o "<item>" "${RSS}" || true; } | wc -l | tr -d " ")
  if [[ "${RSS_ITEMS}" -lt "${MIN_RSS_ITEMS}" ]]; then
    fail "RSS feed has ${RSS_ITEMS} item(s), expected at least ${MIN_RSS_ITEMS}"
  else
    pass "RSS feed has ${RSS_ITEMS} items (floor ${MIN_RSS_ITEMS})"
  fi
fi

# --- Check 3: generated page counts per collection -------------------------
# Counts only immediate subdirectories, each of which is one post route.
count_dirs() {
  local dir="$1"
  [[ -d "${dir}" ]] || {
    echo 0
    return
  }
  find "${dir}" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' '
}

# Blog posts live at dist/blog/<slug>/ alongside the siloed collection
# directories, so subtract those to count blog posts alone.
BLOG_ALL=$(count_dirs "${DIST}/blog")
OUAT_COUNT=$(count_dirs "${DIST}/blog/ouatrevisit")
ELECTIONS_COUNT=$(count_dirs "${DIST}/blog/elections")

SILOS=0
[[ -d "${DIST}/blog/ouatrevisit" ]] && SILOS=$((SILOS + 1))
[[ -d "${DIST}/blog/elections" ]] && SILOS=$((SILOS + 1))
BLOG_COUNT=$((BLOG_ALL - SILOS))

check_count() {
  local label="$1" actual="$2" floor="$3"
  if [[ "${actual}" -lt "${floor}" ]]; then
    fail "${label}: ${actual} page(s), expected at least ${floor}"
  else
    pass "${label}: ${actual} pages (floor ${floor})"
  fi
}

check_count "blog posts" "${BLOG_COUNT}" "${MIN_BLOG_POSTS}"
check_count "ouatrevisit posts" "${OUAT_COUNT}" "${MIN_OUATREVISIT_POSTS}"
check_count "elections posts" "${ELECTIONS_COUNT}" "${MIN_ELECTIONS_POSTS}"

# --- Check 4: homepage is not an empty shell -------------------------------
# The homepage lists recent posts; if collections resolved empty it still
# renders, just without any post links. Assert at least one made it through.
HOME="${DIST}/index.html"
if [[ ! -f "${HOME}" ]]; then
  fail "${HOME} was not generated"
elif ! grep -qE 'href="/blog/[^"]+/"' "${HOME}"; then
  # Must match a link to an actual post, not the bare /blog/ nav link, which
  # is present even when the post list renders empty.
  fail "homepage contains no links to individual posts — post list rendered empty"
else
  pass "homepage links to individual blog posts"
fi

echo
if [[ "${FAILURES}" -gt 0 ]]; then
  echo "Build output verification FAILED (${FAILURES} problem(s))."
  exit 1
fi

echo "Build output verification passed."
