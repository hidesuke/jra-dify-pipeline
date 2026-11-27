#!/usr/bin/env node
/**
 * 馬場取得の拠点ログ。本体の fetch から JRA を取る。
 * Usage: node --experimental-strip-types scripts/test-baba-colo.mjs
 */

import { readFileSync } from "node:fs";
import {
  BABA_FETCH_OK_EVENT,
  CUSHION_URL,
  INDEX_URLS,
  MOIST_URL,
  TRACE_URL,
  fetchBabaAndCourse,
  parseTraceBody,
  readEgressLocation,
} from "../src/baba.ts";
import worker from "../src/index.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

function captureLogs(fn) {
  const lines = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const wrap = (level) => (...args) => {
    lines.push({ level, text: args.map((a) => String(a)).join(" ") });
  };
  console.log = wrap("log");
  console.warn = wrap("warn");
  console.error = wrap("error");
  const restore = () => {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  };
  return Promise.resolve()
    .then(fn)
    .then(
      (value) => {
        restore();
        return { value, lines, error: undefined };
      },
      (error) => {
        restore();
        return { value: undefined, lines, error };
      }
    );
}

const traceBody = ["fl=123", "ip=203.0.113.8", "colo=NRT", "loc=JP"].join("\n");
const parsed = parseTraceBody(traceBody);
assert(parsed.egressColo === "NRT" && parsed.loc === "JP", "trace colo and loc");
assert(!JSON.stringify(parsed).includes("203.0.113.8"), "trace parse drops the IP");

const cushionHtml = `<div id="rcA" title="Tokyo"><div class="time">t1</div><div class="cushion">9.6</div></div>`;
const moistHtml = `<div id="rcA" title="Tokyo"><div class="time">t1</div></div>`;

function jraFetch() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url === TRACE_URL) return new Response(traceBody, { status: 200 });
    if (url === CUSHION_URL) return new Response(cushionHtml, { status: 200 });
    if (url === MOIST_URL) return new Response(moistHtml, { status: 200 });
    if (INDEX_URLS.includes(url)) return new Response("plain", { status: 200 });
    throw new Error(`unexpected url ${url}`);
  };
  return { calls, fetchImpl };
}

const success = await captureLogs(() => {
  const { calls, fetchImpl } = jraFetch();
  const req = {
    cf: { colo: "PDX" },
    headers: { get: (name) => (name === "cf-placement" ? "remote-NRT" : null) },
  };
  return fetchBabaAndCourse(fetchImpl, req).then((result) => ({ result, calls }));
});
assert(success.error === undefined, `success path does not throw (${success.error})`);
assert(success.value?.result.venues[0].measurements[0].cushion === 9.6, "parsed cushion is returned");
const jraCalls = success.value?.calls.filter((c) => c.url !== TRACE_URL) ?? [];
assert(jraCalls.every((c) => c.init === undefined), "JRA fetch adds no RequestInit");
assert(success.value?.calls.find((c) => c.url === TRACE_URL)?.init?.cache === "no-store", "trace is not cached");
const ok = success.lines.filter((l) => l.text.includes(BABA_FETCH_OK_EVENT));
assert(ok.length === 1 && ok[0].level === "log", "one success info log");
const okBody = JSON.parse(ok[0].text);
assert(okBody.colo === "NRT" && okBody.egressColo === "NRT" && okBody.loc === "JP", "success log has egress colo");
assert(okBody.requestColo === "PDX", "success log keeps request.cf.colo");
assert(okBody.placement === "remote-NRT", "success log keeps cf-placement");
assert(!success.lines.some((l) => l.text.includes("203.0.113.8")), "logs omit the trace IP");

const denied = await captureLogs(() => {
  const fetchImpl = async (url) => {
    if (url === TRACE_URL) return new Response("colo=NRT\nloc=JP\nip=203.0.113.9\n", { status: 200 });
    if (url === CUSHION_URL) return new Response("Access Denied", { status: 403, statusText: "Forbidden" });
    return new Response("ok", { status: 200 });
  };
  return fetchBabaAndCourse(fetchImpl, { cf: { colo: "PDX" }, headers: { get: () => null } }).catch((error) => error);
});
assert(denied.value instanceof Error && denied.value.message === "cushion fetch failed: 403", "403 still throws");
assert(!denied.lines.some((l) => l.text.includes(BABA_FETCH_OK_EVENT)), "403 does not log success");
const failedLog = JSON.parse(denied.lines.find((l) => l.text.includes("baba_fetch_failed")).text);
assert(failedLog.status === 403 && failedLog.egressColo === "NRT" && failedLog.requestColo === "PDX", "403 log has colo");
assert(!denied.lines.some((l) => l.text.includes("203.0.113.9")), "403 log omits the trace IP");

const latest = await captureLogs(async () => {
  const original = globalThis.fetch;
  const { fetchImpl } = jraFetch();
  globalThis.fetch = fetchImpl;
  try {
    const res = await worker.fetch(new Request("https://example.test/baba/latest"), {}, {});
    return { status: res.status, body: await res.json() };
  } finally {
    globalThis.fetch = original;
  }
});
assert(latest.value?.status === 200, "/baba/latest stays 200");
assert(latest.value?.body.venues[0].cushion === 9.6, "/baba/latest JSON shape still has cushion");
assert(!("egressColo" in (latest.value?.body ?? {})), "public JSON does not add colo");
assert(latest.lines.some((l) => l.text.includes(BABA_FETCH_OK_EVENT) && l.text.includes("NRT")), "endpoint logs egress colo");

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
assert(wrangler.includes('"region": "aws:ap-northeast-1"'), "placement region is Tokyo");
assert(!wrangler.includes("jra-baba-fetcher"), "main config has no fetcher service");
assert(!wrangler.includes('"build"'), "main config has no custom build command");
assert(readme.includes("aws:ap-northeast-1"), "README records the region");
assert(readme.includes("baba_fetch_ok"), "README documents the success log");
assert(!readme.includes("jra-baba-fetcher"), "README no longer names a second worker");

const traced = await readEgressLocation(async (url, init) => {
  assert(url === TRACE_URL && init?.cache === "no-store", "readEgressLocation calls trace without cache");
  return new Response("colo=HND\nloc=JP\n", { status: 200 });
});
assert(traced.egressColo === "HND" && traced.loc === "JP", "readEgressLocation parses colo and loc");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll assertions passed");
