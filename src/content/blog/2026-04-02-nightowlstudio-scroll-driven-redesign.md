---
title: "I Made the Sky Move with No JavaScript and One Regrettable Color Palette"
date: 2026-04-02
description: "Redesigning nightowlstudio.us with pure CSS scroll-driven animations: a forest that transitions from afternoon to night as you scroll, an owl that blinks, and one important accessibility bug I almost shipped."
tags: ["blog", "tech", "css", "design", "nightowlstudio"]
---

I've been running [Night Owl Studio](https://nightowlstudio.us/) — my little indie app and web studio — for about nine months. The landing page has been perfectly adequate the whole time: clean, readable, professional in a generic sort of way. The kind of site that communicates "we are a real business" without communicating much else.

That stopped being enough.

---

## The Concept

The name is Night Owl Studio. The logo is an owl. I live in the Pacific Northwest. The site should feel like that — not like a Tailwind starter template with my name on it.

The idea that stuck: as you scroll down the page, the background transitions from a warm Pacific Northwest afternoon through a spectacular sunset into a deep forest night. The content floats over this scene as translucent cards. By the time you reach the contact form, there's an owl perched in the treeline, watching you. Blinking.

The technical constraint I set for myself: no JavaScript. Not for ideological reasons — I just didn't want to add a scroll listener, manage RAF loops, or deal with IntersectionObserver for what is essentially decorative chrome. If it can't be done in CSS, it's too complicated for what it needs to be.

Turns out it can be done in CSS.

---

## CSS Scroll-Driven Animations

[Scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations) landed in Chrome 115 and have been getting steadily better browser support since. The core idea: instead of tying an animation's progress to time, you tie it to a scroll position. One property does this:

```css
animation-timeline: scroll(root block);
```

That tells the browser to map the animation's progress (0%–100%) to the document's scroll position (top to bottom). Combined with a `1ms` animation duration — a common idiom in the community that [Bramus Van Damme explains well](https://scroll-driven-animations.style/) — you get keyframe control over scroll position with zero JavaScript:

```css
@keyframes sky-transition {
    0%   { fill: #A8C4D8; }   /* afternoon haze */
    28%  { fill: #C85830; }   /* sunset */
    42%  { fill: #6B2A5A; }   /* twilight */
    100% { fill: #070A1C; }   /* deep night */
}

.sky {
    animation: sky-transition 1ms linear both;
    animation-timeline: scroll(root block);
}
```

The whole scene — sky, three layers of treeline, sun, moon, stars, owl, and four pairs of blinking wildlife eyes — is a single inline SVG fixed to the viewport. Everything transitions via keyframes tied to scroll. The scrollable content layer sits above it at `z-index: 1` as glassmorphic cards with `backdrop-filter: blur(8px)`.

[The scroll-driven animations demos site](https://scroll-driven-animations.style/) is worth an hour of your time if this is new to you. Bramus has built an extraordinary set of interactive examples that make the mental model click.

---

## The Wrong Turn I Almost Made

The original concept was more ambitious: the same shapes would read as *office geometry* in warm afternoon light — partitions, shelving, cable runs — and transform into *forest silhouettes* as the palette shifted to night. Same SVG paths, two readings, color does all the work.

This was a bad idea, and I'm glad I caught it before building it. Human visual pattern recognition categorizes silhouettes by *shape*, not color. Triangular peaks read as trees in warm light too. You'd need genuinely architectural geometry — flat tops, rectangular profiles, implied fenestration — to push the reading toward "office partition." That's a completely different SVG, and it would have been doing heavy lifting to achieve an effect that nobody would notice.

So: forest from the start. A good forest, not a clever one.

---

## Getting the Pacific Northwest Right

The first palette attempt was `#D4C8B0` for the afternoon sky — a warm sandy gold that looked beautiful in isolation and absolutely terrible in context. On screen it read as the Australian outback at high noon. Or possibly the Sonoran desert. Specifically not the inland Pacific Northwest, where even a clear August afternoon has a cool, slightly hazy quality to it.

The fix was pulling the daytime sky toward a muted blue — `#A8C4D8` — and grounding the treelines in actual conifer green rather than warm brown. The back treeline starts at `#7A9278`, the mid at `#526858`, the front at `#364238`. Together they read immediately as what they are: Pacific NW conifers in afternoon light, not abstract geometry.

The sunset transition through amber and orange still works, because that's actually what sunsets look like here in July. The purple twilight step at 42% (`#6B2A5A`) was a gamble that paid off — western skies go genuinely purple in that window between "the sun is gone" and "it's actually night."

---

## The Sun Has to Set Behind Something

The moon reveal was originally handled with a glowing rectangle (representing a whiteboard or window) that faded to expose a circle. This was clever in theory and looked like nothing in practice.

The replacement: a literal sun circle at `cx=720, cy=400` with a `translateY` keyframe that sinks it physically behind the back treeline as you scroll. The treeline, rendered above it in the SVG stacking order, does the occlusion. I added a horizon glow — a warm gradient rectangle that blooms at about 25% scroll and fades by 48% — to simulate the way the sky lights up from below during the actual sunset phase. The moon at `cx=1200, cy=148` stays fixed in position; it reveals through opacity as the sky darkens around it.

The result is a sequence you can feel without thinking about it. The sun goes somewhere. The sky responds. The moon was always there.

---

## The Owl

The background owl — not the logo, but the SVG silhouette that fades in at dusk — originally looked nothing like the logo. It was a generic rounded teardrop with two tiny dots for eyes, the kind of owl shape that comes out when you ask someone to draw an owl from memory.

The logo has a specific personality: wide swept ear-wings that give it an almost Art Deco silhouette, disproportionately large eyes, a small heart-shaped chest area, three-toed feet spread like it's gripping something. Getting that into a dark silhouette meant treating the ear sweeps as Bézier curves, scaling the eyes up to about 35% of the head width, and adding pupils — dark circles inside the white — because an owl without visible pupils in a dark scene looks more like a moth.

The blink is a `scaleY(0.05)` transform on both eye groups, running on a 7-second timer with a 0.4-second offset between left and right. Owls blink slowly and mostly synchronously. The slight offset keeps it from looking mechanical.

---

## The Bug I Almost Shipped

The `prefers-reduced-motion` block looked correct:

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
}
```

This is the standard pattern for disabling time-based animations. It works by making animations complete so fast they're imperceptible.

It does absolutely nothing for scroll-driven animations.

Scroll-driven animations are progress-based. `animation-duration` is meaningless when `animation-timeline: scroll()` is set — the browser ignores it. A user who has opted into reduced motion would have seen the full scene transition on every scroll, which is exactly the kind of thing that causes problems for people with vestibular disorders.

The fix is blunt and correct:

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation: none !important;
        transition-duration: 0.01ms !important;
    }
}
```

`animation: none` kills the `animation-timeline` along with everything else. The page renders in its static daytime state and stays there. I caught this in code review, but I'm noting it here because every writeup I found about scroll-driven animations either omits the reduced-motion case or uses the `duration` pattern without noting that it doesn't apply.

---

## Progressive Enhancement

[Browser support for `animation-timeline`](https://caniuse.com/css-animation-timeline) is solid in Chrome and Edge (115+) and arrived in Safari 26. Firefox doesn't support it yet. The whole scroll-driven block lives inside `@supports (animation-timeline: scroll())`, so Firefox gets a static night-theme fallback — deep sky, bright moon, stars and owl at full opacity — which looks intentional rather than broken.

The full scene is pure SVG, no external images. The treelines are hand-authored `<path>` elements in a `1920×1080` viewBox with `preserveAspectRatio="xMidYMid slice"`. The sun, moon, stars, owl, and wildlife eyes are all circles and paths. No canvas, no WebGL, no image assets for the background.

---

Go [take a look](https://nightowlstudio.us/) and scroll slowly. The owl is near the bottom.

---

## Two Ways to Interpret This Post

If you're an employer and you're thinking *I want someone who builds things like this on a team that has actual resources* — [I'm on LinkedIn](https://www.linkedin.com/in/andrewrich/) and [reachable by email](mailto:andrew@projectinsomnia.com). I'm a Principal SRE by trade, but as you can tell, the design and front-end work doesn't exactly get farmed out.

If you're a business owner thinking *I want a site that does something like this* — that's exactly what [Night Owl Studio](https://nightowlstudio.us/) is for. Custom web work, done by a person who gives a damn about how it looks and whether it actually works.
