---
title: "The Apps Script That Replaced My Gmail Filter Failed 97.89% of the Time"
date: 2026-11-23
description: "Gmail caps the length of a filter's from: field, so I moved my newsletter list into a Google Sheet and let Apps Script do the labeling. Three months later the trigger showed a 97.89% error rate, Google's failure digest had never sent a single email, and an optimization described in the first write-up was the cause. What broke, what I changed, and how the script works now."
tags: ["tech", "gmail", "apps-script", "google", "security"]
---

In September I [wrote up](/blog/gmail-filter-character-limit/) how I replaced a Gmail filter with a Google Apps Script. This post replaces that one. The original design is all here, along with the parts of it that were wrong.

The short version: it worked, in the sense that newsletters got labeled. It was also failing on almost every run, quietly, for longer than I can prove, and one sentence in the first post described the bug.

If you got here from a search for why Gmail won't save your filter: the `from:` criteria field is a literal string with a hard length cap. There is no include mechanism, no variable, and no way to point a filter at a list kept somewhere else. Your two real options are to split the filter into several smaller ones that all apply the same label, or to move the sender list out of Gmail filters entirely and drive the labeling from a script. I did the first to get unblocked and the second to fix it. The script is [on GitHub](https://github.com/smartwatermelon/gmail-newsletter-filter), MIT licensed.

## The original problem

I subscribe to too many newsletters. Twenty-four sender addresses, `OR`ed together in a single Gmail filter, 698 characters long, all of them labeling to `.Newsletters`. I tried to add a twenty-fifth and Gmail declined to accept the clause.

Before doing anything structural I checked whether the list was simply inefficient. Parsing all 24 addresses by domain found exactly two things to do. Two senders shared the `example-newsletter.email` domain, one at `one@` and one at `two@`, so they collapsed to `*@example-newsletter.email`. And `john-doe@example-platform.com` was in the list alongside `*@example-platform.com`, which already matched it. The wildcard had been added later and nobody (me) removed the entry it superseded.

That took it from 698 characters to 637, and from 24 entries to 22. Sixty-one characters of headroom buys roughly three more newsletters. I had moved the wall far enough away that I could stop looking at it for a week; any static list hits the same cap eventually.

There's also a detail that turns this from an annoyance into a chore: Google doesn't expose the filter settings pane in the Gmail iOS app at all. Editing a 637-character string is a thing you do at a desk, or very painfully in mobile Safari with "request desktop site," followed by a Maxalt.

## The option I rejected

Splitting the filter is the obvious native answer, and it deserves its due. You break the one OR-list into `Newsletter-1` and `Newsletter-2`, both adding `.Newsletters`, and you're done. Zero new infrastructure, zero authorization prompts, nothing to maintain that isn't already a thing Gmail does. My mailbox already used this exact pattern elsewhere: four separate filters, all applying a `wrong Andrew Rich` label to four different senders who keep giving out my address.

> By the way, all other Andrew Riches on the Internet: `andrew.rich@gmail.com` is mine, it's been mine since April 22, 2004, and it would be really terrific if you could stop giving `andrew.rich@gmail.com` to every single reservation and rental car and mobile phone operator and porn site you join. No judgment, I'm just tired of filtering it.

I didn't stop there because splitting doesn't fix anything; it buys a second bucket. You still hand-maintain N strings instead of one, split at whatever arbitrary point the first one filled up, and the next time you add a newsletter you get to remember which bucket has room. It converts a character-limit problem into a filing problem.

## Moving the list somewhere it can grow

The alternative is to keep the sender list in a Google Sheet and have Apps Script do the labeling on a fifteen-minute timer, through the Gmail API. A spreadsheet column isn't a filter criteria field, so there's no character limit.

My first design did exactly that and solved the wrong problem. It read a sheet of addresses and labeled anything matching. Character limit: gone. Maintenance: identical. I had replaced "edit a long string in a settings pane" with "add a row to a spreadsheet," which is the same chore in a nicer window. Past-me was pleased with this for about a day.

What actually closes the loop is making the *mail* teach the script, so the whole flow happens in Gmail, on a phone:

1. A newsletter shows up that isn't being labeled. I tag it `.to-be-filtered`.
2. On its next run, the script finds anything carrying that tag.
3. It reads the sender out of the `From` header and appends it to the sheet if it's new.
4. It removes the tag.
5. The same run labels that sender's mail, including everything they have ever sent me, not just the message I tagged.

Step five is where the design got simpler. An earlier version had two code paths: one to backfill a new sender's history, one to label a known sender's incoming mail. Folding them into a single query per address meant one path does both jobs. A sender learned thirty seconds ago gets their whole history swept up on the next run, from inbox, spam, and trash.

I match on the full address rather than the domain, because `*@mail.example.com` risks catching unrelated senders who happen to use the same mail platform.

The script uses the Gmail *advanced* service (`Gmail.Users.Messages.*`) rather than the built-in `GmailApp`, because it needs precise control over `addLabelIds` and `removeLabelIds`. Removing `SPAM` is the specific reason: `GmailApp` has no direct method for it, and the advanced service exposes the same primitives Gmail's own filters use.

I built this with Claude, both times. The first session's useful moment was noticing that version one still had me maintaining a spreadsheet by hand. The second session's was less flattering to both of us, and it's most of the rest of this post.

## The sentence I got wrong

Here is what the first post said about known senders, verbatim:

> A sender known for six months gets skipped fast, because everything they've sent already has the label and there's nothing left to modify.

Nothing left to modify, yes. Nothing left to *read*, no. The query was `from:"address" in:anywhere`, so Gmail returned every message from that sender, labeled or not. The script then fetched each one with `messages.get` to find out that it already had the label, and skipped it. The skip was free. The fetch that decided to skip cost 5 quota units, every message, every run.

A per-sender cap of 200 messages per run kept any one sender from eating a whole run. With 18 senders in the sheet that is still up to 3,600 reads a run, 18,000 units, against Gmail's limit of 15,000 units per user per minute. Runs hit the quota, threw, and stopped partway through. Each run still labeled some mail before it quit, which is why nothing looked broken from the inbox.

The cap had a second effect I'd missed: it counted messages *examined*, newest first. A sender with more than 200 messages in the archive never got past their newest 200 already-labeled ones, so their older mail was never reached at all. When I finally counted, Gmail estimated about 474 unlabeled messages from senders the script supposedly handled.

The fix was one search term. The query now excludes mail that already carries the label:

```javascript
function buildSenderQuery_(address, suffix, excludeLabelName) {
  if (!isValidSenderAddress_(address)) {
    throw new Error('invalid sender address: ' + JSON.stringify(address));
  }
  const parts = ['from:"' + address + '"'];
  if (excludeLabelName) parts.push('-label:' + labelSearchTerm_(excludeLabelName));
  if (suffix) parts.push(suffix);
  return parts.join(' ');
}
```

That produces `from:"x" -label:.newsletters in:anywhere`. I wasn't sure Gmail search would accept a label whose name starts with a dot, so I tested it read-only against one sender before shipping it. It does. A steady-state run now asks Gmail only for unlabeled mail and reads almost nothing. The backlog of 474 took a few runs to clear, quota-limited the whole way, and then the errors stopped.

The general rule: a no-op is only free if deciding it's a no-op is free. Put the filter in the query, where the server applies it, not in a loop that pays per item to discover there was nothing to do.

## The alert that never fired

The worse discovery was how I found out. I didn't. I was in the Apps Script editor for an unrelated change, ran the script by hand, and got a quota error.

The trigger's failure notifications were set to "Notify me daily." The Triggers page showed a 97.89% error rate. The Executions list, filtered to failed time-driven runs, ran 200 entries deep on its first page without a gap, back two days, and said "page 1 of many." My mailbox contained no email from Apps Script about any of it, in any folder, trash included, for at least 90 days. The trigger's owner was my own account. I don't know why Google never sent the digest. I do know I can't rely on it.

So the script sends its own. `runNewsletterAutoLabel` is now a thin `try`/`catch` around the actual work:

```javascript
function runNewsletterAutoLabel() {
  try {
    runPasses_();
  } catch (e) {
    notifyFailure_(e);
    throw e;
  }
  clearAlertThrottle_();
}
```

On failure it emails me the error with a link to the Executions page, then rethrows, so Executions still records the run as Failed. `notifyFailure_` never throws itself; a mail problem must not mask the real error. A failure that repeats every fifteen minutes would mean 96 emails a day, so it sends at most one every 6 hours, tracked in a Script Property called `lastAlertAt`.

The first version of the throttle had a bug I found by using it. I tested the alert by breaking the config on purpose, got the email immediately, fixed the config, and the throttle stayed set. A real failure in the next six hours would have sent nothing, and the only reset was deleting the property by hand in the editor. Now a successful run clears it. The throttle covers one continuing failure, and the first failure after a recovery emails at once.

One more behavior changed for the same reason. A missing `.Newsletters` label used to write a log line, which nobody reads. It now throws, because a throw is what reaches the email.

What this does not cover: a run that never starts. A script can't email you about not running. The standard answer is an outside watchdog the script pings on every success, which emails you when the pings stop. I decided failure emails were enough for a newsletter filter. If the trigger itself vanishes, I'll find out the old way, in about three months.

The lesson is plain: an alert you have never seen fire is not an alert. Break the thing on purpose once and check your inbox.

## Taking a sender back out

The first version had no way to remove a sender except opening the sheet and deleting a row. Now there's a second label, `.remove-from-filter`. Tag a message with it, and the next run deletes that sender's rows from the sheet and strips the tag. Mail that is already labeled stays where it is; the script only stops labeling future mail.

Both labels now start with a dot, which sorts them to the top of Gmail's label list beside `.Newsletters`. That was the entire reason. It's a good reason.

Removal is the one operation in this script that isn't idempotent, and that matters because runs overlap. A slow run can still be going when the next trigger fires. Everything else was written so overlap is harmless: labeling an already-labeled message changes nothing, and a known address isn't appended twice. Deleting a row by index is different. Before shipping, a review pass found this scenario: two overlapping runs both see the same removal request, both read the sheet and find the sender in row 5, and both delete row 5. The second delete removes whichever sender moved up into row 5, with no log entry. That sender just stops being filtered.

So the read and the deletes run under `LockService.getScriptLock()`, with no Gmail call in between, deleting rows highest first so each delete leaves the remaining indexes valid. The pass is capped at 100 removal requests per run, and a failure in it is logged rather than allowed to stop the labeling pass that follows.

The three passes run in a fixed order, and the order matters: learn new senders, then remove senders, then label. Removal has to come before labeling, or the same run relabels the sender it was asked to forget. It comes after learning, so a sender tagged with both labels ends up removed.

## Retiring most of the native filter

The first post ended with the native filter left in place, because the two coexisted fine. That was true and also confusing. Almost three months later I looked at the sheet, wondered where half my newsletters were, and remembered they lived in the filter.

I exported the filter as `mailFilters.xml`. It held 24 senders. Twenty-one were exact addresses and moved into the sheet, for 39 rows total. Their backfill cost nothing, because the native filter had already labeled their mail and the new query skips labeled mail.

The other three stayed in the native filter, because they're wildcards: `*@creator.patreon.com`, `*@substack.com`, and `*@buttondown.email`. The script refuses `*` on purpose, for the reason in the next section. The native filter's `from:` field went from 24 addresses to three. The character limit is still there; it just has nothing to do with me anymore.

## The `From` header is attacker-controlled text

This part is unchanged from the first version, and it's still the part worth stealing.

The script takes whatever is between the angle brackets in a `From` header and builds `from:"..."` out of it. My first version filtered that input with a denylist, which blocked the obviously bad characters and missed the ones that matter. Gmail's query language uses `{` and `}` for OR-groups, a leading `-` for negation, `*` as a wildcard, and `:` as an operator separator. A crafted `From` header carrying any of those can break out of the quoted clause and change what the query matches. In a script whose job is bulk-modifying labels on mail, that is not a theoretical concern.

The fix was to stop enumerating what's forbidden and enumerate what's allowed:

```javascript
function isValidSenderAddress_(value) {
  if (typeof value !== 'string') return false;
  const v = normalizeAddressPadding_(value);
  // `-` is legal inside a local part (no-reply@) but is Gmail's negation
  // operator at the start of a term, so it is barred from first position.
  return /^[a-z0-9._%+][a-z0-9._%+-]*@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(v);
}
```

A denylist is correct until the language it guards grows a new metacharacter, and then it's silently wrong. An allowlist stays correct when Google ships new query syntax, because new syntax isn't on it. The same check runs on rows read from the sheet, because the sheet is hand-editable and junk can arrive without ever passing through the header parser. The new `-label:` term got the same treatment: `labelSearchTerm_` throws on a label name outside its own allowlist instead of trying to escape it.

## What 88 passing tests can't see

The test suite loads the actual `.gs` file into a Node `vm` with the Apps Script globals stubbed. Anything not explicitly stubbed is a `Proxy` that throws on access, so a test that wanders into a live Gmail call fails loudly instead of passing quietly. No build step, no generated copy, no `node_modules`: the file I edit is the file that runs is the file that's tested. It was 49 tests stubbing four globals in September. It's 88 tests stubbing seven now: `Gmail`, `SpreadsheetApp`, `ScriptApp`, `LockService`, `MailApp`, `PropertiesService`, and `Session`.

The first post's lesson here was that the suite couldn't catch an API signature bug. I wrote `Gmail.Users.Messages.modify('me', ...)`, user ID first; the advanced service wants the request body first, so the string `'me'` went out as the JSON payload and Gmail answered `Invalid JSON payload received`. A harness that stubs all I/O checks every branch of logic *around* a call and knows nothing about the call itself.

The quota bug is the same lesson, bigger. Every test passed, because every test was right: the logic did exactly what it said. A stub answers instantly and charges nothing, so a suite built on stubs can't tell you that correct code costs 18,000 units a run. Signatures, quota, latency, and whether Google sends the email you configured all live outside what a stub can model. The only test for those is the real thing, and sometimes the real thing is a person opening the Executions page.

One error from that cleanup I still can't explain: a single `messages.get` failed with `Precondition check failed` and never recurred. My best guess, and it is only a guess, is a message changing under two overlapping runs.

## Where it landed

Adding a newsletter still means tagging one message on my phone and waiting fifteen minutes. Removing one is now the same gesture with a different label. When something breaks, I get one email about it instead of none, and when it recovers, the script resets itself. After the initial setup, the only reason to open the Apps Script editor is pasting in a new version, and that no longer means re-typing the Sheet ID, which moved into a Script Property that survives the paste.

The trigger's error rate was 97.89% when I found it. I'd like to tell you what it is now, but the honest answer is that I'll know when it emails me.

Code: [smartwatermelon/gmail-newsletter-filter](https://github.com/smartwatermelon/gmail-newsletter-filter).
