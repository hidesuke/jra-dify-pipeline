#!/usr/bin/env node
/**
 * Dify 同時実行数 N（既定 3、KV、/concurrency）と Queue バッチの制御。
 * Usage: node --experimental-strip-types scripts/test-concurrency.mjs
 */

import { readFileSync } from "node:fs";
import worker from "../src/index.ts";
import { DIFY_QUEUE_MAX_RETRIES } from "../src/dify.ts";
import { getStoredSeed, MemorySeedKv } from "../src/seedStore.ts";
import { DEFAULT_SEED } from "../src/checksum.ts";
import {
  DIFY_CONCURRENCY_DEFAULT,
  DIFY_CONCURRENCY_KEY,
  DIFY_CONCURRENCY_MAX,
  DIFY_CONCURRENCY_MIN,
  effectiveAttempts,
  parseConcurrencyInput,
  readConcurrency,
  splitForConcurrency,
} from "../src/concurrency.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

function parseJsonc(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += c;
  }
  return JSON.parse(out);
}

const wrangler = parseJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const consumer = wrangler.queues.consumers[0];
assert(consumer.queue === "jra-race-queue", "consumer queue name");
assert(
  consumer.max_batch_size === DIFY_CONCURRENCY_MAX,
  `max_batch_size ${consumer.max_batch_size} matches DIFY_CONCURRENCY_MAX ${DIFY_CONCURRENCY_MAX}`
);
assert(consumer.max_concurrency === 1, `max_concurrency is 1, got ${consumer.max_concurrency}`);
assert(
  consumer.max_retries === DIFY_QUEUE_MAX_RETRIES,
  `max_retries stays ${DIFY_QUEUE_MAX_RETRIES}`
);
assert(consumer.max_batch_timeout === 5, "max_batch_timeout stays 5");
assert(DIFY_CONCURRENCY_DEFAULT === 3, "default concurrency is 3");
assert(DIFY_CONCURRENCY_MIN === 1 && DIFY_CONCURRENCY_MAX <= 100, "concurrency bounds fit one sendBatch");

assert(parseConcurrencyInput(3) === 3, "number 3");
assert(parseConcurrencyInput("10") === 10, "string 10");
assert(parseConcurrencyInput(" 4 ") === 4, "trimmed string");
assert(parseConcurrencyInput(1) === 1, "min bound");
assert(parseConcurrencyInput(0) === null, "reject 0");
assert(parseConcurrencyInput(11) === null, "reject above max");
assert(parseConcurrencyInput(1.5) === null, "reject fraction");
assert(parseConcurrencyInput("03") === null, "reject leading zero");
assert(parseConcurrencyInput("1e1") === null, "reject exponent");
assert(parseConcurrencyInput("") === null, "reject empty");
assert(parseConcurrencyInput(null) === null, "reject null");
assert(parseConcurrencyInput(true) === null, "reject boolean");

assert(effectiveAttempts(1, undefined) === 1, "no priorAttempts uses queue attempts");
assert(effectiveAttempts(4, undefined) === 4, "fourth delivery stays fourth");
assert(effectiveAttempts(1, 1) === 1, "deferred fresh message is still attempt 1");
assert(effectiveAttempts(2, 1) === 2, "retry after a deferral increments once");
assert(effectiveAttempts(1, 2) === 2, "carried attempt 2 is not reset");
assert(effectiveAttempts(2, 3) === 4, "carried 3 plus queue 2 is attempt 4");
assert(effectiveAttempts(1, 0) === 1, "invalid prior 0 is ignored");
assert(effectiveAttempts(2, 101) === 2, "absurd priorAttempts is ignored");

const five = [1, 2, 3, 4, 5];
const splitDefault = splitForConcurrency(five, 0);
assert(splitDefault.active.join(",") === "1,2,3", "non-positive concurrency falls back to 3");
assert(splitDefault.deferred.join(",") === "4,5", "the rest is deferred");
const splitOne = splitForConcurrency(five, 1);
assert(splitOne.active.join(",") === "1" && splitOne.deferred.length === 4, "concurrency 1 takes the first only");
assert(splitForConcurrency([], 3).active.length === 0, "empty batch");

function race(raceNo, extra = {}) {
  return {
    targetDate: "2026-09-12",
    venueCode: "06",
    raceNo,
    raceUrl: `https://example.test/race-${raceNo}`,
    ...extra,
  };
}

function fakeMessage(body, attempts = 1) {
  const state = { acked: false, retried: false };
  return {
    id: `${body.raceUrl}#${attempts}`,
    timestamp: new Date("2026-09-12T00:00:00.000Z"),
    body,
    attempts,
    ack() {
      state.acked = true;
    },
    retry() {
      state.retried = true;
    },
    state,
  };
}

function batchOf(messages) {
  return {
    queue: "jra-race-queue",
    messages,
    ackAll() {},
    retryAll() {},
  };
}

function sseSuccess() {
  return new Response(
    'data: {"event":"workflow_finished","workflow_run_id":"run-1","data":{"status":"succeeded","id":"run-1"}}\n\n',
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );
}

function queueHarness(kv = new MemorySeedKv()) {
  const sent = [];
  const emails = [];
  let sendError = null;
  const env = {
    DIFY_API_URL: "https://dify.example/v1/workflows/run",
    DIFY_API_KEY: "test-key",
    CHECKSUM_SEED: kv,
    NOTIFY_EMAIL: "ops@example.com",
    NOTIFY_FROM: "noreply@example.com",
    EMAIL: {
      async send(message) {
        emails.push(message);
      },
    },
    RACE_QUEUE: {
      async sendBatch(messages) {
        if (sendError) throw sendError;
        sent.push(messages);
      },
    },
  };
  return {
    env,
    sent,
    emails,
    failSend(error) {
      sendError = error;
    },
  };
}

async function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const kv = new MemorySeedKv();
assert((await readConcurrency(kv)).concurrency === 3, "unset KV reads default 3");
assert((await readConcurrency(kv)).source === "default", "unset KV source is default");
await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 99 }));
assert((await readConcurrency(kv)).concurrency === 3, "out-of-range KV falls back to default");
await kv.put(DIFY_CONCURRENCY_KEY, "not-json");
assert((await readConcurrency(kv)).source === "default", "corrupt KV falls back to default");
await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 4, updatedAt: "2026-09-12T00:00:00.000Z" }));
const stored = await readConcurrency(kv);
assert(stored.concurrency === 4 && stored.source === "kv", "valid KV value is used");
assert(stored.updatedAt === "2026-09-12T00:00:00.000Z", "updatedAt is kept");

const throwingKv = {
  async get() {
    throw new Error("kv down");
  },
  async put() {
    throw new Error("kv down");
  },
};
assert((await readConcurrency(throwingKv)).concurrency === 3, "KV read error uses default");

const secret = "test-secret";
const ctx = {};

async function call(path, env, init = undefined) {
  const res = await worker.fetch(new Request(`https://example.test${path}`, init), env, ctx);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // text response
  }
  return { status: res.status, text, json, headers: res.headers };
}

{
  const denied = await call("/concurrency", { PREDICT_SECRET: secret, CHECKSUM_SEED: kv });
  assert(denied.status === 401, `missing bearer is 401, got ${denied.status}`);
  assert(!denied.text.includes("4"), "401 body does not leak the stored concurrency");
}

{
  const unconfigured = await call("/concurrency", { CHECKSUM_SEED: kv });
  assert(unconfigured.status === 503, `auth not configured is 503, got ${unconfigured.status}`);
}

{
  const auth = {
    headers: { Authorization: `Bearer ${secret}` },
  };
  const env = { PREDICT_SECRET: secret, CHECKSUM_SEED: new MemorySeedKv() };
  const got = await call("/concurrency", env, auth);
  assert(got.status === 200, `GET default status ${got.status}`);
  assert(got.json?.concurrency === 3 && got.json.source === "default", `GET default body ${got.text}`);
  assert(got.json?.min === 1 && got.json.max === 10 && got.json.default === 3, "GET includes bounds");
  assert(got.json?.updatedAt === null, "default has no updatedAt");
  assert(got.headers.get("cache-control") === "no-store", "concurrency response is not cached");
  assert(got.headers.get("x-robots-tag")?.includes("noindex"), "concurrency is noindex");

  const ignored = await call("/concurrency?concurrency=9", env, auth);
  assert(ignored.json?.concurrency === 3 && ignored.json.source === "default", "GET does not apply the query");

  const posted = await call("/concurrency?concurrency=4", env, { ...auth, method: "POST" });
  assert(posted.status === 200 && posted.json?.concurrency === 4 && posted.json.source === "kv", `POST query ${posted.text}`);
  assert(typeof posted.json?.updatedAt === "string", "POST sets updatedAt");

  const again = await call("/concurrency/", env, auth);
  assert(again.json?.concurrency === 4, "trailing slash GET sees the stored value");

  const form = await call("/concurrency", env, {
    method: "POST",
    headers: { ...auth.headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: "concurrency=2",
  });
  assert(form.status === 200 && form.json?.concurrency === 2, `form post ${form.text}`);

  const put = await call("/concurrency", env, {
    method: "PUT",
    headers: { ...auth.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ concurrency: 10 }),
  });
  assert(put.status === 200 && put.json?.concurrency === 10, `PUT json ${put.text}`);

  const raw = await call("/concurrency", env, {
    method: "POST",
    headers: auth.headers,
    body: "1",
  });
  assert(raw.status === 200 && raw.json?.concurrency === 1, `raw body ${raw.text}`);

  for (const bad of ["0", "11", "1.5", ""]) {
    const res = await call(`/concurrency?concurrency=${encodeURIComponent(bad)}`, env, { ...auth, method: "POST" });
    assert(res.status === 400, `reject ${JSON.stringify(bad)} with 400, got ${res.status}`);
  }
  const missing = await call("/concurrency", env, { ...auth, method: "POST" });
  assert(missing.status === 400, "POST without a value is 400");
  const still = await call("/concurrency", env, auth);
  assert(still.json?.concurrency === 1, "rejected writes do not change the stored value");

  const method = await call("/concurrency", env, { ...auth, method: "DELETE" });
  assert(method.status === 405, `DELETE is 405, got ${method.status}`);
  assert(method.headers.get("allow") === "GET, POST, PUT", `Allow header ${method.headers.get("allow")}`);

  const wrong = await call("/concurrency", env, { headers: { Authorization: "Bearer no" } });
  assert(wrong.status === 401, "wrong bearer is 401");

  assert((await getStoredSeed(env.CHECKSUM_SEED)) === DEFAULT_SEED, "concurrency key does not change the checksum seed");
  const rawRecord = await env.CHECKSUM_SEED.get(DIFY_CONCURRENCY_KEY);
  assert(rawRecord?.includes('"concurrency":1'), `stored record ${rawRecord}`);
}

{
  const noKv = await call("/concurrency", { PREDICT_SECRET: secret }, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: "concurrency=3",
  });
  assert(noKv.status === 503, `POST without KV is 503, got ${noKv.status}`);
  const readOnly = await call("/concurrency", { PREDICT_SECRET: secret }, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  assert(readOnly.status === 200 && readOnly.json?.source === "default", "GET without KV still reports the default");
}

async function runQueue(env, messages, fetchImpl) {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  await withFetch(async (url, init) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), body, at: calls.length });
    try {
      return await fetchImpl(body, calls.length);
    } finally {
      inFlight--;
    }
  }, () => worker.queue(batchOf(messages), env));
  return { calls, maxInFlight };
}

{
  const harness = queueHarness(new MemorySeedKv());
  const messages = [1, 2, 3, 4, 5].map((n) => fakeMessage(race(n)));
  const { calls, maxInFlight } = await runQueue(harness.env, messages, async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return sseSuccess();
  });
  assert(calls.length === 3, `default N sends 3 races, got ${calls.length}`);
  assert(maxInFlight === 3, `default N overlaps 3 calls, got ${maxInFlight}`);
  assert(calls.map((c) => c.body.inputs.url).join(",") === "https://example.test/race-1,https://example.test/race-2,https://example.test/race-3", "first 3 races are sent");
  assert(messages.slice(0, 3).every((m) => m.state.acked && !m.state.retried), "processed races are acked");
  assert(messages.slice(3).every((m) => m.state.acked && !m.state.retried), "deferred races are acked after requeue");
  assert(harness.sent.length === 1 && harness.sent[0].length === 2, "two races are requeued once");
  assert(
    harness.sent[0].every((m) => m.body.priorAttempts === 1 && m.body.raceUrl.startsWith("https://example.test/")),
    "requeued races keep the body and carry attempt 1"
  );
  assert(harness.emails.length === 0, "deferral does not send a failure email");
  assert(calls[0].body.inputs.remarks === "2026-09-12 場:06 1R", "remarks stay date/venue/race");
  assert(calls[0].body.query === "2026-09-12 場:06 1R", "query does not include baba");
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 2 }));
  const harness = queueHarness(kv);
  const messages = [1, 2, 3, 4].map((n) => fakeMessage(race(n, n === 1 ? { baba: { summary: "馬場テスト", measuredAt: "7時" } } : {})));
  const order = [];
  const originalSend = harness.env.RACE_QUEUE.sendBatch;
  harness.env.RACE_QUEUE.sendBatch = async (messagesToSend) => {
    order.push("requeue");
    await originalSend.call(harness.env.RACE_QUEUE, messagesToSend);
  };
  let inFlight = 0;
  let maxInFlight = 0;
  await withFetch(async (_url, init) => {
    order.push("fetch");
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 30));
    inFlight--;
    return sseSuccess();
  }, () => worker.queue(batchOf(messages), harness.env));
  assert(order[0] === "requeue", `excess is requeued before Dify calls, got ${order.join(",")}`);
  assert(order.filter((e) => e === "fetch").length === 2, "N=2 fetches two races");
  assert(maxInFlight === 2, `N=2 never overlaps more than 2, got ${maxInFlight}`);
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 1 }));
  const harness = queueHarness(kv);
  const message = fakeMessage(race(1, { baba: { summary: "馬場テスト", measuredAt: "7時" } }));
  const { calls } = await runQueue(harness.env, [message], async () => sseSuccess());
  assert(calls.length === 1, "single race within N is sent");
  assert(harness.sent.length === 0, "nothing is requeued when the batch fits in N");
  assert(calls[0].body.inputs.remarks.includes("馬場テスト"), `baba stays on remarks: ${calls[0].body.inputs.remarks}`);
  assert(!calls[0].body.query.includes("馬場テスト"), "baba is not copied into query");
  assert(message.state.acked && !message.state.retried, "success acks");
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 2 }));
  const harness = queueHarness(kv);
  const messages = [fakeMessage(race(1)), fakeMessage(race(2)), fakeMessage(race(3), 2)];
  const { calls } = await runQueue(harness.env, messages, async (body) => {
    if (body.inputs.url.endsWith("race-2")) return new Response("slow down", { status: 429 });
    if (body.inputs.url.endsWith("race-1")) return new Response("gateway", { status: 504 });
    return sseSuccess();
  });
  assert(calls.length === 2, "deferred race is not sent to Dify");
  assert(messages[0].state.acked && !messages[0].state.retried, "HTTP 504 acks without retry");
  assert(!messages[1].state.acked && messages[1].state.retried, "HTTP 429 retries");
  assert(messages[2].state.acked && !messages[2].state.retried, "deferred message is acked");
  assert(harness.sent[0][0].body.priorAttempts === 2, "deferred attempt 2 is carried as priorAttempts 2");
  assert(harness.sent[0][0].body.raceNo === 3, "deferred body keeps the race");
  assert(harness.emails.length === 0, "a non-final retry does not email");
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 1 }));
  const harness = queueHarness(kv);
  const carried = fakeMessage(race(8, { priorAttempts: 3 }), 2);
  const { calls } = await runQueue(harness.env, [carried], async () => new Response("nope", { status: 500 }));
  assert(calls.length === 1, "final carried attempt still calls Dify");
  assert(carried.state.acked && !carried.state.retried, "attempt 4 acks instead of retrying");
  assert(harness.emails.length === 1, "attempt 4 sends the failure email");
  assert(harness.emails[0].text.includes("試行回数: 4"), `email shows effective attempts: ${harness.emails[0].text}`);
  assert(harness.emails[0].subject.includes("06") && harness.emails[0].subject.includes("8R"), "email subject keeps venue and race");
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 1 }));
  const harness = queueHarness(kv);
  const notFinal = fakeMessage(race(8, { priorAttempts: 2 }), 2);
  await runQueue(harness.env, [notFinal], async () => new Response("nope", { status: 500 }));
  assert(!notFinal.state.acked && notFinal.state.retried, "effective attempt 3 still retries");
  assert(harness.emails.length === 0, "effective attempt 3 does not email");
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 1 }));
  const harness = queueHarness(kv);
  const message = fakeMessage(race(1));
  await runQueue(harness.env, [message], async () => {
    throw new Error("socket hang up");
  });
  assert(message.state.acked && !message.state.retried, "disconnect still acks without retry");
  assert(harness.emails.length === 0, "disconnect does not email");
}

{
  const kv = new MemorySeedKv();
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify({ concurrency: 1 }));
  const harness = queueHarness(kv);
  harness.failSend(new Error("queue unavailable"));
  const messages = [fakeMessage(race(1)), fakeMessage(race(2)), fakeMessage(race(3), 4)];
  const { calls } = await runQueue(harness.env, messages, async () => sseSuccess());
  assert(calls.length === 1, "active race is still processed when requeue fails");
  assert(messages[0].state.acked && !messages[0].state.retried, "active success stays acked");
  assert(!messages[1].state.acked && messages[1].state.retried, "requeue failure retries a non-final race");
  assert(messages[2].state.acked && !messages[2].state.retried, "requeue failure on the final attempt acks");
  assert(harness.emails.length === 1, "final requeue failure still notifies");
  assert(
    harness.emails[0].text.includes("concurrency requeue failed"),
    "final requeue failure email explains it was not a Dify result"
  );
}

{
  const kv = new MemorySeedKv();
  const harness = queueHarness(kv);
  const messages = [1, 2, 3, 4].map((n) => fakeMessage(race(n)));
  const first = await runQueue(harness.env, messages, async () => sseSuccess());
  assert(first.calls.length === 3, "first batch uses default 3");
  const deferred = harness.sent[0][0].body;
  const replay = fakeMessage(deferred, 1);
  harness.sent.length = 0;
  const second = await runQueue(harness.env, [replay], async () => new Response("err", { status: 429 }));
  assert(second.calls.length === 1, "requeued race is processed on the next batch");
  assert(replay.state.retried && !replay.state.acked, "carried attempt 1 still has its retries");
  assert(harness.emails.length === 0, "replayed first attempt does not email");
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll concurrency tests passed");
