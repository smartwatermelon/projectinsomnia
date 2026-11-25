import assert from "node:assert/strict";
import test from "node:test";

let fn = {};
try {
  fn = await import("../netlify/functions/submission-created.mts");
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const { addSubscriber } = fn;
const handler = fn.default;
const reply = (status, body = "{}") => async () => new Response(body, { status });

test("addSubscriber posts the address, and the IP only when given", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response("{}", { status: 201 });
  };
  assert.equal(await addSubscriber({ email: "a@b.co", apiKey: "k", fetch }), "created");
  assert.equal(
    await addSubscriber({ email: "a@b.co", ipAddress: "203.0.113.9", apiKey: "k", fetch }),
    "created",
  );
  assert.equal(calls[0].url, "https://api.buttondown.com/v1/subscribers");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Token k");
  assert.deepEqual(JSON.parse(calls[0].init.body), { email_address: "a@b.co" });
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    email_address: "a@b.co",
    ip_address: "203.0.113.9",
  });
});

test("addSubscriber treats 400 as an existing subscriber", async () => {
  assert.equal(await addSubscriber({ email: "a@b.co", apiKey: "k", fetch: reply(400, '{"code":"email_already_exists"}') }),
    "exists",
  );
});

test("addSubscriber rejects on any other 400, without the address", async () => {
  await assert.rejects(
    addSubscriber({
      email: "secret@b.co",
      apiKey: "k",
      fetch: reply(400, '{"code":"email_invalid","detail":"secret@b.co is bad"}'),
    }),
    (error) =>
      error.message.includes("400 email_invalid") && !error.message.includes("secret@b.co"),
  );
  await assert.rejects(addSubscriber({ email: "a@b.co", apiKey: "k", fetch: reply(400, "nope") }), /HTTP 400$/);
});

test("addSubscriber rejects on 5xx with the status and without the address", async () => {
  await assert.rejects(
    addSubscriber({ email: "secret@b.co", apiKey: "k", fetch: reply(500) }),
    (error) => error.message.includes("500") && !error.message.includes("secret@b.co"),
  );
});

function request(payload) {
  return new Request("https://example.com/", {
    method: "POST",
    body: JSON.stringify({ payload }),
  });
}

async function withStubs(fetchStub, body) {
  const saved = { fetch: globalThis.fetch, Netlify: globalThis.Netlify, log: console.log, warn: console.warn, error: console.error };
  const logged = [];
  const capture = (...args) => logged.push(args.join(" "));
  globalThis.fetch = fetchStub;
  globalThis.Netlify = { env: { get: () => "key" } };
  console.log = console.warn = console.error = capture;
  try {
    await body(logged);
  } finally {
    globalThis.fetch = saved.fetch;
    globalThis.Netlify = saved.Netlify;
    console.log = saved.log;
    console.warn = saved.warn;
    console.error = saved.error;
  }
}

test("the handler ignores other forms", async () => {
  let calls = 0;
  await withStubs(async () => { calls += 1; return new Response("{}", { status: 201 }); }, async () => {
    await handler(request({ form_name: "contact", data: { email: "a@b.co" } }));
  });
  assert.equal(calls, 0);
});

test("the handler trims the address and logs neither address nor IP", async () => {
  const bodies = [];
  const stub = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response("{}", { status: 201 });
  };
  await withStubs(stub, async (logged) => {
    const response = await handler(
      request({ form_name: "subscribe", data: { email: " reader@b.co ", ip: "203.0.113.9" } }),
    );
    assert.equal(response.status, 200);
    const text = logged.join("\n");
    assert.ok(!text.includes("reader@b.co"));
    assert.ok(!text.includes("203.0.113.9"));
    assert.ok(text.includes("r***@b.co"));
  });
  assert.deepEqual(bodies, [{ email_address: "reader@b.co", ip_address: "203.0.113.9" }]);
});

test("the handler makes no call for an invalid address", async () => {
  let calls = 0;
  await withStubs(async () => { calls += 1; return new Response("{}", { status: 201 }); }, async () => {
    await handler(request({ form_name: "subscribe", data: { email: "not-an-email" } }));
  });
  assert.equal(calls, 0);
});

test("the handler rejects when the API key is missing", async () => {
  let calls = 0;
  await withStubs(async () => { calls += 1; return new Response("{}", { status: 201 }); }, async () => {
    globalThis.Netlify = { env: { get: () => undefined } };
    await assert.rejects(
      handler(request({ form_name: "subscribe", data: { email: "a@b.co" } })),
      /BUTTONDOWN_API_KEY/,
    );
  });
  assert.equal(calls, 0);
});
