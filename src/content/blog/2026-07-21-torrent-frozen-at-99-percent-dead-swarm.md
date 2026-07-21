---
title: "A Torrent Frozen at 99.2%: How to Tell When a Swarm Is Actually Dead"
date: 2026-07-21
description: "A torrent stuck at 99.2% for two weeks with zero seeders isn't slow, it's dead: the missing piece was never distributed to anyone alive. How to confirm that in five minutes with transmission-remote, why adding trackers won't save you, and the two yt-dlp plugin bugs I hit routing around it (relative imports, and the *IE class-name gotcha that crashes the URL matcher)."
tags: ["tech", "bittorrent", "yt-dlp", "plex", "homelab"]
---

I run a personal media server. This is going to be one of those posts where a minor annoyance becomes a project entirely of my own making.

The symptom was simple and maddening. A torrent sat at 99.2% for two weeks and would not finish. Not 99.2% and creeping upward. 99.2% and frozen, the exact same number every time I looked. Transmission cheerfully listed connected peers, listed thirteen trackers, listed "activity," and moved zero bytes toward completion.

If you googled *torrent stuck at 99 percent no seeders* and landed here: your swarm is almost certainly dead. The missing piece was never distributed to anyone who is still online, and no quantity of new trackers will summon it back. Here's how to confirm that in about five minutes, and then the considerably longer detour I took to get the file another way.

## Reading a dead swarm

I keep Transmission on the media server (a box named TILSIT), so the diagnosis happened over `transmission-remote`. The number that matters is not seeders and not peers. It's **availability**.

Availability is the fraction of the complete file that exists across every peer you're connected to, combined. 100% means the whole file is reachable from your swarm, somewhere, even if no single peer is a full seed. Below 100% with zero seeders means the rest of the file is not present on any machine you can talk to. It isn't slow. It's absent.

Mine read 99.2%. The hole was about 8.8 MB, roughly one 8 MiB piece out of the ~140 that make up a 1.10 GB file. And here is the tell that turns "probably" into "certainly":

Seven connected peers, and every single one of them sat at exactly 99.2%.

When every peer is missing the identical sliver, they didn't fail independently. They all cloned their copy from the same incomplete source, and the original seeder left the swarm before it ever finished handing that last piece to anyone. Zero seeders across all thirteen trackers confirmed it. The piece isn't rare. It's gone.

That's a terminal state. A swarm can survive losing seeders if the full file is smeared across enough partial peers to reconstruct it. This swarm couldn't, because the missing byte range never propagated past the uploader in the first place.

I tried anyway, because that's the job:

1. Added about ten more public trackers (openbittorrent, explodie, moeking, the usual suspects) and forced a reannounce to all of them. This is the standard advice, and it found me exactly one new peer. That peer was at 99.2%.
2. Relaxed Transmission's encryption from "required" to "preferred," to accept connections from peers that don't do encrypted transport. (I also set a cloud routine to email me in three days to switch it back, because a security setting you loosen and then forget is how you end up writing a different, worse blog post.) Still no seeder.

Neither move mattered, because neither move could conjure data that no reachable peer possessed. The honest read on torrent health is that availability is the one number worth trusting. Seeders and peers flatter you; availability tells you whether the file can physically be assembled from who's actually online. Mine said no.

So I removed it and went looking for the same show somewhere it still existed.

## The show that's hard to get on purpose

The file was a recent, fairly obscure UK stand-up special. Its US digital footprint is close to nonexistent:

| Source | Status |
| --- | --- |
| The original global livestream (Jan 2025) | "Deployment paused." Gone. |
| A UK streamer | Available, behind a six-month minimum subscription |
| The "official" download link | Redirects to the dead livestream |
| iTunes / Apple TV / Google Play / Amazon (US) | Not listed anywhere |
| Paramount+ | No |
| **SBS On Demand** (Australia's public broadcaster) | **Airing, free with a registered account** |
| YouTube | Audio-only rip of the full set |

SBS is the interesting entry. It's a public broadcaster, the special genuinely airs there, and that's where I went. Which is where the second technical rabbit hole opened up, and this one has lessons that generalize well beyond one show.

## Two yt-dlp plugin bugs worth knowing

`yt-dlp`'s built-in extractor for SBS was broken. SBS changed their streaming API in April 2026, and the shipped extractor was still requesting a SMIL manifest from a deprecated endpoint that now answers `HTTP 410 Gone`. This was a known issue ([yt-dlp #16529](https://github.com/yt-dlp/yt-dlp/issues/16529)). A contributor had a fix on a branch, but it hadn't been merged into a stable release yet.

Installing an in-tree extractor as a local plugin is not a copy-and-drop operation, and the two things that bit me will bite anyone writing a `yt-dlp` plugin.

Relative imports don't survive the move. Extractors that live inside the `yt-dlp` package import their neighbors with relative paths: `from .common import ...`, `from ..utils import ...`. A plugin loads from *outside* the package, so those imports resolve to nothing. Every one of them has to become absolute: `from yt_dlp.extractor.common import ...`, `from yt_dlp.utils import ...`. Miss one and the plugin fails to load with an import error that points at the wrong thing.

The second one is the good one: any class whose name ends in `IE` gets auto-registered as an extractor. `yt-dlp` discovers extractors by scanning for class names ending in `IE`, and it will try to register *every* such class it finds. The patched file defined a shared base class named `SBSBaseIE` that had no `_VALID_URL` of its own, because base classes don't match URLs. `yt-dlp` didn't care. It tried to register the base class, reached for its `_VALID_URL` to compile, found `None`, and died:

```
TypeError: first argument must be string or compiled pattern
```

The fix is to rename the base so its name does not end in `IE`. A leading underscore does it (`_SBSBase`), and inheritance still works fine for the real `SBSIE` extractor that does the actual matching. The base class stops advertising itself as something to register, and the URL matcher stops trying to compile a pattern that was never there.

There was also an authentication wrinkle: SBS now checks login at the API layer, not just at the website, so a valid account credential has to reach the extractor the way `yt-dlp` normally passes credentials. Browser-cookie passthrough alone wasn't enough for the new endpoint. I'll leave the service-specific incantation out of this post on purpose; the transferable lesson is the plugin mechanics above, not a turnkey recipe for one broadcaster's API.

It pulled down a 509 MB mkv.

## Into Plex, and cleanup

The stream rip was useless for finishing the original torrent, and not for any policy reason. It was a completely different encode (a 509 MB SBS capture versus a 1.10 GB HDTV rip), which means completely different piece hashes. As far as BitTorrent is concerned they aren't the same file at all.

The rest was routine. FileBot auto-detected the mkv as a movie, renamed it to the canonical title, and moved it into the Movies library. A Plex scan picked it up on the next pass. Then I put the box back the way I found it: removed the dead torrent and its incomplete data, reverted the encryption setting from "preferred" back to "required," killed the reminder I'd scheduled to nag me about it, and left the `yt-dlp` plugin installed at `~/.config/yt-dlp/plugins/` for the next time SBS breaks their extractor.

Seventy minutes for a file I could have watched the audio of on YouTube for free. I am aware of how that sounds.

The torrent is gone. The file plays. I'll take it.

---

If you're an employer thinking *I want someone who checks the availability number before he adds ten trackers and hopes* — [I'm on LinkedIn](https://www.linkedin.com/in/andrewrich/) and [reachable by email](mailto:andrew@projectinsomnia.com). I'm a Principal SRE by trade, and diagnosing a dead system before touching it is most of the job.

If you're a business owner thinking *I have a Mac quietly running things and I'd like it to fight me less* — that's what [Night Owl Studio](https://nightowlstudio.us/) is for. Media servers, automation, and the kind of macOS plumbing that only reveals its bugs at 99.2%.
