# Project Insomnia — Voice Sheet

A working reference for writing and editing posts. Drop into a system
prompt, keep open while editing, or grep against a draft.

## Where the voice actually is

The bones are fine. Lines like *"I am a person with too many computers.
This is not a flex — it's a confession"* and *"a desk that looks like a
NASA control center designed by someone with a Costco membership and a
problem with monitor stands"* are the actual voice, and an LLM is not
going to produce them by accident.

The problem is not the prose at the sentence level. It is five specific
structural habits that pull the rhythm toward the generic AI-essay
register:

1. Bold lead-ins on numbered lists (`**Thing.** Sentence about thing.`)
2. "X. Then Y." headlines
3. Italicized parallelism for emphasis (*what happened* / *the full story*)
4. Stock end-of-post section sequence: "Hard Problems → What I'd Do
   Differently → What's Next"
5. Em-dash density doing structural sentence-clause work

Strip those and the rest is already a distinct voice.

## Voice anchors

- **Ferris in a server room.** Self-aware narrator who knows he's getting
  away with something and lets the reader in on it. Not Airplane (no
  joke-per-line). Not Lileks (no set-piece monologues). Just a guy
  explaining what happened with the comic timing intact.
- **Authority by exhaustion, not by credential.** Standing comes from
  "I've been paged for this so many times I'm writing a tool to fix it,"
  not from "I have been a Principal SRE for X years." The complaint is
  the credential.
- **Specifics over abstractions, always.** Patrick McKenzie grade. Name
  the tool, the version, the port number, the row count, the dollar
  amount. If the post does not contain a number or a proper noun by
  paragraph three, something is wrong.
- **Dry one-liner at the end of a beat, not the start.** Setups go on
  the front, payoffs go on the back. This is comedy, not opinion writing.
- **The aside is the voice.** Parentheticals like *(ideally)*,
  *(for now)*, *(install via brew install displayplacer)* — these carry
  more of you than the body text does. Keep them.

## Yes

Moves to keep doing or do more of:

- **Confessional openers.** "I am a person with too many computers. This
  is not a flex — it's a confession." This format is yours. It scales.
- **Concrete weird metaphors.** NASA-control-center-by-way-of-Costco.
  Five-Act Tragedy for an NFS locking story. These are the lines people
  quote. Reach for one per post, save them for war stories.
- **The investigative march.** "Approach 1 didn't work. Here's why.
  Approach 2 didn't work. Here's why. Approach N actually worked." The
  Hammerspoon → osascript → Karabiner → Deskflow chain in the Synergy
  post is exactly this and it's the strongest section in the piece.
- **The micro-sentence closer.** "It works. I'll take it." "I've made
  my peace with this… for now." Use when earned. Do not use as a
  default outro.
- **Mid-paragraph self-correction.** "After enough muttering, I started
  actually looking at the numbers." The narrator catching himself is
  more effective than the narrator declaring expertise.
- **One real opinion per technical post.** Not a thesis. A line. ("If
  you're reaching for `unix-none` VFS, you need iron-clad single-writer
  guarantees or you will corrupt your database.")

## No

Greppable problems. These are mostly mechanical and easy to fix:

- **Bold lead-ins on numbered lists.** `1. **Zero operational overhead.**
  No database pod...` Replace with a regular paragraph or a sentence-led
  list. The bold-lead-in pattern is the single most identifiable
  AI-essay tic in your work.
- **"X. Then Y." headlines.** "I Solo-Built a Production Observability
  Platform. Then I Got Laid Off by Email." This works for LinkedIn
  engagement and against your voice. Other patterns work better for
  you: a specific weird detail ("The Mac Mini Has a Thunderbolt Port.
  The Simulator Doesn't Know That.") or a confession-framed-as-service
  ("The Synergy Multi-Monitor Rabbit Hole I Fell Into So You Don't Have
  To").
- **Italicized parallelism.** *"Pageout data tells you what happened.
  Notification data tells you the full story."* Cut the italics. Better,
  cut the parallelism — it's a triadic rhythm move and you don't need it.
- **Triadic rhetorical constructions.** "the technical reality, the
  political reality, the operational reality." Threes have a strong
  rhythm and that rhythm is now the AI-essay rhythm. Twos and fours are
  quietly more yours.
- **Stock section sequence.** "Hard Problems → What I'd Do Differently
  → What's Next" is fine once. Used as a default it becomes a template.
  Vary it. The Synergy post's structure is better — it's organized by
  the actual investigation.
- **The flagged words.** *"shape"* and *"load-bearing."* Greppable.
  Should be zero per post unless literally describing something's shape
  or load-bearing capacity. The Deason piece uses both heavily.
- **Em-dash overuse.** Em-dashes are fine. Em-dashes carrying clause
  structure for 20% of your sentences is not. Target: under 5 per 1000
  words. Convert most to commas, periods, or parens.
- **"Let me X, because Y." / "Here is the narrow claim I am willing to
  make." / "You may now be asking."** These are AI-essay
  performative-hedging moves. You don't use them much. Don't start.
- **Performative epistemic humility.** "I want to be careful here,
  because every piece of writing about tech in 2026 contains an
  obligatory paragraph about how the AI shift changes everything." Just
  make the claim or don't.
- **Negative parallelism.** "It's not a tool. It's a discipline." "This
  is not a flex" is a confessional move and works; "it's not X, it's Y"
  used as rhetorical structure is the AI register. Watch for the
  difference. The Wikipedia AI-writing page calls this out as a top tell.
- **False ranges.** "From late-night incidents to leadership reviews."
  The "from X to Y" construction implies a spectrum that usually isn't
  there. If the two endpoints aren't actually the ends of a continuum,
  the construction is fake.
- **Compulsive summaries.** "Overall," "In conclusion," "To summarize"
  — and the tendency to restate what was just said. Long posts can earn
  a closing paragraph; that paragraph should not begin with a summarizing
  transition word.
- **Sourceless collective opinion.** "Many engineers feel," "modern SREs
  argue," "the consensus is." Either name the people or drop the claim.
  This is one of the most reliable AI tells because LLMs invent the
  consensus to fill space.
- **Puffery via abstraction.** "This represents a pivotal shift in how
  organizations approach observability." Generic enough to apply to
  anything, which is why an LLM produced it. If the sentence would also
  work in a press release for a different product, cut it.
- **Uniform paragraph length.** AI text tends toward visually identical
  paragraphs — three to five sentences each, repeating. Vary on purpose.
  Your shortest paragraph in a post should be one sentence. Your longest
  can run.

## Banned vocabulary

A greppable list. Most of these are flagged by the Wikipedia
AI-writing-signs page as canonical LLM tells; the rest are tics specific
to tech writing.

**General AI-vocabulary blacklist** — these words have been so heavily
used by LLMs that they now read as machine-written regardless of context:

`delve`, `intricate`, `tapestry`, `pivotal`, `underscore` (verb),
`landscape` (metaphor), `foster` (verb), `testament`, `enhance`,
`crucial`, `seamless`, `robust`, `leverage` (verb), `comprehensive`,
`navigate` (metaphor), `ecosystem` (metaphor)

**Tech-blog-specific blacklist** — purple verbs and tired figures:

`dance` (for any technical back-and-forth: handshakes, key exchanges,
polling, request/response — the protocol does not dance), `choreography`
/ `ballet` (same problem), `under the hood`, `deep dive` / `dive into`,
`unpack` (verb, for explaining), `elegant` (as default praise — say what's
specifically good about it instead)

**Filler phrases**:

`it's worth noting`, `it's important to remember`, `at the end of the
day`, `that said` (as transition), `needless to say`

These aren't blanket bans on the underlying concepts. "Foster" the noun
is fine. A literal handshake protocol is fine. Cryptographic key
exchanges are technical terms, not metaphors. The bans are on the
metaphorical/promotional uses where the word is doing rhetorical work it
shouldn't be doing.

Add to this list as you spot more in your own drafts. The list is a
tool, not gospel.

## Two modes

You're writing in two registers and they shouldn't sound identical.

### Essay / observation posts

Examples: *"I Solo-Built..."*, *"Building a Website For Someone Who
Actually Uses It"*, *"how to corporate"*

Reader: peers, hiring managers, people who follow the blog.
Voice: Patrick McKenzie + your humor. Long, specific, war-storied. Take
your time. The narrator is the point.

### SEO how-to posts

Examples: *Synergy*, *Keychain*, *SecureToken*, *Plex*, *Garmin*

Reader: a frustrated stranger from Google search who has the exact
problem you had.
Voice: same person, but tactical. Lead with **the symptom and the
punchline of the fix in the first 200 words.** Then the deep dive. Then
the personality. The reader's first job is "am I in the right place."
Make that decision easy for them.

The Synergy post does this well in the back half (the "Useful Bits,
Summarized" numbered list at the end) but the opening NASA-Costco
paragraph buries the problem for two scrolls. For SEO posts, consider:
confession-paragraph as voice signature, then immediately a "tl;dr the
symptom is X, the fix is Y, here's why" block, *then* the war story.

## Headlines

Three patterns work for your voice:

- **Specific weird detail.** "The Mac Mini Has a Thunderbolt Port. The
  Simulator Doesn't Know That." This one's already yours. The mismatch
  between two technically true facts.
- **Confession framed as service.** "The Synergy Multi-Monitor Rabbit
  Hole I Fell Into So You Don't Have To." Old-school web-blog title;
  works.
- **Keyword-stuffed how-to.** "Unlocking the Login Keychain Over SSH on
  a Headless Mac." Fine for SEO posts. Don't dress it up.

The pattern to drop is **"X. Then Y."** It's the LinkedIn hook style and
it homogenizes you toward every other Substack tech writer.

## Voice check (run before publishing)

A short checklist. Most of these are greps; a few are reads.

- [ ] **Em-dash count under 5 per 1000 words.**
  `grep -o '—' post.md | wc -l`
- [ ] **Banned-vocab grep.** Run a single grep against the list above.
  Aim for zero hits, then justify any exceptions one at a time.
- [ ] **Zero "load-bearing" and zero "shape"** (unless literal).
- [ ] **Zero "dance"** for any non-literal use. The protocol doesn't
  dance.
- [ ] **Negative-parallelism scan.** Search for `It's not` / `It is not`
  followed within 20 words by `it's` / `it is`. If the pattern is doing
  structural work, rewrite.
- [ ] **"From X to Y" scan.** If the spectrum isn't real, kill it.
- [ ] **Numbered lists scanned**: any `\d\. \*\*[^*]+\.\*\*` patterns?
  Convert to prose.
- [ ] **Headline read aloud.** Does it sound like a LinkedIn post? If
  so, reframe.
- [ ] **Italics audit.** Italics for *emphasis-by-parallelism* — cut.
  Italics for technical terms, foreign words, or actual emphasis — keep.
- [ ] **Paragraph-length variance.** Skim the post's right edge. If
  every paragraph is the same visual block, break some up or fuse
  others.
- [ ] **First three paragraphs contain at least one McKenzie-grade
  specific** (number, version, dollar, named tool).
- [ ] **Last sentence is doing work or is the earned dry close.** Not
  filler. Not "Overall," not "In conclusion."
- [ ] **One concrete weird metaphor or specific aside per post.** If
  the draft is sterile, you're hiding.
- [ ] **For SEO posts: symptom + one-paragraph fix appears before the
  200-word mark.**
- [ ] **For essay posts: one real opinion stated as a line.**

## What's not on this sheet

This sheet doesn't say "use deadpan humor" or "be self-deprecating"
because those are already in the voice. The risk is not that the humor
disappears. The risk is that the structural drift makes the humor land
in a register that reads as generic.

Fix the structural tics, run the voice check, keep doing what you're
already doing in the lines quoted at the top of this document. The
voice is there. It's getting buried under formatting.
