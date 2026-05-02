---
title: "I didn't ship anything this week"
date: 2026-05-02
description: "160 PRs across two GitHub orgs, every one green, exactly zero of them a feature. A week of plumbing — Claude review workflow v3, a Dependabot trusted-namespace policy, CI security hardening, and a tech-debt scheduler that finally finishes the night."
tags: ["tech", "ci", "github-actions", "claude", "tools"]
---

My merge graph this week looks like a man with something to prove: 160 PRs across two GitHub orgs, every one green, exactly zero of them a feature. None of my actual products has a new button. [Kebab Tax](https://kebab.tax) users see what they saw on Monday. What I have instead is a small empire of side projects whose plumbing is slightly less suspicious than it was on Sunday, and I'm calling that a good week.

Specifically: a major version of my Claude review workflow rolled out to everywhere it lives, a Dependabot policy change that paid for itself overnight, CI security hardening I'd been embarrassed about for months, and a nightly tech-debt scheduler that finally runs to completion.

## claude-blocking-review v3

The biggest thread was a major-version release of [claude-blocking-review](https://github.com/smartwatermelon/github-workflows), my reusable workflow that runs Claude Code as a blocking PR reviewer. v3 [drops the `--max-turns` cap](https://github.com/smartwatermelon/github-workflows/pull/62), which I had originally added as a guardrail and later realized was solving the wrong problem. Chunked reviews already bound the work; the cap was just truncating Claude's reasoning mid-thought.

A few related improvements landed in [claude-config](https://github.com/smartwatermelon/claude-config), the repo that owns the reviewer's prompt and behavior. [#149](https://github.com/smartwatermelon/claude-config/pull/149) passes commit-message context to the chunked reviewer, so it sees the intent of a change rather than reasoning about diffs in isolation. [#150](https://github.com/smartwatermelon/claude-config/pull/150) switches the issue-comments fetch to GraphQL with an `isMinimized` filter, so the reviewer doesn't re-read its own collapsed comments on every run; it had been having brief conversations with itself, and they were getting weird. And [github-workflows#83](https://github.com/smartwatermelon/github-workflows/pull/83) auto-collapses PASS-verdict comments after the review settles, so PR threads stay readable.

Then I rolled v3 out. In `smartwatermelon/*` I bumped the template caller in `.github` and let Dependabot do the rest. In `nightowlstudiollc/*` I had to do more, because past-me had committed every one of those repos to its own per-repo caller workflow, which meant I had ten places to change one thing. I removed all of those (e.g. [juliet-cleaning#37](https://github.com/nightowlstudiollc/juliet-cleaning/pull/37)) and restored the centralized caller (e.g. [juliet-cleaning#38](https://github.com/nightowlstudiollc/juliet-cleaning/pull/38); the same change landed in nine more repos, several of them private). The goal is one place to change review behavior. I had eleven places to change one thing. That was wrong.

I also wrote a [bulk-install script](https://github.com/smartwatermelon/github-workflows/pull/69) that stamps the canonical workflow, secrets, and branch-protection bits onto a new repo. It is the script I should have written six repos ago.

## Trusted-namespace dependency majors

Until this week, my Dependabot policy was the standard one: auto-merge minors and patches if green, hold majors for human review. That's the default advice for a reason, but it's wrong for me, because half the "majors" in my repos are re-tags of my own workflows under a major-version pin. I trust me. Making me review my own tag bumps was theater.

The new rule: if the dependency lives in a trusted namespace (my own GitHub org, or `actions/*` and `dependabot/*`), majors auto-merge too. I pushed the policy to ~16 smartwatermelon repos and ~9 nightowlstudiollc repos in identically-titled PRs. [dev-env#17](https://github.com/smartwatermelon/dev-env/pull/17) is the representative one.

The validation came overnight. By morning, Dependabot had opened 30+ major-bump PRs across both orgs (`claude-blocking-review 2.0.1 → 3.0.0`, `dependabot/fetch-metadata 2 → 3`, `actions/upload-artifact 4 → 7`, `actions/github-script 7 → 9`, `codecov-action 4 → 6`) and merged every one of them green. That single policy change cleared more PRs than I'd have hand-merged in a quarter, and I didn't have to be conscious for any of it.

## CI security hardening

In parallel I tightened the workflows themselves.

[github-workflows#63](https://github.com/smartwatermelon/github-workflows/pull/63) pins every third-party action in `claude-blocking-review.yml` to a commit SHA, with the version tag in a comment. SHA-pinning is the one piece of supply-chain hygiene that actually matters for GitHub Actions, and I'd been letting myself off the hook on it for months.

A wave of "chore(ci): add explicit permissions block" PRs went out across [homebrew-tap](https://github.com/smartwatermelon/homebrew-tap/pull/8), [ralph-burndown](https://github.com/smartwatermelon/ralph-burndown/pull/130), [swift-progress-indicator](https://github.com/smartwatermelon/swift-progress-indicator/pull/12), and four nightowlstudiollc repos. Default permissions on a GH Actions runner are too generous; explicit minimal scopes are cheap to type and free at runtime.

I documented the methodology in [dev-env#22](https://github.com/smartwatermelon/dev-env/pull/22), which is now the audit checklist I actually run on a new repo, instead of vaguely intending to.

## ralph-burndown got serious

[ralph-burndown](https://github.com/smartwatermelon/ralph-burndown) is my nightly tech-debt scheduler. It picks a repo, picks a backlog item tagged `tech-debt`, runs Claude on it in a clean checkout, and opens a PR. It existed before this week. It just wasn't reliable enough that I'd open the morning's PRs without pre-emptive flinching.

Four PRs made it actually work. [#119](https://github.com/smartwatermelon/ralph-burndown/pull/119) fixed the workclone refresh path, which had been leaving stale branches around, and got headless Claude auth working without an interactive token paste, which had been the actual blocker. [#122](https://github.com/smartwatermelon/ralph-burndown/pull/122) cleaned up three follow-on reliability bugs that #119 surfaced. [#131](https://github.com/smartwatermelon/ralph-burndown/pull/131) wrapped the LaunchAgent invocation in a bash preflight that enforces a timeout and emails me via msmtp when something goes wrong, instead of failing silently into the launchd logs. [#132](https://github.com/smartwatermelon/ralph-burndown/pull/132) replaced round-robin scheduling with a bin-packer that respects per-repo time budgets, plus a status-email watchdog.

The bin-packer is the change I'm most pleased with. Round-robin was treating "10-minute repo" and "90-minute repo" as if they cost the same, which meant one slow repo could starve the others. I'd wake up to a status email saying ralph got through three of fifteen scheduled jobs, and feel like an idiot. Bin-packing by estimated cost lets me actually saturate a night.

## Mac dev server odds and ends

A few smaller pieces that aren't really a theme but were the week's actual debugging time.

[mac-dev-server-setup#43](https://github.com/smartwatermelon/mac-dev-server-setup/pull/43) migrated my main launch script from a LaunchAgent to a LaunchDaemon. LaunchAgents need a logged-in GUI session; LaunchDaemons don't. I had spent embarrassing amounts of time trying to figure out why my "headless" Mac mini was politely refusing to do anything until I logged in over Screen Sharing. I have been writing launchd plists for over a decade. This was in the man page.

[mac-dev-server-setup#44](https://github.com/smartwatermelon/mac-dev-server-setup/pull/44) added boot-time automount for an external development SSD, so the daemon above can actually find its working directory at boot. And [scripts#67](https://github.com/smartwatermelon/scripts/pull/67) made my keychain-unlock SSH wrapper skip its master-unlock step when the Mac is in FileVault preboot state. There's a [postscript on the keychain-ssh post](/blog/unlocking-login-keychain-over-ssh-headless-mac/) on this one if you want the full story.

## So what

Next month, when I want to ship something one of my actual users can see, the path is shorter than it was a week ago. PR reviews are sharper. Dependabot churn for stuff I trust isn't on my plate. A new repo gets the same review/CI/security treatment in one command, instead of by my eyeballing the last-good copy. The tech-debt scheduler either finishes the night or posts a clear error, so I don't have to dig.

Or maybe none of that pays off, and a month from now I write a follow-up about how I confused velocity with motion.

Ask me then.
