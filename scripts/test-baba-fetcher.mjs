#!/usr/bin/env node
/**
 * 馬場取得 Worker と、本体からの Service Binding 呼び出し。
 * Usage: node --experimental-strip-types scripts/test-baba-fetcher.mjs
 */

import { readFileSync } from "node:fs";
import {
  CUSHION_URL,
  INDEX_URLS,
  INGRESS_COLO_HEADER,
  MOIST_URL,
  fetchBaba,
} from "../src/baba.ts";
import { BABA_FETCHER_URL, BABA_FETCH_PLACEMENT_EVENT, fetchBabaBundle } from "../src/babaClient.ts";
import {
  BABA_FETCH_OK_EVENT,
  TRACE_URL,
  handleBabaFetch,
  parseTraceBody,
  readEgressLocation,
} from "../src/babaFetcher.ts";
import worker from "../src/index.ts";
import { spawnSync } from "node:child_process";
import { envForFetcherDeploy, shouldDeployFetcher } from "./ensure-baba-fetcher.mjs";

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
  const levels = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const wrap = (level) => (...args) => {
    levels.push(level);
    lines.push(args.map((a) => String(a)).join(" "));
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
        return { value, lines, levels, error: undefined };
      },
      (error) => {
        restore();
        return { value: undefined, lines, levels, error };
      }
    );
}

function parseJsonLines(lines) {
  return lines.map((line) => JSON.parse(line));
}

const traceBody = [
  "fl=123",
  "ip=203.0.113.8",
  "colo=NRT",
  "loc=JP",
  "warp=off",
].join("\n");

const parsedTrace = parseTraceBody(traceBody);
assert(parsedTrace.egressColo === "NRT", "trace colo is NRT");
assert(parsedTrace.loc === "JP", "trace loc is JP");
assert(!JSON.stringify(parsedTrace).includes("203.0.113.8"), "trace parse drops the IP");
assert(parseTraceBody("colo=not-a-code\nloc=JAPAN").egressColo === null, "non-airport colo is dropped");
assert(parseTraceBody("colo=nrt\nloc=jp").egressColo === "NRT", "trace colo is normalized");
assert(parseTraceBody("colo=nrt\nloc=jp").loc === "JP", "trace loc is normalized");

const cushionHtml = `<div id="rcA" title="Tokyo"><div class="time">t1</div><div class="cushion">9.6</div></div>`;
const moistHtml = `<div id="rcA" title="Tokyo"><div class="time">t1</div></div>`;

function jraFetch(trace = traceBody) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url === TRACE_URL) return new Response(trace, { status: 200 });
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
    method: "GET",
    cf: { colo: "PDX" },
    headers: new Headers({ [INGRESS_COLO_HEADER]: "pdx" }),
  };
  return handleBabaFetch(req, fetchImpl).then(async (res) => ({
    status: res.status,
    body: await res.json(),
    calls,
  }));
});
assert(success.error === undefined, `fetcher success does not throw (${success.error})`);
assert(success.value?.status === 200, "fetcher success is 200");
assert(success.value?.body.venues[0].measurements[0].cushion === 9.6, "fetcher returns parsed cushion");
const jraCalls = success.value?.calls.filter((c) => c.url !== TRACE_URL) ?? [];
assert(jraCalls.length === 5, `cushion, moist, and 3 index pages (got ${jraCalls.length})`);
assert(jraCalls.every((c) => c.init === undefined), "JRA fetch adds no RequestInit");
const traceCall = success.value?.calls.find((c) => c.url === TRACE_URL);
assert(traceCall?.init?.cache === "no-store", "trace is not cached");
const okLogs = parseJsonLines(success.lines.filter((line) => line.includes(BABA_FETCH_OK_EVENT)));
assert(okLogs.length === 1, `one success log (got ${okLogs.length})`);
assert(success.levels.filter((level) => level === "log").length === 1, "success uses console.log once");
assert(okLogs[0].colo === "NRT", `success colo is the egress colo (got ${okLogs[0].colo})`);
assert(okLogs[0].requestColo === "PDX", "success log keeps request.cf.colo");
assert(okLogs[0].egressColo === "NRT", "success log has egressColo");
assert(okLogs[0].loc === "JP", "success log has loc");
assert(okLogs[0].ingressColo === "PDX", "success log has the caller's colo");
assert(!success.lines.join("\n").includes("203.0.113.8"), "success logs omit the trace IP");

const forbidden = await captureLogs(() => {
  const fetchImpl = async (url, init) => {
    if (url === TRACE_URL) return new Response("colo=NRT\nloc=JP\nip=203.0.113.9\n", { status: 200 });
    if (url === CUSHION_URL) {
      assert(init === undefined, "failed JRA fetch still has no RequestInit");
      return new Response("Access Denied", { status: 403, statusText: "Forbidden" });
    }
    if (url === MOIST_URL || INDEX_URLS.includes(url)) return new Response("ok", { status: 200 });
    throw new Error(`unexpected url ${url}`);
  };
  const req = {
    method: "GET",
    cf: { colo: "PDX" },
    headers: new Headers({ [INGRESS_COLO_HEADER]: "PDX" }),
  };
  return handleBabaFetch(req, fetchImpl).then(async (res) => ({
    status: res.status,
    body: await res.json(),
  }));
});
assert(forbidden.value?.status === 502, "cushion 403 becomes 502");
assert(forbidden.value?.body.error === "cushion fetch failed: 403", "502 error text stays the fetch error");
assert(!JSON.stringify(forbidden.value?.body).includes("Access Denied"), "502 body does not include the JRA body");
assert(!forbidden.lines.join("\n").includes("203.0.113.9"), "failure logs omit the trace IP");
const failedLogs = parseJsonLines(forbidden.lines.filter((line) => line.includes("baba_fetch_failed")));
assert(failedLogs.length === 1, `403 logs only the failed fetch (got ${failedLogs.length})`);
assert(failedLogs[0].colo === "NRT", "failure colo is the egress colo");
assert(failedLogs[0].requestColo === "PDX", "failure log keeps request.cf.colo");
assert(failedLogs[0].egressColo === "NRT", "failure log has egressColo");
assert(failedLogs[0].ingressColo === "PDX", "failure log has ingress colo");
assert(failedLogs[0].status === 403, "failure log keeps 403");
assert(!forbidden.lines.some((line) => line.includes(BABA_FETCH_OK_EVENT)), "403 does not log success");

const traceDown = await captureLogs(() => {
  const fetchImpl = async (url) => {
    if (url === TRACE_URL) throw new Error("trace down");
    if (url === CUSHION_URL) return new Response(cushionHtml, { status: 200 });
    if (url === MOIST_URL) return new Response(moistHtml, { status: 200 });
    if (INDEX_URLS.includes(url)) return new Response("plain", { status: 200 });
    throw new Error(`unexpected url ${url}`);
  };
  const req = { method: "GET", cf: { colo: "KIX" }, headers: new Headers() };
  return handleBabaFetch(req, fetchImpl).then((res) => res.status);
});
assert(traceDown.value === 200, "trace failure still returns JRA data");
const traceDownOk = parseJsonLines(traceDown.lines.filter((line) => line.includes(BABA_FETCH_OK_EVENT)));
assert(traceDownOk[0]?.colo === "KIX", "without trace, colo falls back to request.cf.colo");
assert(traceDownOk[0]?.egressColo === null, "trace failure leaves egressColo null");

const badIngress = await captureLogs(() => {
  const { fetchImpl } = jraFetch();
  const req = {
    method: "GET",
    headers: new Headers({ [INGRESS_COLO_HEADER]: "https://evil.example/pdx" }),
  };
  return handleBabaFetch(req, fetchImpl).then((res) => res.status);
});
const badIngressLog = parseJsonLines(badIngress.lines.filter((line) => line.includes(BABA_FETCH_OK_EVENT)))[0];
assert(badIngressLog?.ingressColo === null, "non-airport ingress header is not logged");
assert(!badIngress.lines.join("\n").includes("evil.example"), "ingress header value is not copied into logs");

const method = await handleBabaFetch({ method: "POST", headers: new Headers() }, async () => {
  throw new Error("should not fetch");
});
assert(method.status === 405, "fetcher rejects POST");

const directColo = await captureLogs(() => {
  const fetchImpl = async (url) => {
    if (url === CUSHION_URL) return new Response("no", { status: 403, statusText: "Forbidden" });
    return new Response("ok", { status: 200 });
  };
  return fetchBaba(fetchImpl, "NRT").catch((error) => error);
});
const directLog = parseJsonLines(directColo.lines)[0];
assert(directLog.colo === "NRT", "string colo still logs as colo");
assert(directLog.requestColo === undefined, "string colo does not add requestColo");

const bundle = await captureLogs(async () => {
  const seen = [];
  const binding = {
    async fetch(request) {
      seen.push(request);
      return new Response(JSON.stringify({ venues: [], course: {} }), {
        status: 200,
        headers: { "content-type": "application/json", "cf-placement": "remote-NRT" },
      });
    },
  };
  const result = await fetchBabaBundle(binding, "nrt");
  return { result, seen };
});
assert(bundle.value?.seen.length === 1, "bundle calls the binding once");
assert(bundle.value?.seen[0].url === BABA_FETCHER_URL, "binding URL is the internal fetcher URL");
assert(bundle.value?.seen[0].headers.get(INGRESS_COLO_HEADER) === "NRT", "ingress colo is normalized");
assert(bundle.value?.seen[0].headers.get("cookie") === null, "caller cookies are not forwarded");
const placementLog = parseJsonLines(bundle.lines)[0];
assert(placementLog.event === BABA_FETCH_PLACEMENT_EVENT, "main logs cf-placement");
assert(placementLog.placement === "remote-NRT", "placement header is kept");
assert(placementLog.status === 200, "placement log has the fetcher status");

const junkPlacement = await captureLogs(() =>
  fetchBabaBundle(
    {
      async fetch() {
        return new Response(JSON.stringify({ venues: [], course: {} }), {
          status: 200,
          headers: { "cf-placement": "<script>" },
        });
      },
    },
    null
  )
);
assert(parseJsonLines(junkPlacement.lines)[0].placement === null, "unexpected cf-placement is dropped");

const fetcherFailed = await captureLogs(() =>
  fetchBabaBundle(
    {
      async fetch() {
        return new Response(JSON.stringify({ error: "cushion fetch failed: 403" }), {
          status: 502,
          headers: { "cf-placement": "local-PDX" },
        });
      },
    },
    "PDX"
  ).catch((error) => error)
);
assert(fetcherFailed.value instanceof Error, "fetcher 502 throws");
assert(fetcherFailed.value?.message === "cushion fetch failed: 403", "fetcher error message is preserved");
assert(parseJsonLines(fetcherFailed.lines)[0].placement === "local-PDX", "failed fetch still logs placement");

const tokyoPayload = {
  venues: [
    {
      venueName: "東京",
      venueCode: "05",
      measurements: [
        {
          time: "11月14日（土曜）10時00分",
          month: 11,
          day: 14,
          cushion: 9.6,
          turf: null,
          dirt: null,
          rainfallMm: null,
        },
      ],
    },
  ],
  course: {},
};

const latest = await captureLogs(async () => {
  const direct = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    direct.push(String(input));
    throw new Error(`main worker fetched ${input}`);
  };
  try {
    const res = await worker.fetch(
      new Request("https://example.test/baba/latest"),
      {
        BABA_FETCHER: {
          async fetch(request) {
            const handled = await handleBabaFetch(
              { method: request.method, headers: request.headers, cf: { colo: "NRT" } },
              jraFetch().fetchImpl
            );
            const headers = new Headers(handled.headers);
            headers.set("cf-placement", "remote-NRT");
            return new Response(handled.body, { status: handled.status, headers });
          },
        },
      },
      {}
    );
    return { status: res.status, body: await res.json(), direct };
  } finally {
    globalThis.fetch = original;
  }
});
assert(latest.error === undefined, `GET /baba/latest via binding does not throw (${latest.error})`);
assert(latest.value?.status === 200, "/baba/latest stays 200");
assert(latest.value?.body.venues[0].cushion === 9.6, "/baba/latest cushion comes from the fetcher");
assert(latest.value?.direct.length === 0, "main worker does not fetch JRA itself");
assert(
  latest.lines.some((line) => line.includes(BABA_FETCH_OK_EVENT) && line.includes("NRT")),
  "/baba/latest success log includes the fetcher colo"
);
assert(latest.lines.some((line) => line.includes("remote-NRT")), "/baba/latest logs cf-placement");

const missing = await worker.fetch(new Request("https://example.test/baba/latest"), {}, {});
assert(missing.status === 502, "missing binding is still 502");
const missingBody = await missing.json();
assert(String(missingBody.error).includes("BABA_FETCHER binding is missing"), "missing binding is visible");

const RealDate = Date;
const fixed = new RealDate("2026-11-13T07:45:00.000Z").getTime();
globalThis.Date = class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(fixed);
    else super(...args);
  }
  static now() {
    return fixed;
  }
};
const scheduled = await captureLogs(async () => {
  const direct = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    direct.push(url);
    if (url.includes("accessD.html")) {
      return new Response('<html><div class="race_title"></div></html>', { status: 200 });
    }
    throw new Error(`scheduled fetched ${url}`);
  };
  const batches = [];
  let fetcherRequest;
  try {
    await worker.scheduled(
      { cron: "45 7 * * FRI", scheduledTime: fixed, type: "scheduled" },
      {
        RACE_QUEUE: {
          async sendBatch(messages) {
            batches.push(messages);
          },
        },
        BABA_FETCHER: {
          async fetch(request) {
            fetcherRequest = request;
            return new Response(JSON.stringify(tokyoPayload), {
              status: 200,
              headers: { "content-type": "application/json", "cf-placement": "remote-NRT" },
            });
          },
        },
      },
      {}
    );
  } finally {
    globalThis.fetch = original;
  }
  return { direct, messages: batches.flat(), fetcherRequest };
});
globalThis.Date = RealDate;
assert(scheduled.error === undefined, `scheduled still enqueues (${scheduled.error})`);
const messages = scheduled.value?.messages ?? [];
assert(messages.length === 36, `Friday cron still enqueues 36 races (got ${messages.length})`);
const tokyo = messages.filter((m) => m.body.venueCode === "05");
assert(tokyo.length === 12, "Tokyo races are still enqueued");
assert(
  tokyo.every((m) => m.body.baba?.summary.includes("クッション値9.6")),
  "Tokyo remarks still get baba from the fetcher"
);
assert(
  messages.filter((m) => m.body.venueCode !== "05").every((m) => m.body.baba === undefined),
  "venues without fetcher data stay without baba"
);
assert(
  (scheduled.value?.direct ?? []).every((url) => !url.includes("/keiba/baba")),
  "scheduled does not fetch JRA baba pages from the main worker"
);
assert(scheduled.value?.fetcherRequest?.headers.get(INGRESS_COLO_HEADER) === null, "cron has no ingress colo");
assert(
  scheduled.lines.some((line) => line.includes("remote-NRT")),
  "cron logs the fetcher placement header"
);

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const mainConfig = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const babaConfig = readFileSync(new URL("../wrangler.baba.jsonc", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert(babaConfig.includes('"region": "aws:ap-northeast-1"'), "fetcher placement is Tokyo");
assert(!/"mode"\s*:\s*"smart"/.test(babaConfig), "fetcher does not use Smart Placement");
assert(babaConfig.includes('"workers_dev": false'), "fetcher has no workers.dev URL");
assert(mainConfig.includes('"command": "node scripts/ensure-baba-fetcher.mjs"'), "main deploy prepares the fetcher first");
assert(mainConfig.includes('"binding": "BABA_FETCHER"'), "main binds BABA_FETCHER");
assert(shouldDeployFetcher({ workersCi: undefined, branch: "main" }) === false, "local wrangler does not deploy the fetcher");
assert(shouldDeployFetcher({ workersCi: "1", branch: "main" }) === true, "main deploys the fetcher");
assert(shouldDeployFetcher({ workersCi: "1", branch: "cursor/baba" }) === false, "a non-main branch deploys nothing");
assert(shouldDeployFetcher({ workersCi: "1", branch: "" }) === false, "a missing branch deploys nothing");
const stripped = envForFetcherDeploy({
  WRANGLER_CI_OVERRIDE_NAME: "jra-dify-pipeline",
  WRANGLER_CI_MATCH_TAG: "tag",
  WRANGLER_CI_GENERATE_PREVIEW_ALIAS: "true",
  CLOUDFLARE_API_TOKEN: "kept",
});
assert(stripped.WRANGLER_CI_OVERRIDE_NAME === undefined, "fetcher deploy drops the CI name override");
assert(stripped.WRANGLER_CI_MATCH_TAG === undefined, "fetcher deploy drops the CI tag match");
assert(stripped.CLOUDFLARE_API_TOKEN === "kept", "fetcher deploy keeps the API token");
const ensure = spawnSync(process.execPath, ["scripts/ensure-baba-fetcher.mjs"], { encoding: "utf8" });
assert(ensure.status === 0, `ensure script is a no-op without WORKERS_CI (status ${ensure.status})`);
assert(mainConfig.includes('"service": "jra-baba-fetcher"'), "binding targets jra-baba-fetcher");
assert(
  pkg.scripts.deploy.startsWith("wrangler deploy -c wrangler.baba.jsonc && "),
  "deploy publishes the fetcher before the main worker"
);
assert(readme.includes("npm run deploy"), "README tells Builds to use npm run deploy");
assert(readme.includes("jra-baba-fetcher"), "README names the fetcher");
assert(readme.includes("aws:ap-northeast-1"), "README records the Tokyo placement region");
assert(readme.includes("baba_fetch_ok"), "README documents the success log");

const traced = await readEgressLocation(async (url, init) => {
  assert(url === TRACE_URL, "readEgressLocation calls the trace URL");
  assert(init?.cache === "no-store", "readEgressLocation disables cache");
  return new Response("colo=HND\nloc=JP\n", { status: 200 });
});
assert(traced.egressColo === "HND" && traced.loc === "JP", "readEgressLocation parses colo and loc");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll assertions passed");
