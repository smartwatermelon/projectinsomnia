---
title: "Building a Website for Someone Who Actually Uses It"
date: 2026-04-02
description: "A cleaning business runs on Thumbtack at $30 per contact. I built a static site on Netlify to filter leads, cut costs, and give the owner a web presence she can edit herself."
tags: ["web", "design", "netlify"]
---

I've been a customer of T&J Cleaning since 2022. Juliet cleans our house every two weeks, does an exceptional job, and charges a reasonable rate. Her business runs almost entirely through [Thumbtack](https://www.thumbtack.com/), which is fine — until you learn that Thumbtack charges $30 for every contact, regardless of whether that contact becomes a customer.

That's $30 for someone who messages "do you clean offices?" when the profile clearly says residential only. $30 for the person who wants a quote, ghosts, and books someone else. $30 for every tire-kicker, every spam bot, every misdirected inquiry.

When Juliet mentioned she was thinking about a website, I offered to build one. Not to replace Thumbtack — she's built up a solid review history there — but to act as a filter. Give people enough information that only serious leads make it to the booking page. Reduce the $30-per-contact tax by improving the quality of contacts.

That was the pitch. What followed was a few weeks of actual client work, which turns out to be different from building things for yourself.

---

## The brief

The requirements were straightforward:

- Professional but not corporate
- Services, reviews, service area, contact form
- Link to Thumbtack for actual booking
- She needs to be able to edit it herself eventually
- Shouldn't look like every other cleaning service website

That last point was the interesting constraint.

---

## The anti-template problem

Search "cleaning service website template" and you'll find a hundred sites that look identical: stock photo of a smiling woman holding a spray bottle, teal accent color, "Your satisfaction is our priority!" headline, three feature boxes with icons of a broom, a clock, and a handshake.

This aesthetic has a name now. AI slop. It's what you get when you ask a language model to "make me a cleaning service website" without any further direction. The model converges on the statistical average of every cleaning service website it's seen, which means you get the same teal-and-stock-photo template that everyone else gets.

I wanted to avoid that. Not because those sites are bad — they're fine, they convert — but because they're forgettable. Juliet's differentiator is that she's a real person who shows up consistently, does thorough work, and builds relationships with her clients. The site should feel like that.

The design decisions:

**No stock photos.** The hero section has a custom line-art illustration instead. The gallery section uses Juliet's actual photos of her actual work. Real beats generic.

**Warm neutrals, not clinical teal.** The accent color is a muted sage green (`#5a6f4f`). It reads as "clean" without screaming "I am a cleaning service website." The palette is cream, warm gray, and sage — closer to a boutique hotel than a Thumbtack template.

**Serif headings.** Most service websites use geometric sans-serifs. I went with Libre Baskerville for headings — it adds warmth and feels more personal. Still professional, just not sterile.

**No sparkle emojis or cleaning puns.** Copy is direct and factual. "Thorough, detail-oriented cleaning" instead of "We make your home sparkle!" The tagline she ended up with — "Scrubbing 'til it sparkles" — was her idea, not mine.

---

## The funnel strategy

The site isn't just a brochure. It's a filter.

The contact form asks qualifying questions before collecting contact info: property type (apartment, 1-story house, 2-story house, multi-unit), desired frequency (weekly, biweekly, monthly, one-time). This serves two purposes.

First, it pre-qualifies leads. Someone who fills out "2-story house, biweekly" is a more serious prospect than someone who just fires off "how much?" from the Thumbtack search results.

Second, it gives Juliet information before the conversation starts. When she does get a lead, she knows what they need.

The "Book on Thumbtack" button is secondary — outlined, not filled. The default path is the contact form on the site. This means Juliet can have a conversation before a $30 charge hits.

---

## The technical stack

There isn't much of one. That's intentional.

```
index.html      Main page
styles.css      Stylesheet (extracted from inline for easier editing)
privacy.html    Privacy policy
terms.html      Terms of service
thank-you.html  Form submission confirmation
netlify.toml    Netlify config
_redirects      Redirect rules
images/         Favicon and site images
```

No build step. No framework. No JavaScript except what Netlify injects for form handling. The entire site is HTML and CSS that could have been written in 2010, deployed to Netlify via Git push.

The contact form uses [Netlify Forms](https://www.netlify.com/products/forms/), which detects `<form>` tags at build time, handles submissions, sends email notifications, and provides a dashboard for viewing responses. All without server-side code. For a small business contact form, it's exactly right.

Hosting costs: $0. Netlify's free tier handles everything. The domain is about $15/year. Total recurring cost for a fully functional business website: $15/year.

---

## Making it editable

Juliet is not a developer. She's also not going to pay me every time she wants to update her phone number. The site needed to be editable by someone who's never touched HTML.

GitHub turned out to be the answer, with some documentation.

The workflow: she goes to the repo, opens `index.html`, clicks the pencil icon, makes her change, creates a pull request. Netlify automatically builds a deploy preview and posts a link in the PR. She can see exactly how the change will look before it goes live. If it looks right, she merges. If not, she closes the PR and tries again.

The safety net is real. Pull requests are staging. Nothing touches the live site until it's explicitly merged. And even if something breaks, Git's history means any change can be rolled back in seconds.

I wrote two documentation files:

**README.md** explains the workflow — what HTML tags are, how to edit without breaking things, the pull request process.

**EDITING-COOKBOOK.md** is a recipe book for specific tasks. "To change the phone number, search for `tel:+1`, update both places." "To add a new review, copy this block, change the text." No HTML theory, just practical steps.

The first time she edited the site herself, she changed a phone number and added a review. Both changes went through, the preview looked correct, she merged. The model works.

---

## SEO and getting found

A website that nobody can find is just a business card with extra steps.

For local service businesses, the game is Google Business Profile. When someone searches "house cleaning spokane," Google shows a map with three businesses at the top. You cannot appear in that map pack without a Google Business Profile. The website helps with organic results, but the map is where local businesses live or die.

I put together an SEO guide for Juliet that focuses on the fundamentals:

1. Set up Google Business Profile (free, takes 20 minutes, requires address verification via postcard)
2. Start collecting Google reviews from happy customers
3. Get listed on Yelp, Bing Places, Apple Maps, Nextdoor with consistent business name/address/phone
4. Add structured data to the website so Google understands what the business is

None of this is complicated. Most of it is free. The hard part is actually doing it — claiming listings, asking for reviews, waiting for the verification postcard.

I also added LocalBusiness schema markup to the site, which gives Google structured information about the business name, service area, rating, and contact info. Whether this actually moves the needle is debatable, but it doesn't hurt and takes five minutes.

---

## What I learned

Building for yourself is different from building for a client. When I build something for my own use, I can tolerate rough edges because I understand the context. I know what the buttons do because I made them.

Clients don't have that context. Every piece of UI needs to be self-explanatory. Every error state needs to be recoverable. The documentation needs to anticipate questions before they're asked.

The other thing: clients have opinions, and those opinions are often good. Juliet rewrote most of the copy. Her version is better than mine — more specific, more personal, more her. She knew which photos to use, which services to highlight, how she wanted to describe her approach. My job was to create the structure and get out of the way.

---

## The result

The site is live at [tnjcleaning.com](https://tnjcleaning.com/). It's fast, it's accessible, it works on phones, and it looks like a real business — because it is one.

Total time investment: maybe 15 hours across a few weeks, including all the iteration, documentation, and SEO research. Total hosting cost: free tier. Total annual cost to run: domain registration.

Whether it reduces Juliet's Thumbtack spend remains to be seen. That's the actual measure of success. The site itself is just plumbing — a way to get better leads for less money. If it works, the return on investment is essentially infinite. If it doesn't, at least she has a professional web presence that cost next to nothing.

Either way, I got to build something real for someone who will actually use it. That's more satisfying than another side project that lives in a private repo forever.
