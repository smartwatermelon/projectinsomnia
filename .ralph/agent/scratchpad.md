## Attempt 1

**Issue #15:** Verify IFTTT `<<<>>>` escaping handles double-quote characters in Instagram captions.

**History learned:**
- PR #13 switched to form-encoding because IFTTT substitutes ingredients without escaping in JSON templates
- PR #14 switched back to JSON + `<<<>>>` escaping, claiming it handles quotes
- Issue #15 flagged that double-quote handling was unverified and failures would be "silently dropped" (400 with no logging)

**Change made:**
- In `netlify/functions/instagram-webhook.mts`, switched from `req.json()` to `req.text()` + `JSON.parse()` so the raw body is captured before parsing
- Updated comment to explicitly state `<<<>>>` JSON-encodes values including double-quotes (escapes `"` as `\"`)
- Added diagnostic `console.error` logging on parse failure that dumps the first 500 chars of the raw body — makes failures diagnosable rather than silently dropped

**Result:** Build passed.
