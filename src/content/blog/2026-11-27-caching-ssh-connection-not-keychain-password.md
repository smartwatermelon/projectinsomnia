---
title: "Caching the SSH Connection Instead of the Keychain Password"
date: 2026-11-27T11:00:00Z
description: "My ssh wrapper unlocked a headless Mac's login keychain behind one Touch ID prompt per connection, which I'd listed as a security property. Then an agent started making the connections, and the property became a barrage of modal prompts. The fix was to reuse the authenticated ssh master instead of re-fetching the password. That meant finding out that `ssh -fNM` exits 0 when it loses a race."
tags: ["tech", "security", "macos", "ssh", "1password", "claude-code"]
---

In April I wrote up [how my ssh wrapper unlocks the login keychain on a headless Mac](/blog/unlocking-login-keychain-over-ssh-headless-mac/). 1Password on my laptop hands the keychain password to `security -i` on the remote, over a multiplexed ssh connection. It costs one Touch ID prompt per connection. I listed that last part as a security invariant. It held up from April to September, while the only thing running `ssh mimolette.local` was me. Then Claude Code started running short `ssh mimolette.local 'cmd'` commands in bursts. My complaint, verbatim, became "a barrage of modal 1Password prompts that interrupt my work."

If you're here because an ssh ControlMaster setup prompts you on every connect, the fix has four parts. Key the `ControlPath` on the host, not on the process. Probe it with `ssh -O check` before fetching any secret. Raise `ControlPersist` from seconds to hours. And serialize master creation with a lock, because `ssh -fNM` exits 0 even when another master already owns the socket. The rest of this post is why each part is needed, plus a correction to the April post that matters more than I expected.

## The Setup, Briefly

macOS doesn't unlock the login keychain for an ssh login. On a Mac nobody logs into at the console, it stays locked. Everything that reads from it fails: Claude Code's OAuth token, git's `osxkeychain` helper, anything calling `SecKeychainFindGenericPassword`.

The wrapper intercepts `ssh`. Some hosts carry a `# op-keychain: op://Personal/MIMOLETTE/password` annotation in their `~/.ssh/config` block. For those, it reads the password with `op read`, which raises Touch ID. It opens a background ControlMaster and pipes `unlock-keychain -p <pw>` into `security -i` on the remote over that master. Then it `exec`s my real session over the same master. The password never appears in argv, env, shell history, or on disk on either side. The [April post](/blog/unlocking-login-keychain-over-ssh-headless-mac/) has the full derivation, including why `security -i` and why the master.

None of that changed. The argv trap, `security -i`, the `BatchMode` handling for FileVault preboot, and the unset-and-restore of `OP_SERVICE_ACCOUNT_TOKEN` around the keychain read all survive untouched. What changed is the caller.

## Four Sockets, Four Prompts

The evidence was sitting in my temp directory: four `ssh-unlock-<pid>.sock` files, three of them created inside a two-minute window. Four masters, four prompts, zero reuse.

The wrapper reads two kinds of annotation, and only one was expensive. My `# op:` line fetches `OP_SERVICE_ACCOUNT_TOKEN` so the remote can have it, and the wrapper skips that fetch when the token is already in the environment. The skip list holds exactly that one variable. `# op-keychain:` had no guard at all and called `op read` on every connect.

That read is biometric-gated on purpose. My 1Password CLI config, `~/.config/op/config`, carries `"accounts": []` and `system_auth_latest_signin`, the desktop-integration mode, so every `op read` goes to Touch ID. It can't be handed to the service account either. `OP_SERVICE_ACCOUNT_TOKEN` is scoped to my Automation vault and can't read Personal. That's why the wrapper unsets it around this one call in the first place.

## Sixty Seconds Was a Budget of One Connection

The April post says `ControlPersist` is required, and it still is. The reason given there holds: bash traps don't survive `exec`, so the master has to clean itself up. The value of 60 was also doing a second job that nobody assigned it.

The socket was keyed on the wrapper's PID, `ssh-unlock-$$.sock`. A PID-keyed path is unique per invocation. Two consecutive `ssh` commands couldn't share a master, however long `ControlPersist` was. Zero reuse was structural. A host-keyed socket wouldn't have rescued it at sixty seconds either. The master routinely expired between back-to-back connects in a burst.

`ControlPersist` is the prompt budget. It's how long one Touch ID authorization stays spendable, measured from the last session that used it. Sixty seconds bought about one connection.

## Cache the Connection, Not the Secret

The change is small to describe:

| | Before | After |
|---|---|---|
| Socket key | wrapper PID (`$$`) | target host, sanitized |
| Socket path | `ssh-unlock-$$.sock` in a temp dir | `~/.ssh/cm/unlock-<host>.sock` |
| `ControlPersist` | `60` | `4h`, via `SSH_WRAPPER_CONTROL_PERSIST` |
| Probe before `op read` | none | `ssh -O check` |
| Concurrent connects | each runs the full unlock | `mkdir` lock, 60s staleness breaker |

The probe does the real work. Before any `op read`, the wrapper asks `ssh -O check` whether a live master already owns the socket for this host. If one does, the wrapper hands back the socket path and the session rides it: no fetch, no prompt, no second unlock. Skipping the unlock is safe because every session on that master shares the sshd session where the unlock already ran.

The probe has to be `-O check`. A socket file existing proves nothing, since a stale socket outlives its master.

The socket moved to `~/.ssh/cm` because of a length limit. A Unix domain socket path tops out around 104 bytes (`sun_path`), and ssh refuses a longer `ControlPath` outright with "ControlPath too long." The macOS `$TMPDIR` is a long per-user path under `/var/folders/`, which leaves little room for anything after it. `~/.ssh/cm/unlock-mimolette.local.sock` is 53 bytes.

## `ssh -fNM` Exits 0 When It Loses

This is the finding I'd most like other people to have before they need it.

Run `ssh -fNM` against a `ControlPath` that already has a live master. It prints "ControlSocket ... already exists, disabling multiplexing." It leaves a stray ssh running in the background, and it exits 0. It doesn't become the master. It doesn't multiplex. As far as exit status can tell you, it succeeded.

So "try to open the master and check the status" isn't an available strategy. Two wrappers racing for the same host can both open, both get 0, and neither knows whether it owns the socket. Agent tooling runs its ssh calls in parallel, which made that race the normal case.

Creation has to be serialized before anyone calls `-fNM`. macOS ships no `flock(1)`, so the lock is a directory, because `mkdir` is atomic:

```bash
_cm_acquire_lock() {
  local sock="$1"
  if mkdir "${sock}.lock" 2>/dev/null; then
    return 0
  fi
  _cm_lock_is_stale "${sock}" || return 1
  rmdir "${sock}.lock" 2>/dev/null || true
  mkdir "${sock}.lock" 2>/dev/null
}
```

A wrapper that takes the lock checks for a live master again, because the racer it just lost to may have finished in between. Only then does it clear any stale socket file and run the full unlock. A wrapper that can't take the lock doesn't open a competing master or raise a second prompt. It polls for the holder's master and rides that one when it appears.

## The Trap I Couldn't Hit

The lock needs releasing even when things go wrong. So the wrapper arms `trap _keychain_cleanup EXIT INT TERM HUP` as soon as it takes the lock, before anything can block. To test that, I sent a signal to the wrapper's PID and found the lock still sitting there afterward. I concluded, three separate times, that bash was dropping the trap.

It wasn't. `_unlock_remote_keychain` runs inside `$( )`. The trap belongs to the command-substitution subshell. The PID I was signalling holds no trap at all. A real Ctrl-C or a closed terminal signals the whole process group, which reaches the subshell. With `set -m` and `kill -HUP -- -$PID`, the trap fired and the lock came off clean. The bug was in my test.

It was also a fair warning about relying on the trap. A trap you can't reliably address isn't a guarantee, and nothing fires on SIGKILL or a power cut anyway. So the lock carries a second layer: a lock directory more than a minute old is treated as orphaned and broken. That breaker, not the trap, is why a dead holder can't wedge every later connect.

## The Regression I Wrote Myself

An early version gave waiters a 15-second budget. With six parallel cold connects, five of the six timed out and skipped the unlock. Each printed one warning line to stderr and then opened a normal-looking session with the keychain still locked. That's worse than the problem I was fixing, because nothing in the session itself tells you.

A waiter's budget has to cover the holder's cold path, and the holder's cold path contains me, touching the sensor. It's 90 seconds now, set by `SSH_WRAPPER_LOCK_WAIT` in tenths of a second. A waiter also stops early once the holder's lock disappears, since there's nothing left to wait for. Before it gives up, it checks for a master one last time.

One small portability bug came along for the ride. The staleness test backdates a lock directory, and I'd written that with `date -v`, which is BSD-only. It passed on my Mac and failed on the Ubuntu CI runner with `date: invalid option -- 'v'`. GNU wants `date -d` instead. Neither is portable, so the test uses perl's `utime` now, which both have.

## A Correction to the April Post

The April post's second caveat said a dropped master barely matters. It's corrected there now; this is what it used to say:

> macOS keeps the login keychain unlocked until sleep regardless of whether our master is still alive, so a dropped master tends not to matter until the next session anyway.

I measured it on 2026-09-10, same host, same minute, no sleep in between:

```
# over the wrapper's master:
Keychain "…/login.keychain-db" no-timeout

# a fresh sshd session moments later, bypassing the master with -S none:
security: SecKeychainCopySettings …: User interaction is not allowed.
```

The unlock belongs to the sshd session, not to the machine. A different session sees the keychain locked. That caveat also said "In practice I haven't noticed this," and that part was true. I hadn't noticed because I don't reconnect every twenty seconds. The agent does.

The correction cuts both ways. It means the master is doing real work. Keeping it alive saves a prompt, and it also keeps open the one session where the keychain is unlocked. Every master that expired under the old design really did cost a full unlock and another prompt. It also means the change in exposure described next is real.

## What the Prompt Was Buying

Before, Touch ID gated each session's unlock, so every prompt in the barrage was paying for something.

After, one prompt authorizes a channel that stays usable until four hours pass with no session on it. `ControlPersist` is an idle timer, not a lifetime. Anything that connects at least every four hours keeps the master open for as long as the network and the two machines stay up. Someone with a local shell on my laptop during that time can ride the master into an unlocked keychain without presenting a finger.

What hasn't changed: key auth to that host was already passwordless, so that same person could always open their own ssh session. What they gain is the unlocked keychain inside it, which used to cost a prompt.

So this trades a per-connection biometric gate for a bounded one. The bound is visible in `SSH_WRAPPER_CONTROL_PERSIST`. I can end it early with `ssh -O exit`, in the full form under New Caveats below. The password itself still never lands in argv, env, or on disk. Four hours is the default I picked for a single-user Mac that I own. It isn't a recommendation. On anything shared, it should be short.

## The Invariants, Revised

Five of the April invariants hold as written:

- Password never in argv on the client (bash's `printf` is a builtin).
- Password never in argv on the remote (`security -i` dispatches in-process).
- Password never on disk on either side (piped through stdin).
- Password never in env on either side.
- Password never in shell history on either side.

The sixth is rewritten:

- ~~One TouchID prompt per ssh connection.~~
- One Touch ID prompt per host, per `ControlPersist` idle window, which defaults to 4h.

The change adds three:

- The socket directory is set to mode 700.
- Host names are reduced to `[A-Za-z0-9._-]` before they enter the socket path, with everything else replaced by `_`. That keeps the path inside the socket directory.
- The creation lock can't wedge: a lock more than a minute old gets broken.

## New Caveats

The April caveat about coarse authorization still stands, and now applies for hours at a stretch instead of one session.

Port forwarding rides the shared master. A later `ssh -L ... mimolette.local` gets its forward set up on the existing master instead of on a connection of its own. That surprises you if you expected one forward per session. There are two ways out. `ssh -S none mimolette.local` opens an independent connection, though that session won't have the unlocked keychain, as the correction above shows. Tearing the master down works too, with the full path spelled out. That's needed because the wrapper stays out of the way of any `-O` command and doesn't add the `ControlPath` for you:

```bash
ssh -O exit -o ControlPath=~/.ssh/cm/unlock-mimolette.local.sock mimolette.local
```

There's new persistent state as well. `~/.ssh/cm/` holds one socket per annotated host, and those sockets survive between sessions on purpose.

## Results

| | Before | After |
|---|---|---|
| Cold connect | 4.3s, one prompt | 4.3s, one prompt |
| Warm connect | 4.3s, one prompt | 0.25s, zero prompts |
| 6 parallel cold connects | 6 masters, 6 prompts | 1 master, 1 prompt |

The remote keychain reports `no-timeout`, unlocked, over the reused master. The bats suite went from 87 tests to 101. One of them asserts that a warm connect makes zero `op read` calls. The fake `op` writes every invocation to a log, and the test checks that the log is empty. I wanted the reuse property tested directly. A fast connect is only a hint.

The April design was built for one person at a keyboard, and for that caller one prompt per connection was the right number. The code is the same and the invariant is the same. The caller changed, and the only thing that caught the difference was my patience.

Code: [smartwatermelon/scripts](https://github.com/smartwatermelon/scripts). The wrapper is `ssh`; its tests are in `tests/ssh-wrapper.bats`.

## Postscript: A Desktop Secret Store With No One at the Desk

This wrapper is one of a set. A service needs a GUI click before it can reach the local network or an external drive. A [Homebrew upgrade can quietly revoke that click](/blog/no-route-to-host-but-ping-works/). A FileVault Mac that loses power waits at the unlock screen until somebody types a password. And a key-authenticated ssh session can't read its owner's keychain without the machinery in this post. I kept filing these under "macOS doesn't want to be a server," which is true. This one deserves a closer look, though, because most of it isn't Apple's doing.

The login keychain is encrypted with a key derived from my login password. An ssh session that authenticates with a key never sees that password, so nothing in the session has the material to unlock anything. That part is plain cryptography, and Linux has the same problem. GNOME Keyring and KWallet unlock from the password typed at a graphical login, and a key-authenticated ssh session gets a locked one. The session scoping I measured above is deliberate too. An unlock done in one login session doesn't leak into the others, and on a laptop that's exactly what I'd want.

The real difference is in what each kind of store accepts as proof that you're allowed to read it.

A desktop store trusts a person who is present. Its key comes from something I know, or from Touch ID standing in for it. It unlocks at login and stays unlocked for that session, and when a new app asks for a secret, it asks me. It protects against a laptop stolen while it's off and against other users on the same machine. Every part of it assumes someone is there to type, touch, or click.

A server store trusts the machine or the workload. It's unlocked by something the machine holds. That can be a key sealed in the TPM, a root-only file, a cloud instance identity, or a service-account token. It's available at boot with nobody around. Access follows a rule written in advance, such as "this service may read these three secrets," instead of a prompt. systemd's TPM-encrypted credentials are one version of this. HashiCorp Vault, AWS Secrets Manager, and a mode-0600 file owned by root are others. The price is that the secrets are exactly as safe as the machine. Anyone who can act as that machine or that service can read them.

macOS does have server-style stores. The System keychain unlocks at boot with a machine key rather than anyone's password, and only root can write to it. A 1Password service account is another, and this wrapper already uses one: a token, scoped to my Automation vault, with no prompt. The keychain password itself lives in my Personal vault, which that token can't read. So the one secret the unlock needs is still behind Touch ID.

The gap is narrower than "no server store." Claude Code and git's `osxkeychain` helper both keep their credentials in the login keychain by default. macOS offers no per-user store that unlocks without the user. So the secrets land in the desktop store because that's where the tools look. This whole wrapper exists to open a desktop store from a session that has no person in it.

The network prompt and the FileVault screen are different. A key in a TPM can unlock a Linux disk unattended. The closest macOS gets is `fdesetup authrestart`, which covers one planned reboot. Those are Apple choosing desktop behavior where a server option was possible. The keychain is mostly me asking a desktop store to do a server's job. The tools leave me nowhere else to put the secrets.

---

Employers thinking *I want someone who reasons about where a secret travels this carefully*: [I'm on LinkedIn](https://www.linkedin.com/in/andrewrich/) and [reachable by email](mailto:andrew@projectinsomnia.com). I'm a Principal SRE by trade, and this is the kind of work I do for fun.

If you're a business owner, maybe you're thinking *I have a Mac that should be doing real work for me. It keeps fighting me the moment no one is sitting in front of it.* That's exactly what [Night Owl Studio](https://nightowlstudio.us/) is for. Automation on top of macOS, done by someone who's already fought every prompt, permission, and policy so you don't have to.
