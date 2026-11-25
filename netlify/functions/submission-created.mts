// Netlify runs this on each verified Netlify Forms submission (event function,
// so no config.path). It hands the address to Buttondown, which sends the
// double opt-in email. To change provider, replace addSubscriber and the env var.

const API = "https://api.buttondown.com/v1";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DUPLICATE_CODES = new Set(["email_already_exists", "subscriber_already_exists"]);

type Fetch = typeof fetch;

export async function addSubscriber({
  email,
  ipAddress,
  apiKey,
  fetch: doFetch = fetch,
}: {
  email: string;
  ipAddress?: string;
  apiKey: string;
  fetch?: Fetch;
}): Promise<"created" | "exists"> {
  const response = await doFetch(`${API}/subscribers`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      ...(ipAddress ? { ip_address: ipAddress } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 201) return "created";
  // Use the error code only: `detail` may contain the address.
  let code = "";
  try {
    const body = await response.json();
    if (typeof body?.code === "string") code = body.code;
  } catch {
    // body is not JSON; report the status alone
  }
  if (response.status === 400 && DUPLICATE_CODES.has(code)) return "exists";
  throw new Error(
    `Buttondown subscriber request failed: HTTP ${response.status}${code ? ` ${code}` : ""}`,
  );
}

function redact(email: string): string {
  const [local, domain] = email.split("@");
  return `${local[0]}***@${domain}`;
}

export default async function handler(req: Request): Promise<Response> {
  const { payload } = await req.json();
  if (payload?.form_name !== "subscribe") return new Response("ignored");

  const email = String(payload.data?.email ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) {
    console.warn("subscribe: ignored an invalid address");
    return new Response("invalid email");
  }

  const apiKey = Netlify.env.get("BUTTONDOWN_API_KEY");
  if (!apiKey) throw new Error("BUTTONDOWN_API_KEY is not set");

  const outcome = await addSubscriber({ email, ipAddress: payload.data?.ip || undefined, apiKey });
  console.log(`subscribe: ${outcome} ${redact(email)}`);
  return new Response("ok");
}
