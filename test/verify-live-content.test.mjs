// Tests for scripts/verify-live-content.sh against a local stub site.
// Each bad case proves a check can fail; the request log proves the script
// only sends GETs and never touches /.netlify/ (the cost rule in #171).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const SCRIPT = new URL("../scripts/verify-live-content.sh", import.meta.url).pathname;

const page = (h1, extra = "") => `<html><body><h1>${h1}</h1>${extra}</body></html>`;

const nowHtml = (githubUser = "twistedmelonman", instagramUser = "smartwatermelon") =>
  page(
    "Now",
    `<img src="https://ghchart.rshah.org/4338ca/${githubUser}" alt="graph" />` +
      `<a href="https://github.com/${githubUser}" target="_blank">GitHub</a>` +
      `<a href="https://www.instagram.com/${instagramUser}/" target="_blank">Instagram</a>`,
  );

const json = (body, status = 200) => ({ status, type: "application/json", body: JSON.stringify(body) });
const html = (body) => ({ status: 200, type: "text/html; charset=utf-8", body });

function goodSite() {
  return {
    "/": html(page("Project Insomnia")),
    "/blog/": html(page("Blog")),
    "/about/": html(page("About")),
    "/projects/": html(page("Projects")),
    "/now/": html(nowHtml()),
    "/4338ca/twistedmelonman": { status: 200, type: "image/svg+xml", body: "<svg/>" },
    "/api/github-feed": json({ items: [{ title: "pushed repo", link: "https://github.com/x/y" }] }),
    "/api/instagram-feed": json({ posts: [{ imageUrl: "/api/instagram-image/abc", postUrl: "https://instagr.am/p/abc/" }] }),
    "/api/instagram-image/abc": { status: 200, type: "image/jpeg", body: "jpeg" },
  };
}

async function run(routes, env = {}, baseSuffix = "") {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const route = routes[req.url];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    const headers = { "content-type": route.type };
    if (route.location) headers.location = route.location;
    res.writeHead(route.status, headers).end(route.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const child = spawn("bash", [SCRIPT, `${base}${baseSuffix}`], {
      env: { ...process.env, GHCHART_BASE: base, KNOWN_FAILURES: "", ...env },
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const code = await new Promise((resolve) => child.on("close", resolve));
    return { code, output, requests };
  } finally {
    server.close();
  }
}

test("passes on a healthy site, sending only GETs and no /.netlify/ requests", async () => {
  const { code, output, requests } = await run(goodSite());
  assert.equal(code, 0, output);
  assert.ok(requests.length > 0);
  for (const r of requests) {
    assert.match(r, /^GET /, `non-GET request: ${r}`);
    assert.doesNotMatch(r, /\/\.netlify\//, `forbidden path: ${r}`);
  }
});

test("fails when /now shows the org account instead of the personal one", async () => {
  const site = goodSite();
  site["/now/"] = html(nowHtml("smartwatermelon"));
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /contribution graph is not/);
  assert.match(output, /GitHub profile link is not/);
});

test("fails when /now links the wrong Instagram account", async () => {
  const site = goodSite();
  site["/now/"] = html(nowHtml("twistedmelonman", "someoneelse"));
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /Instagram profile link is not/);
});

test("fails when a route serves the wrong page", async () => {
  const site = goodSite();
  site["/about/"] = html(page("Blog"));
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /\/about\/ does not show <h1>About<\/h1>/);
});

test("fails when the contribution graph is not an SVG", async () => {
  const site = goodSite();
  site["/4338ca/twistedmelonman"] = { status: 500, type: "text/plain", body: "org" };
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /contribution graph returned HTTP 500/);
});

test("fails when the GitHub feed is empty", async () => {
  const site = goodSite();
  site["/api/github-feed"] = json({ items: [] });
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /github feed returned HTTP 200 without well-formed items/);
});

test("fails when the Instagram feed uses the wrong key", async () => {
  const site = goodSite();
  site["/api/instagram-feed"] = json({ items: [{ imageUrl: "/api/instagram-image/abc", postUrl: "x" }] });
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /instagram feed returned HTTP 200 without well-formed items/);
});

test("fails when the first Instagram image is not served", async () => {
  const site = goodSite();
  delete site["/api/instagram-image/abc"];
  const { code, output } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /\/api\/instagram-image\/abc returned HTTP 404/);
});

test("a feed 502 fails the run unless that feed is a known failure", async () => {
  const site = goodSite();
  site["/api/github-feed"] = json({ items: [] }, 502);
  const strict = await run(site);
  assert.equal(strict.code, 1, strict.output);
  const known = await run(site, { KNOWN_FAILURES: "github" });
  assert.equal(known.code, 0, known.output);
  assert.match(known.output, /known failure, not counted/);
});

test("warns when a known failure starts passing", async () => {
  const { code, output } = await run(goodSite(), { KNOWN_FAILURES: "github" });
  assert.equal(code, 0, output);
  assert.match(output, /github feed now passes; remove it from KNOWN_FAILURES/);
});

test("does not request the removed Strava feed", async () => {
  const { code, output, requests } = await run(goodSite());
  assert.equal(code, 0, output);
  assert.ok(!requests.some((r) => r.includes("strava")), requests.join("\n"));
});

test("does not follow a redirect toward /.netlify/", async () => {
  const site = goodSite();
  site["/api/github-feed"] = { status: 302, type: "text/plain", body: "", location: "/.netlify/functions/scheduled-rebuild" };
  site["/.netlify/functions/scheduled-rebuild"] = json({ items: [{ title: "x", link: "https://github.com/x" }] });
  const { code, output, requests } = await run(site);
  assert.equal(code, 1, output);
  assert.match(output, /github feed returned HTTP 302/);
  assert.ok(!requests.some((r) => r.includes("/.netlify/")), requests.join("\n"));
});

test("refuses /.netlify/ URLs before sending any request", async () => {
  const { code, output, requests } = await run(goodSite(), {}, "/.netlify/functions");
  assert.equal(code, 2, output);
  assert.match(output, /\/\.netlify\/ paths are off limits/);
  assert.deepEqual(requests, []);
});
