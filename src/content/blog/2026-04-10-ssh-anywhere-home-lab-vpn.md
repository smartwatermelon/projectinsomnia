---
title: "SSH Anywhere: Building a Secure Tunnel Into My Home Lab"
date: 2026-04-10
description: "OpenVPN on TCP/443 through a Synology NAS, with DNS tricks to make .local hostnames work over the tunnel. A practical guide to remote access that survives hostile networks."
tags: ["tech", "home-lab", "networking"]
---

I have a build server in my home office. It's a Mac Mini M4 called MIMOLETTE, named after the French cheese, because all my servers are [named after cheeses](https://en.wikipedia.org/wiki/Cheese_Shop_sketch). It runs my CI pipelines, hosts my dev environments, and generally does the heavy lifting while I'm out pretending to have a life. The problem is that "out pretending to have a life" sometimes means "sitting in the Alaska Airlines lounge at LAX needing to push a hotfix."

For years the answer to "how do I get into my home network remotely" was "I don't, really." My previous job came with a corporate laptop and a corporate VPN and a corporate IT department that handled all of this. Now I'm [running my own studio](https://nightowlstudio.us/), which means the corporate laptop is gone and the problem is mine.

So. Time to build a [tunnel](https://www.youtube.com/watch?v=8Vn8VGvtlnY).

---

## What I Actually Wanted

The requirements were simple to state and annoying to satisfy:

- SSH into MIMOLETTE from anywhere
- "Anywhere" includes airport lounges, conference hotels, and other networks that treat UDP traffic and non-standard ports like a personal affront
- Not obviously findable by automated scanners
- Not exposing port 22 to the internet under any circumstances

That last one is non-negotiable. Anyone who's watched a `fail2ban` [log](https://www.the-art-of-web.com/system/fail2ban-log/) for five minutes knows that port 22 on a public IP gets hammered constantly by bots looking for weak credentials. The right answer is that SSH should never be directly visible from the internet at all.

---

## The Plan: OpenVPN on TCP/443

My home network runs Quantum Fiber into a [TP-Link Deco](https://www.tp-link.com/us/deco-mesh-wifi/) mesh router, then into a [Meraki switch](https://meraki.cisco.com/) (thanks, former^2 employer) and a rack of named servers. The always-on anchor is ROMANO, a [Synology DS923+](https://www.synology.com/en-us/products/DS923+) NAS that runs 24/7 and handles backups, media, and now, VPN.

The architecture: OpenVPN running on ROMANO, accessible from the internet (via port-forwarding) on **TCP port 443**. Port 443 is HTTPS. Almost no network blocks outbound 443/TCP — doing so breaks the entire web. To a basic firewall, my VPN traffic looks like ordinary HTTPS. Networks with SSL inspection proxies or deep packet inspection can still fingerprint OpenVPN's handshake, but in practice most airport and hotel networks don't bother. This is exactly why [PIA](https://www.privateinternetaccess.com/) saved me at that Alaska lounge when their OpenVPN-over-TCP mode was the only thing that could reach GitHub's SSH port. I'm just replicating that trick for my own infrastructure.

The port forwarding chain is a bit involved:

```
Client → homelab.example:443
  → ISP gateway translates 443 → 10443
    → Deco forwards 10443 → ROMANO (10.0.15.67:10443)
      → OpenVPN tunnel established
        → SSH to any host on 10.0.15.x
```

The ISP gateway handles the 443→10443 translation at the WAN edge. The Deco forwards 10443 to ROMANO. The non-standard internal port means nothing on my LAN is accidentally competing with something else on 443, and a scanner that finds the port gets silence — OpenVPN with TLS auth key enabled drops packets from unknown clients before completing any handshake.

I own the domain via [Cloudflare](https://www.cloudflare.com/), which is what the client connects to. DDNS is handled by [`cloudflare-ddns`](https://github.com/favonia/cloudflare-ddns) running on TILSIT, so if my home IP changes the A record updates automatically. (At some point I'll move DDNS to ROMANO as well; it's on the ever-growing to-do list.)

---

## Setting Up OpenVPN on Synology

Synology's [VPN Server package](https://www.synology.com/en-us/dsm/packages/VPNCenter) makes this straightforward. The relevant settings:

- **Dynamic IP address**: `172.16.0.1` (I'm using `172.16.0.0/24` for the VPN subnet — my LAN is `10.0.15.x`, so `10.x` was already taken)
- **Port**: `10443`
- **Protocol**: TCP
- **Authentication**: HMAC-SHA512 (the `--auth` directive — this sets the keyed message authentication code for the data channel, ensuring packet integrity and authenticity once the tunnel is established)
- **Compression**: off (the [VORACLE](https://openvpn.net/security-advisory/the-voracle-attack-vulnerability/) attack demonstrated that compression on an encrypted VPN channel can leak plaintext, and most traffic inside the tunnel is already encrypted HTTPS — compressing high-entropy data wastes CPU for zero bandwidth savings)
- **Allow clients to access server's LAN**: on — this is the whole point
- **Verify TLS auth key**: on — this is what makes the server non-responsive to unknown clients
- **Verify server certificate**: on (`--remote-cert-tls server` in the `.ovpn` config — this verifies the server certificate has the TLS Web Server Authentication extended key usage, preventing a MITM using a client certificate to impersonate the server)

Export the config, edit `YOUR_SERVER_IP` to your actual hostname, import into [Tunnelblick](https://tunnelblick.net/) on macOS. Done.

One thing to check in the exported `.ovpn` file before you use it:

```
#redirect-gateway def1
```

That line is commented out, which is what you want. It means only traffic destined for your home LAN routes through the VPN. Your general browsing goes out your current connection normally. This is split-tunnel behavior, and it's the right default for this use case. It works because Synology's VPN Server pushes a route for your LAN subnet (something like `route 10.0.15.0 255.255.255.0`) to the client during connection setup — without that pushed route, the client wouldn't know to send LAN-bound traffic through the tunnel.

---

## The WireGuard Detour

My first instinct was [WireGuard](https://www.wireguard.com/). It's faster, uses a fixed set of modern cryptographic primitives with no cipher negotiation (which eliminates misconfiguration risk), and has a dramatically smaller codebase (~4,000 lines vs. OpenVPN's ~100,000+). Synology's VPN Server doesn't include it natively, but there are community-built kernel module packages that add it.

I got far enough to discover that the DS923+'s architecture (AMD Ryzen R1600, Synology's "v1000" platform) has prebuilt SPK packages available from [blackvoid.club](https://www.blackvoid.club/wireguard-spk-for-your-synology-nas/). Installation requires SSH and a manual `start` command — it's doable.

I backed off for two reasons. First, the airport lounge problem: WireGuard uses UDP, and a VPN on a non-standard UDP port is exactly what aggressive enterprise firewalls block. OpenVPN on TCP/443 survives those environments. Second, managing a WireGuard config entirely over SSH on a NAS isn't dramatically simpler than OpenVPN with a working GUI. OpenVPN won on practical grounds.

---

## The mDNS Problem

Once the tunnel was up, I could SSH to any host by IP. What I couldn't do was SSH to `mimolette.local` — the `.local` hostnames I use on my LAN every day stopped working from outside.

This is a fundamental property of [mDNS](https://en.wikipedia.org/wiki/Multicast_DNS), the protocol behind `.local` resolution. mDNS is multicast — devices announce themselves to `224.0.0.251` on the local network segment. OpenVPN creates a TUN interface, which is point-to-point and lacks the `IFF_MULTICAST` flag. macOS's `mDNSResponder` enumerates interfaces and skips those that aren't multicast-capable — so the TUN interface is invisible to `.local` resolution. Even if you forced multicast on the interface, there's no multicast routing in a standard OpenVPN tunnel to deliver the packet to the remote LAN's multicast segment.

The theoretical fix is [Avahi's reflector mode](https://www.avahi.org/). Set `enable-reflector=yes` and `allow-point-to-point=yes` in `/etc/avahi/avahi-daemon.conf` **on ROMANO** (the NAS runs Linux under the hood, and Avahi is its mDNS implementation). Avahi then bridges mDNS traffic between the LAN and the VPN tunnel interface. This works on the server side — `avahi-browse -alr` **on the NAS** shows the tunnel. But `dscacheutil -q host -a name mimolette.local` **on the Mac** still returns nothing, because `mDNSResponder` on the client never sends the multicast query out the tunnel in the first place.

The actual fix is a real DNS server with actual A records, pointed at by a resolver file that tells macOS to use unicast DNS for `.local` rather than mDNS.

> **A note on Avahi reflector mode**: If you followed guides suggesting you enable `enable-reflector=yes` and `allow-point-to-point=yes` in `/etc/avahi/avahi-daemon.conf` on the NAS — undo those changes. The reflector doesn't solve the problem (macOS's `mDNSResponder` never sends multicast queries out the tunnel in the first place), and running it causes duplicate mDNS resolver conflicts on your LAN. The symptom is your Mac's hostname getting renamed to `hostname-2` or `hostname-randomstring` on every wake, accompanied by a system notification that a duplicate name was found on the network — Avahi is re-announcing your Mac's hostname from the NAS side, and `mDNSResponder` loses the collision detection race. Revert to the default Avahi config: `allow-interfaces=eth0,eth1`, `allow-point-to-point=no`, `enable-reflector=no`, then `sudo systemctl restart avahi.service`. The BIND-based solution below is the right path.

---

## Synology DNS Server + `/etc/resolver/local`

Synology ships a [DNS Server package](https://www.synology.com/en-us/dsm/packages/DNSServer) that's BIND 9 under a GUI. I created a primary zone for `local`, added A records for the four hosts I care about:

```
ROMANO     10.0.15.67
TILSIT     10.0.15.57
MIMOLETTE  10.0.15.41
BERKSWELL  10.0.15.68
```

The zone file lives at `/var/packages/DNSServer/target/named/etc/zone/master/local` if you want to edit it directly (and use `sudo rndc reload local` to hot-reload without restarting BIND).

On ASIAGO (the MacBook Air), `/etc/resolver/local` with a single line:

```
nameserver 10.0.15.67
```

This tells macOS's resolver (documented in `man 5 resolver`) to send `.local` queries to ROMANO via unicast DNS. It doesn't disable mDNS — it adds a parallel unicast resolution path. The first response wins. Since mDNS can't function over the tunnel (the TUN interface lacks multicast), the unicast path is the only one that returns results, and it looks like an override in practice.

When the tunnel is down, the file shouldn't exist — you want normal mDNS to handle `.local` on whatever network you're actually on. If the file sticks around while you're on the local LAN, you get a race between mDNS and unicast DNS that can cause intermittent resolution delays.

---

## Tunnelblick Scripts: The Nuance

Tunnelblick supports scripts that run when a VPN connects and disconnects. The right place to put them is inside the `.tblk` bundle itself — not in the installed copy, which gets wiped on configuration changes. My source of truth lives in `~/.config/tunnelblick/romano/VPNConfig.tblk/Contents/Resources/`.

**Important**: scripts inside the `.tblk` bundle run as root, which is required for writing to `/etc/resolver/`. If you create standalone scripts outside the bundle, Tunnelblick runs them as the current user and the `/etc/resolver/local` write fails silently — no error, no resolution, no obvious clue why.

`connected.sh`:

```bash
#!/bin/bash
mkdir -p /etc/resolver
# Overwrites any existing /etc/resolver/local — if you have
# other split-DNS entries there, back them up first.
echo "nameserver 10.0.15.67" > /etc/resolver/local
```

`disconnected.sh`:

```bash
#!/bin/bash
rm -f /etc/resolver/local
```

Drag the `.tblk` bundle into Tunnelblick to install. The scripts come with it. Update the config by editing the source bundle and reinstalling — the scripts survive because they're in the source, not the installed copy.

---

## Does It Work?

From a mobile hotspot in Spokane:

```
$ ping -c 3 10.0.15.67
64 bytes from 10.0.15.67: icmp_seq=0 ttl=64 time=105.830 ms
64 bytes from 10.0.15.67: icmp_seq=1 ttl=64 time=83.513 ms
64 bytes from 10.0.15.67: icmp_seq=2 ttl=64 time=99.414 ms

$ ssh mimolette.local
Last login: ...
andrewrich@MIMOLETTE ~ %
```

100ms round-trip over a hotspot is fine for SSH. The `.local` hostnames resolve. The tunnel comes up in about four seconds. I haven't tested it from a truly hostile network yet — the Alaska lounge test will come eventually — but TCP/443 should handle it.

There are probably more nuances. There always are.

---

## The Short Version

If you want to do this:

1. Run [Synology VPN Server](https://www.synology.com/en-us/dsm/packages/VPNCenter) with OpenVPN on **TCP/443** — it survives most restrictive networks (though SSL inspection proxies may still catch it)
2. Enable **Verify TLS auth key** — the server goes silent to unknown clients
3. Use a real hostname ([Synology DDNS](https://kb.synology.com/en-me/DSM/help/DSM/AdminCenter/connection_ddns) or your own) in the `.ovpn` config, not an IP
4. For `.local` hostname resolution over VPN: run [Synology DNS Server](https://www.synology.com/en-us/dsm/packages/DNSServer), create a `local` zone with A records, and use Tunnelblick scripts **inside the `.tblk` bundle** to create and destroy `/etc/resolver/local` on connect/disconnect
5. Keep your Tunnelblick config in a source `.tblk` bundle — the installed copy gets overwritten

The Synology makes this easier than it would be on bare Linux because the VPN and DNS packages are first-party and the GUI mostly stays out of your way. Mostly.

---

If you're an employer and you're thinking *I want someone who can build and secure infrastructure like this* — [I'm on LinkedIn](https://www.linkedin.com/in/andrewrich/) and [reachable by email](mailto:andrew@projectinsomnia.com). I'm a Principal SRE by trade, and this is the kind of work I do for fun.

If you're a business owner thinking *I need remote access to my infrastructure but don't want to build it myself* — that's exactly what [Night Owl Studio](https://nightowlstudio.us/) is for. Custom infrastructure, done by someone who's already made the mistakes so you don't have to.
