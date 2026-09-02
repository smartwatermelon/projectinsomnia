---
title: "My Gmail Filter Hit a Character Limit. The Fix Was to Stop Using Gmail Filters."
date: 2026-09-02
description: "Gmail caps the length of a filter's from: field, and mine was full at 698 characters across 24 senders. Combining what I could bought back 61 characters. The real fix was a Google Apps Script that reads senders from a Sheet, so adding a newsletter means tagging one message instead of editing a string. Plus the Gmail query injection I found in my own address parsing, and the production bug 49 passing tests could not have caught."
tags: ["tech", "gmail", "apps-script", "google", "security"]
---

I subscribe to too many newsletters. Twenty-four sender addresses, `OR`ed together in a single Gmail filter, 698 characters long, all of them labeling to `.Newsletters`.

Gmail has a length limit on a filter's `from:` field. I know this because I tried to add a twenty-fifth newsletter and Gmail declined to accept the clause.

If you got here from a search for why Gmail won't save your filter: the criteria field is a literal string with a hard cap, and there is no include mechanism, no variable, no way to point a filter at a list maintained somewhere else. Your two real options are to split the filter into several smaller ones that all apply the same label, or to move the sender list out of Gmail filters entirely and drive the labeling from a script. I did the first one to get unblocked and then went and did the second one properly. The script is [on GitHub](https://github.com/smartwatermelon/gmail-newsletter-filter), MIT licensed.

## What could be combined, which was not much

Before doing anything structural I checked whether the list was simply inefficient. Parsing all 24 addresses by domain found exactly two things to do.

Two senders shared the `example-newsletter.email` domain, one at `one@` and one at `two@`, so they collapsed to `*@example-newsletter.email`. And one address was already dead weight: `john-doe@example-platform.com` was in the list alongside `*@example-platform.com`, which already matched it. The wildcard had been added later and nobody (me) removed the specific entry it superseded.

That's 698 characters down to 637, and 24 entries down to 22.

Sixty-one characters of headroom buys roughly three more newsletters. The wall was still there. I had just moved it far enough away that I could stop looking at it for a week. Any static list hits the same cap eventually, and the only question is when.

There's also a detail that turns this from an annoyance into a genuine chore: Google doesn't expose the filter settings pane in the Gmail iOS app at all. Editing a 637-character string is a thing you do at a desk, or very painfully in mobile Safari with "request desktop site," followed by a Maxalt.

## The option I rejected

Splitting the filter is the obvious native answer, and I want to give it its due. You break the one OR-list into `Newsletter-1` and `Newsletter-2`, both adding `.Newsletters`, and you're done. Zero new infrastructure, zero authorization prompts, nothing to maintain that isn't already a thing Gmail does. My mailbox already used this exact pattern elsewhere: four separate filters all applying a `wrong Andrew Rich` label to four different senders who keep giving out my address.

> By the way, all other Andrew Riches on the Internet: `andrew.rich@gmail.com` is mine, it's been mine since April 22, 2004, and it would be really terrific if you could stop giving `andrew.rich@gmail.com` to every single reservation and rental car and mobile phone operator and porn site you join. No judgment, I'm just tired of filtering it.

The reason I didn't stop there is that it doesn't fix anything, it just buys a second bucket. You still hand-maintain N strings instead of one, split at whatever arbitrary point the first one filled up, and the next time you add a newsletter you get to remember which bucket has room. It converts a character-limit problem into a filing problem.

## Moving the list somewhere it can grow

The alternative is to keep the sender list in a Google Sheet and have a Google Apps Script do the labeling on a timer, using the Gmail API. No character limit, because a spreadsheet column isn't a filter criteria field.

My first design did exactly that and solved the wrong problem. It read a sheet of addresses every fifteen minutes and applied the label to anything matching. Character limit: gone. Maintenance: identical. I had replaced "edit a long string in a settings pane" with "add a row to a spreadsheet," which is the same chore in a nicer window. Past-me was pleased with this for about a day.

What actually closes the loop is making the *mail* teach the script, so the flow is Gmail-native and needs no new interface:

1. A newsletter shows up that isn't being labeled. I tag it `to-be-filtered`.
2. On its next run, the script finds anything carrying that tag.
3. It reads the sender out of the `From` header and appends it to the sheet if it's new.
4. It removes the `to-be-filtered` tag.
5. That same run applies the target label to that sender's mail, including everything they have ever sent me, not just the message I tagged.

Step five is where the design got simpler instead of more complicated. An earlier version had two code paths: one to backfill a newly added sender's history, one to label a known sender's incoming mail. Folding them into a single query per address, `from:"address" in:anywhere`, skipping anything that already carries the label, meant one path does both jobs. A sender learned thirty seconds ago gets their entire history swept up on the next run. A sender known for six months gets skipped fast, because everything they've sent already has the label and there's nothing left to modify.

I match on the full address rather than the domain, because `*@mail.example.com` risks catching unrelated senders who happen to use the same mail platform. It runs every fifteen minutes. And when a new sender is added, it sweeps inbox, spam, and trash, not just mail arriving from that point forward.

The script uses the Gmail *advanced* service (`Gmail.Users.Messages.*`) rather than the built-in `GmailApp`, because it needs precise control over `addLabelIds` and `removeLabelIds`. Removing `Spam` is the specific reason: `GmailApp` has no direct method for it, and the advanced service exposes the same primitives Gmail's own filters use.

(I built this with Claude, and was very happy to have a virtual rubber duck to bounce the work off. The first draft was the one that still made me maintain a spreadsheet by hand; the useful part of the session was noticing that and saying so.)

## Two things worth stealing from the repo

The delivered script became a small repository. Two parts of it took far longer than the labeling logic did, and both are things I would have skipped in a one-off script.

**The `From` header is attacker-controlled text, and I was splicing it into a query.** The script takes whatever is between the angle brackets and builds `from:"..."` out of it. My first version filtered that input with a denylist, which blocked the obviously bad characters and missed the ones that matter: Gmail's query language uses `{` and `}` for OR-groups, a leading `-` for negation, `*` as a wildcard, and `:` as an operator separator. A crafted `From` header carrying any of those can break out of the quoted clause and change what the query matches. In a script whose job is bulk-modifying labels on mail, that is not a theoretical concern.

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

The general rule: a denylist is correct until the language it's guarding grows a new metacharacter, and then it's silently wrong. An allowlist stays correct when Google ships new query syntax, because new syntax isn't on it. The test suite encodes the whole history: query injection via an embedded quote, OR-group and wildcard syntax, Unicode confusables, and a zero-width BOM, all asserted to be rejected.

**Forty-nine passing tests could not have caught the bug that actually shipped.** The suite is real; it loads the actual `.gs` file into a Node `vm` with the four Apps Script globals stubbed, and anything not explicitly stubbed is a `Proxy` that throws on access, so a test that wanders into a live Gmail call fails loudly instead of passing quietly. I ran it again while writing this post. Forty-nine tests, forty-nine pass, no `node_modules` directory anywhere.

And it verified nothing about the call I got wrong. I wrote `Gmail.Users.Messages.modify('me', ...)`, putting the user ID first. The advanced service's signature is body first, user ID second, so the string `'me'` went out as the JSON payload, and Gmail returned `Invalid JSON payload received`. Because the harness stubs all I/O, it can check every branch of logic *around* an API call and knows nothing about that call's actual signature. That one's preserved in the repo's `CLAUDE.md` as both the fix and the warning.

## Where it landed

The script coexists with the original native filter without conflict, since already-labeled mail is exactly what the second pass skips. I left the filter in place. It works, and turning it off would be a change with no upside.

What changed is the maintenance loop. Adding a newsletter used to mean opening a laptop, finding the filter settings pane, and editing a 637-character string with 22 clauses in it. Now it means tagging one message on my phone and waiting fifteen minutes for it to swallow the sender's entire history.

The character limit is still there. I just don't have a filter long enough to hit it.
