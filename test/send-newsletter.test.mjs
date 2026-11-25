import assert from "node:assert/strict";
import test from "node:test";

let newsletter = {};
try {
  newsletter = await import("../scripts/send-newsletter.mjs");
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const { selectPostToSend, emailFor, run, SEND_NOW_STATUS } = newsletter;
const NOW = new Date("2026-12-01T15:00:00Z");
const LAUNCH = "2026-11-25";
const post = (slug, isoDate) => ({
  title: `Post ${slug}`,
  link: `https://projectinsomnia.com/blog/${slug}/`,
  isoDate,
  contentSnippet: `About ${slug}`,
});
const select = (items, emails = []) =>
  selectPostToSend({ items, emails, launchDate: LAUNCH, now: NOW });

test("never selects items older than the launch date", () => {
  const result = select([post("old", "2026-11-24T10:00:00.000Z")]);
  assert.deepEqual(result, { item: undefined, reason: "nothing-new" });
});

test("skips an item whose link is already in an email body", () => {
  const items = [post("a", "2026-11-26T10:00:00.000Z")];
  const emails = [
    {
      body: "See https://projectinsomnia.com/blog/a/ now",
      status: "sent",
      publish_date: "2026-11-27T10:00:00Z",
    },
  ];
  assert.equal(select(items, emails).reason, "nothing-new");
});

test("selects the oldest of two eligible items", () => {
  const items = [
    post("new", "2026-11-30T10:00:00.000Z"),
    post("older", "2026-11-26T10:00:00.000Z"),
  ];
  const result = select(items);
  assert.equal(result.reason, "send");
  assert.equal(result.item.link, items[1].link);
});

test("stops when a non-draft email went out today (UTC)", () => {
  const items = [post("a", "2026-11-26T10:00:00.000Z")];
  const sent = { body: "x", status: "sent", publish_date: "2026-12-01T01:00:00Z" };
  assert.equal(select(items, [sent]).reason, "sent-today");
  const viaCreation = { body: "x", status: "sent", creation_date: "2026-12-01T01:00:00Z" };
  assert.equal(select(items, [viaCreation]).reason, "sent-today");
});

test("a draft dated today does not count as sent", () => {
  const items = [post("a", "2026-11-26T10:00:00.000Z")];
  const draft = { body: "x", status: "draft", publish_date: "2026-12-01T01:00:00Z" };
  assert.equal(select(items, [draft]).reason, "send");
});

test("emailFor builds the subject and Markdown body", () => {
  const link = "https://projectinsomnia.com/blog/x/";
  assert.deepEqual(emailFor({ title: "T", link, contentSnippet: "D" }), {
    subject: "T",
    body: `D\n\n[Read it on projectinsomnia.com](${link})\n`,
  });
  assert.equal(
    emailFor({ title: "T", link, contentSnippet: "" }).body,
    `[Read it on projectinsomnia.com](${link})\n`,
  );
});

const rssXml = (items) => `<?xml version="1.0"?><rss version="2.0"><channel>
<title>t</title><link>https://projectinsomnia.com/</link><description>d</description>
${items
  .map(
    (i) => `<item><title>${i.title}</title><link>${i.link}</link>
<description>${i.contentSnippet}</description><pubDate>${new Date(i.isoDate).toUTCString()}</pubDate></item>`,
  )
  .join("")}</channel></rss>`;

function stubFetch({ rss, emailPages, rssStatus = 200 }) {
  const requests = [];
  const pages = [...emailPages];
  const fn = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/rss.xml")) {
      return new Response(rss, { status: rssStatus });
    }
    if (options.method === "POST") {
      return new Response("{}", { status: 201 });
    }
    const page = pages.shift();
    return new Response(JSON.stringify(page.body), { status: page.status ?? 200 });
  };
  fn.requests = requests;
  return fn;
}

const runWith = (fetchStub, env = {}) =>
  run({
    env: { BUTTONDOWN_API_KEY: "key", ...env },
    fetch: fetchStub,
    log: () => {},
    now: NOW,
  });
const posts = (f) => f.requests.filter((r) => r.options.method === "POST");
const goodRss = rssXml([post("a", "2026-11-26T10:00:00.000Z")]);

test("run lists email pages via next and skips a link found on page 2", async () => {
  const f = stubFetch({
    rss: goodRss,
    emailPages: [
      { body: { results: [], next: "https://api.buttondown.com/v1/emails?page=2" } },
      {
        body: {
          results: [{ body: "https://projectinsomnia.com/blog/a/", status: "sent", publish_date: "2026-11-27T00:00:00Z" }],
          next: null,
        },
      },
    ],
  });
  assert.equal(await runWith(f), 0);
  assert.equal(posts(f).length, 0);
});

test("DRY_RUN makes no POST and exits 0", async () => {
  const f = stubFetch({ rss: goodRss, emailPages: [{ body: { results: [], next: null } }] });
  assert.equal(await runWith(f, { DRY_RUN: "1" }), 0);
  assert.equal(posts(f).length, 0);
});

test("email list failure exits 1 with no POST", async () => {
  const f = stubFetch({ rss: goodRss, emailPages: [{ status: 500, body: {} }] });
  assert.equal(await runWith(f), 1);
  assert.equal(posts(f).length, 0);
});

test("RSS failure or an empty feed exits 1", async () => {
  const bad = stubFetch({ rss: "oops", rssStatus: 500, emailPages: [] });
  assert.equal(await runWith(bad), 1);
  const empty = stubFetch({ rss: rssXml([]), emailPages: [{ body: { results: [], next: null } }] });
  assert.equal(await runWith(empty), 1);
  assert.equal(posts(bad).length + posts(empty).length, 0);
});

test("normal path sends exactly one email with the send-now status", async () => {
  const f = stubFetch({ rss: goodRss, emailPages: [{ body: { results: [], next: null } }] });
  assert.equal(await runWith(f), 0);
  assert.equal(posts(f).length, 1);
  const [request] = posts(f);
  assert.equal(request.url, "https://api.buttondown.com/v1/emails");
  assert.equal(request.options.headers.Authorization, "Token key");
  assert.equal(request.options.headers["X-Buttondown-Live-Dangerously"], "true");
  const gets = f.requests.filter((r) => r.options.method !== "POST");
  assert.ok(gets.every((r) => !r.options.headers?.["X-Buttondown-Live-Dangerously"]));
  assert.deepEqual(JSON.parse(request.options.body), {
    subject: "Post a",
    body: "About a\n\n[Read it on projectinsomnia.com](https://projectinsomnia.com/blog/a/)\n",
    status: SEND_NOW_STATUS,
  });
});
