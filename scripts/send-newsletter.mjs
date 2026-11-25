import { pathToFileURL } from "node:url";
import Parser from "rss-parser";

const API = "https://api.buttondown.com/v1";

// Posts dated before this day are never emailed. Task 5 sets the final value.
export const LAUNCH_DATE = "2026-11-25";

// Buttondown docs, api-emails-create: "about_to_send: This email has been
// queued to send out to subscribers, and will be sent automatically within a
// few minutes."
export const SEND_NOW_STATUS = "about_to_send";

const utcDay = (value) => new Date(value).toISOString().slice(0, 10);

export function selectPostToSend({ items, emails, launchDate, now }) {
  const today = utcDay(now);
  const sentToday = emails.some(
    (email) =>
      email.status !== "draft" &&
      utcDay(email.publish_date ?? email.creation_date) === today,
  );
  if (sentToday) return { item: undefined, reason: "sent-today" };

  const launch = new Date(`${launchDate}T00:00:00Z`);
  const [item] = items
    .filter((i) => new Date(i.isoDate) >= launch)
    .filter((i) => !emails.some((email) => email.body?.includes(i.link)))
    .sort((a, b) => new Date(a.isoDate) - new Date(b.isoDate));
  return item
    ? { item, reason: "send" }
    : { item: undefined, reason: "nothing-new" };
}

export function emailFor({ title, link, contentSnippet }) {
  const readLink = `[Read it on projectinsomnia.com](${link})\n`;
  const body = contentSnippet ? `${contentSnippet}\n\n${readLink}` : readLink;
  return { subject: title, body };
}

async function listEmails(fetch, headers) {
  const emails = [];
  let url = `${API}/emails`;
  while (url) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`Buttondown list emails failed: HTTP ${response.status}`);
    }
    const page = await response.json();
    emails.push(...page.results);
    url = page.next;
  }
  return emails;
}

export async function run({ env, fetch, log, now }) {
  const dryRun = Boolean(env.DRY_RUN) && !["0", "false"].includes(env.DRY_RUN);
  try {
    const siteUrl = env.SITE_URL ?? "https://projectinsomnia.com";
    const feedResponse = await fetch(`${siteUrl}/rss.xml`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!feedResponse.ok) {
      throw new Error(`RSS fetch failed: HTTP ${feedResponse.status}`);
    }
    const feed = await new Parser().parseString(await feedResponse.text());
    if (feed.items.length === 0) throw new Error("RSS feed has no items");

    const headers = { Authorization: `Token ${env.BUTTONDOWN_API_KEY}` };
    const emails = await listEmails(fetch, headers);
    const { item, reason } = selectPostToSend({
      items: feed.items,
      emails,
      launchDate: LAUNCH_DATE,
      now,
    });
    if (!item) {
      log(`Nothing to send (${reason}).`);
      return 0;
    }

    const email = emailFor(item);
    log(`${dryRun ? "Would send" : "Sending"}: ${email.subject} ${item.link}`);
    if (dryRun) return 0;

    const response = await fetch(`${API}/emails`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...email, status: SEND_NOW_STATUS }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`Buttondown send failed: HTTP ${response.status}`);
    }
    return 0;
  } catch (error) {
    log(`Newsletter send failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run({
    env: process.env,
    fetch,
    log: console.log,
    now: new Date(),
  });
}
