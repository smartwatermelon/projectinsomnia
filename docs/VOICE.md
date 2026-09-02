# Project Insomnia — Voice Sheet

A working reference for writing and editing posts. Drop into a system
prompt, keep open while editing, or grep against a draft.

## Scope: this is an overlay

This sheet covers one surface: blog posts in this repo. It is not the
master voice guide.

The master lives outside this repo, at `~/.config/personify/VOICE.md`, and
is loaded by the `personify` skill. It describes how the author writes
everywhere: blog, email, work records, PR comments. It is personal, is
git-ignored like `.env`, and is deliberately not published.

**The master wins on any conflict.** This sheet holds only what is
specific to publishing here: the essay/how-to split, headline patterns,
the narrator, and the pre-publish checks. General anti-AI-tell rules are
not repeated here, because `personify` already applies them and a second
copy drifts out of sync with the first.

Two rules this sheet used to state as flat bans, corrected to match the
master, which treats both as deliberate moves rather than tells:

- **Bold lead-ins** are allowed in technical posts for scannability. Watch
  for them as an unbroken default across a whole post, not as a pattern.
- **Triads** are a real device the author uses on purpose. Flag the
  unearned, pattern-completed three, not every three.

If something here contradicts the master, the master is right and this
sheet needs an edit.

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

- **Bold lead-ins used as the default list format.** `1. **Zero
  operational overhead.** No database pod...` The master allows these in
  technical writing, where they genuinely aid scanning. The tell is not
  the pattern, it is the absence of any other pattern: every list in a
  post built the same way. Vary it, and convert to prose or a
  sentence-led list where the label is not earning anything.
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
- **Unearned triads.** "the technical reality, the political reality, the
  operational reality." The master protects deliberate threes ("One
  finish. Two DNFs. Three withdrawals.") as a real device. What to catch
  is the pattern-completed one, where the third item exists because two
  felt short. Test: cut the third. If nothing is lost, it was rhythm
  filler.
- **Stock section sequence.** "Hard Problems → What I'd Do Differently
  → What's Next" is fine once. Used as a default it becomes a template.
  Vary it. The Synergy post's structure is better — it's organized by
  the actual investigation.
- **The flagged words.** *"shape"* and *"load-bearing."* Greppable.
  Should be zero per post unless literally describing something's shape
  or load-bearing capacity. One earlier post leans on both heavily.
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
- **Uniform paragraph length.** AI text tends toward visually identical
  paragraphs, three to five sentences each, repeating. Vary on purpose.
  Your shortest paragraph in a post should be one sentence. Your longest
  can run. Kept here because it is a visual property of a published page,
  which is a blog concern rather than a sentence-level one.

**Handled by `personify`, not repeated here.** False ranges ("from X to
Y" where no spectrum exists), compulsive summaries ("Overall," "In
conclusion"), sourceless collective opinion ("many engineers feel"),
puffery via abstraction, the AI-vocabulary list (`delve`, `pivotal`,
`robust`, `leverage`, and the rest), the tech-blog purple-verb list
(`dance` for a protocol, `under the hood`, `deep dive`), and filler
phrases (`it's worth noting`, `at the end of the day`). Running the skill
covers all of these, and its taxonomy is maintained. A second copy here
would drift out of sync and eventually contradict it, which is exactly
what happened with the bold-lead-in and triad rules above.

The two flagged words specific to this blog, `shape` and `load-bearing`,
stay on this sheet because they are personal tics rather than general
tells.

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

Run `personify` on the draft first. It catches the general tells, using
the master voice guide, so this list covers only what is left: blog
structure, and the two personal flagged words.

- [ ] **`personify` has been run on the draft.** Everything below assumes
  it has. Do not hand-grep the vocabulary and phrasing tells it already
  covers.
- [ ] **Em-dash count under 5 per 1000 words.**
  `grep -o '—' post.md | wc -l` (blog register keeps the dash as voice;
  the master sets the count to zero only in work records, which this is
  not)
- [ ] **Zero "load-bearing" and zero "shape"** (unless literal).
- [ ] **Numbered lists scanned**: are all of them `\d\. \*\*[^*]+\.\*\*`?
  One or two is fine and often better. Every list in the post built that
  way is the tell.
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
