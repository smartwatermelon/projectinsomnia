---
title: "Unlocking the Login Keychain Over SSH on a Headless Mac"
date: 2026-04-24
description: "macOS locks the login keychain when there's no GUI login, which quietly breaks Claude Code, git credential helpers, and anything that calls SecKeychainFindGenericPassword. The fix: 1Password on the client, ssh connection multiplexing, and `security -i` on the remote — no password in argv, on disk, or in env on either side."
tags: ["pinned", "tech", "security", "macos", "ssh", "1password"]
---

## The Broken Thing

You can ssh into a Mac. That part works. What doesn't work, and doesn't advertise that it doesn't work, is the login keychain. On any Mac that's only ever been logged into over ssh — typical for a headless Mac mini used as a build server, test node, or "spare computer I keep around to run things" — the login keychain sits locked forever. Every tool that depends on it fails in some confusing way.

The one that pushed me from "mildly annoyed" to "actually fix this" was Claude Code. It stores its OAuth token in the macOS login keychain. On my laptop this is invisible; on my headless Mac mini (MIMOLETTE) it meant Claude Code refused to start because it couldn't read its own auth token. Git's `osxkeychain` credential helper has the same problem. Anything that calls `SecKeychainFindGenericPassword` behind the scenes is going to either fail silently, error confusingly, or try to prompt for a password on a display that isn't there.

---

## Why Apple Does This, and Why They're Right

The login keychain is encrypted with your login password. On a normal desktop login, the LoginWindow process types that password into the keychain at unlock time. There is no other unlock path that Apple ships.

ssh authentication doesn't see that password — you authenticate with a key, not with your account password. And you wouldn't *want* ssh to prompt for your account password on every connection (both awful UX and a credential-reuse problem waiting to happen).

So: no GUI login = no unlocked keychain. From Apple's perspective this is correct, because the alternative would be "store the account password somewhere a shell session can autonomously read it," and that's precisely the thing a local-attacker threat model says you must not do.

The problem is that Apple's answer is phrased as "don't do that," and a lot of us have a legitimate need to do that. A Mac you ssh into *is* a server in every practical sense, and it should be able to run server-shaped tooling. "Run Claude Code on my spare Mac" is a reasonable thing to want.

---

## Non-Starters

A few ideas that sound plausible but don't hold up:

- **Hardcode the keychain password in a script on the server.** Anyone who breaks in gets your entire keychain. Also, you now have two copies of the same password in two places — an eventually-leaking configuration.

- **Move the keychain-backed secrets to 1Password's Automation vault.** Good thought on first pass. Automation vaults are designed to be reachable via `OP_SERVICE_ACCOUNT_TOKEN` in the environment, which means anything running as that user gets at the vault. Fine for tightly-scoped tokens; *worse* than the login keychain for a keychain-password-sized secret, because the blast radius includes every process that inherits the shell environment.

- **LaunchAgent that unlocks on boot.** Same problem as hardcoding: the password has to live somewhere readable without interaction.

- **Type the password at every ssh connection.** Fine for manual use, useless for ssh-as-scripting.

What we actually want: *the password lives in a place I can authenticate against with biometric on my local machine, and gets handed over the wire at unlock time only, never landing in a persistent location on either end.*

---

## Shape of a Working Answer

The ingredients that made this tractable:

1. **1Password can hold the keychain password in a Personal vault.** Personal vault items require full user authentication to read — in practice, TouchID on the Mac that has the user signed into 1Password. `op read op://Personal/MIMOLETTE/password` triggers the biometric prompt and spits the password on stdout.

2. **ssh can carry the password to the remote without putting it on disk.** Piping through ssh's stdin gets it to the remote process's stdin. Nothing touches a file.

3. **`security` has a REPL mode that dispatches subcommands in-process.** This is the key trick. More on this below.

4. **ssh supports connection multiplexing.** One authenticated connection, multiple logical sessions. Solves a sequencing problem I'll come to.

---

## The Two Traps

Most of the design time went into dodging two specific mistakes.

### The Argv Trap

The obvious form of the unlock is:

```
ssh mimolette.local "security unlock-keychain -p '$PW' login"
```

This puts `$PW` into the argv of `security` *on the remote side*. For the millisecond that process exists, anyone running `ps` on the remote can see the password. On a multi-user box that's a real leak; on a single-user box it's narrow, but it's still there in memory paging and core dumps. Not the kind of thing I want in a design I'm going to run thousands of times.

The fix is `security -i`. From the man page, `-i` puts `security` into an interactive mode: it reads commands from stdin, one per line, and dispatches them *in-process*. No fork, no exec, no new process whose argv includes the password. You verify this by running `security -i` in one terminal, typing `unlock-keychain -p hunter2 somekeychain`, and watching `ps auxww | grep security` in another terminal: you see only `security -i`, no subprocess with `hunter2` anywhere.

So the unlock command becomes something more like:

```
printf 'unlock-keychain -p %s\n' "$PW" | ssh mimolette.local 'exec security -i'
```

The remote bash execs `security -i`, which replaces the shell process. `security -i` reads the single line from stdin, dispatches `unlock-keychain` internally with the password already in-process, sees EOF, and exits with the status of the dispatched command.

### The Connection Trap

With the argv problem solved, there's a sequencing problem. The ssh invocation that pipes the unlock command consumes ssh's stdin — you piped into it. Once stdin is consumed, you can't turn around and hand the same connection back to an interactive shell: the shell inherits a closed stdin and immediately exits.

The fix is ssh connection multiplexing. Open a ControlMaster — a long-lived authenticated connection — then run multiple logical sessions over it:

```bash
sock="/tmp/ssh-unlock-$$.sock"
ssh -fNM -o ControlPath="$sock" -o ControlPersist=60 mimolette.local

printf 'unlock-keychain -p %s\n' "$PW" \
  | ssh -o ControlPath="$sock" mimolette.local 'exec security -i'

exec ssh -o ControlPath="$sock" mimolette.local
```

Three ssh invocations, one authentication. The first opens the master in the background. The second runs the unlock pipe as a short-lived channel. The third is the user's real session, running as a second channel over the same master. Each channel has its own fresh stdin, stdout, stderr.

`ControlPersist=60` is load-bearing. Bash traps don't fire after `exec` — the process image is replaced, so any cleanup I wired up for socket removal would silently leak the master. `ControlPersist=60` tells the master to auto-exit sixty seconds after its last client channel disconnects. That's good enough: clean `exec`, no bash wrapper lingering, and the master tears itself down shortly after the user exits.

---

## Integration With the Existing SSH Wrapper

I already had [an ssh wrapper that intercepts the `ssh` command and injects secrets from 1Password into the environment](/blog/1password-claude-credentials/) for annotated hosts. The annotation lives in `~/.ssh/config` as a comment:

```
Host mimolette.local
    # op: OP_SERVICE_ACCOUNT_TOKEN="op://Personal/xxx/credential"
    SendEnv OP_SERVICE_ACCOUNT_TOKEN
```

The wrapper reads the `# op:` line, resolves the op-reference via `op read`, and exports the variable before calling the real ssh. The remote gets the variable via SendEnv/AcceptEnv.

The new keychain feature slots in as a second annotation form with the same structure:

```
Host mimolette.local
    # op: OP_SERVICE_ACCOUNT_TOKEN="op://Personal/xxx/credential"
    # op-keychain: op://Personal/MIMOLETTE/password
    SendEnv OP_SERVICE_ACCOUNT_TOKEN
```

The `# op-keychain:` line opts the host into the unlock dance. No second argument — the payload is always the op-reference, the target is always the remote's login keychain.

The wrapper's flow:

1. Parse argv, find the target host.
2. Scan `~/.ssh/config` for annotations matching the host.
3. Fetch `# op:` secrets via `op read`, export them.
4. If a `# op-keychain:` matched, run the unlock dance (ControlMaster + pipe into `security -i`).
5. `exec` ssh with the original argv, adding `-o ControlPath=<sock>` if the dance opened a master.

Guard: skip the dance if argv contains `-O` (ControlMaster control operations — `-O check`, `-O stop`, `-O exit`). Don't want to open a new master while the user is trying to operate on an existing one.

Failure policy: warn and fall through. A missed keychain unlock is a convenience loss, not a security hole. The user still gets their ssh session; they can run `security unlock-keychain` manually if they really need the keychain unlocked. Compare with the `# op:` policy, which aborts on op failure — missing `OP_SERVICE_ACCOUNT_TOKEN` leaves the remote unable to do its job, so ssh'ing in without it is pointless. Different failure, different semantics.

---

## The Two Bugs the Design Conversation Didn't Predict

The mechanical design held up. The integration bugs were the fun ones.

### Vault Auth Context

The wrapper already fetches `OP_SERVICE_ACCOUNT_TOKEN` from the `# op:` annotation before the keychain dance runs. That's how the remote gets its vault access. The problem: the moment the wrapper exports that token, the *local* `op` CLI sees it in the environment and switches itself from user-session auth (which can reach Personal) into service-account auth (which is scoped to one Automation vault). The keychain op-read then fails:

```
[ssh-wrapper] op read failed for op-keychain (op://Personal/MIMOLETTE/password):
[ERROR] could not read secret 'op://Personal/MIMOLETTE/password':
could not get item Personal/MIMOLETTE: "Personal" isn't a vault in this account.
```

This is the generic shape of a whole class of bug: a CLI that picks its auth context from ambient environment does the wrong thing the moment you set up ambient environment for something *else*. I keep getting bitten by variants of it.

Proof it's environmental and not authorization: the same `op read` command runs fine from the shell, because the user's login shell doesn't have `OP_SERVICE_ACCOUNT_TOKEN` exported. The wrapper exports it only for its own process.

Fix: save, unset, op-read, restore. The token is unset for exactly the duration of the keychain fetch, then restored so the `SendEnv` forward still reaches the remote on the final exec:

```bash
# Temporarily drop the service-account token so op falls back
# to user-session auth for the Personal vault read.
if [[ ${OP_SERVICE_ACCOUNT_TOKEN+set} == set ]]; then
  saved_token=$OP_SERVICE_ACCOUNT_TOKEN
  unset OP_SERVICE_ACCOUNT_TOKEN
  pw=$(op read "$op_ref")
  OP_SERVICE_ACCOUNT_TOKEN=$saved_token
  export OP_SERVICE_ACCOUNT_TOKEN
else
  pw=$(op read "$op_ref")
fi
```

One detail: detect "set but empty" with `${OP_SERVICE_ACCOUNT_TOKEN+set}` rather than `-n`, because an empty-string value is semantically distinct from unset and should round-trip cleanly.

### Keychain Name Resolution

The design conversation had the unlock command as:

```
unlock-keychain -p <pw> login
```

where `login` was meant as a shorthand for the login keychain. This doesn't work on modern macOS. Running it directly returns:

```
security: SecKeychainUnlock login: The specified keychain could not be found.
```

The `security` CLI expects a full path to a keychain file, or a filename that matches something in the keychain search list. The bare name `login` isn't resolvable even though `/Users/andrewrich/Library/Keychains/login.keychain-db` *is* in the search list. I don't know exactly what macOS version broke this or whether it ever worked; regardless, it's not portable.

Fix: drop the positional argument. `security unlock-keychain -p <pw>` with no keychain name targets the default keychain. On any normal user account the default keychain *is* the login keychain — verified via `security default-keychain`. Users whose default keychain is something else would get that one unlocked instead, which is arguably still what they want ("unlock the primary keychain").

I also used this iteration to fix an observability gap: the wrapper was swallowing `security -i`'s stderr with `>/dev/null 2>&1`. The first real failure mode — which turned out to be this one — gave no diagnostic, just a generic "remote security -i returned non-zero." Now the warning includes the captured stderr, so the next person who hits a real problem gets to read the actual error message. Future me will thank present me.

---

## What This Gives Us

```
$ ssh mimolette.local 'security show-keychain-info 2>&1'
Keychain "<NULL>" no-timeout
```

That's the keychain unlocked. Before, it would have returned *"User interaction is not allowed"* — the diagnostic for a locked keychain that `security` couldn't prompt the user to unlock.

Claude Code on the server starts normally and finds its OAuth token. Git credential helpers work. The Slack CLI's keychain integration works. Every tool that was silently failing because of a locked keychain is now just working.

The invariants held up:

- Password never in argv on the client (bash's `printf` is a builtin).
- Password never in argv on the remote (`security -i` dispatches in-process).
- Password never on disk on either side (piped through stdin).
- Password never in env on either side.
- Password never in shell history on either side.
- One TouchID prompt per ssh connection.

---

## Caveats Worth Naming

Unlocking the login keychain over ssh is powerful but coarse. It grants the ssh session access to *every* secret in that keychain, not just the one you needed. For a single-user Mac that you own, that's almost certainly fine — it's functionally the same authorization surface you have when you sit in front of the machine. For a shared server or a production service, you'd want a per-secret auth story via a service-account tool instead.

The master ssh connection persists for the session duration plus sixty seconds after disconnect. If something kills the master prematurely (network blip, explicit `-O exit` from another terminal, box sleeps), subsequent keychain operations in that session fail until the next ssh re-runs the unlock. In practice I haven't noticed this; macOS keeps the login keychain unlocked until sleep regardless of whether our master is still alive, so a dropped master tends not to matter until the next session anyway.

---

## Postscript: The Preboot Trap

After shipping the wrapper described above, a new failure mode surfaced — one I'd never tested for. I never tried "ssh into a freshly-rebooted Mac mini" while developing this, and the preboot SSH phase that lives in that window had been there the whole time.

### The Trigger

macOS Tahoe (26.0+) on Apple Silicon introduced **remote FileVault unlock over SSH**. After a reboot, before any user has logged in, the Mac boots its sealed, read-only system partition and runs a minimal `sshd` from there. That `sshd`:

- accepts only **password authentication** (no SSH keys, no `~/.ssh/config`, no host keys from the data volume — those live on the encrypted partition that hasn't been mounted yet)
- exists only to authenticate a local user's password and unlock the data volume
- **drops the connection** seconds after a successful password, while macOS finishes booting and starts the real `sshd`

Apple's design here is also intentional and correct. The wrapper just didn't know about it.

### What Went Wrong

The keychain-unlock dance opens an auxiliary `ssh -fNM` master before my interactive session, then pipes `unlock-keychain` over that master via `security -i`. Both steps assume the master will live long enough for my session to multiplex over it.

In the FileVault preboot phase, neither assumption holds:

1. The auxiliary master attempts key auth, falls back to password, and **prompts me on `/dev/tty`** for the FileVault password. I wasn't asking to interact with this connection — it was supposed to be invisible plumbing.
2. Even if I type the password, the preboot `sshd` unlocks the volume and then immediately disconnects. The "master" is a corpse before my real session can attach to it.

What I saw was a confusing double-prompt: first an SSH connection I didn't ask to authenticate, then a `^C` and a stderr warning, then the actual session prompt I wanted in the first place.

### The Fix

Two flags on the auxiliary master invocation:

```bash
ssh -fNM \
  -o ControlPath="${sock}" -o ControlPersist=60 \
  -o BatchMode=yes -o ConnectTimeout=10 \
  "${host}"
```

`BatchMode=yes` refuses every interactive auth method — passwords, keyboard-interactive, host-key confirmation, all of it. In the preboot phase, where only password auth is offered, the master fails fast with no `/dev/tty` access. The wrapper logs a warning, cleans up its socket, and falls through to a plain `exec ssh "$@"` — which inherits no flags and lets my real session prompt for the FileVault password as macOS intends.

`ConnectTimeout=10` caps the master at ten seconds so partially-booted hosts (TCP up, `sshd` hung on banner) don't stall the wrapper indefinitely. My interactive session has no such cap; it gets the kernel's default TCP timeout, which is the right behavior for a session I'm actively waiting on.

### A New Scope Limitation

`BatchMode=yes` is the *correct* gate for the preboot case, but it gates more than the preboot case. Any host that legitimately accepts only password or keyboard-interactive auth — a freshly-provisioned box, a server with PAM 2FA, a Yubico challenge — now silently fails the master-open step. The keychain-unlock dance is skipped on those hosts. The fall-through is harmless (my session still works), but the convenience is gone until key authentication is in place.

This is acceptable for the original use case (a personal Mac mini where keys are deployed once and forever), but worth flagging for anyone porting the design. A more general implementation might add a per-host opt-out — `# op-keychain-allow-password: yes` — to permit the master to take a password when the operator explicitly accepts the UX cost. For now, the simpler gate keeps the failure mode legible: if you don't have key auth on the host, the wrapper will not surprise you with a prompt.

### Updated Security Invariants

The invariants above all still hold. One can be added:

- The wrapper never holds open an interactive prompt on `/dev/tty` for a connection I did not initiate.

That invariant was implicit before — accidentally satisfied by the assumption that key authentication would always succeed. The preboot case made it explicit.

### Recap

- macOS Tahoe added a preboot SSH phase that accepts only passwords and disconnects after FileVault unlock.
- The wrapper's auxiliary master collided with this state by prompting for a password I didn't want to enter and then dying anyway.
- `BatchMode=yes` + `ConnectTimeout=10` on the master invocation pushes the failure to a fast, silent, no-`tty` exit, and the wrapper falls through to the plain SSH path that handles the preboot unlock correctly.
- The tradeoff — losing the convenience on password-only hosts — is acceptable for the design's intended scope.

The fix is a five-token diff. The reasoning behind it is the rest of this postscript.

---

If you're an employer and you're thinking *I want someone who reasons about where a secret travels this carefully* — [I'm on LinkedIn](https://www.linkedin.com/in/andrewrich/) and [reachable by email](mailto:andrew@projectinsomnia.com). I'm a Principal SRE by trade, and this is the kind of work I do for fun.

If you're a business owner thinking *I have a Mac that should be doing real work for me but keeps fighting me the moment no one is sitting in front of it* — that's exactly what [Night Owl Studio](https://nightowlstudio.us/) is for. Automation on top of macOS, done by someone who's already fought every prompt, permission, and policy so you don't have to.
