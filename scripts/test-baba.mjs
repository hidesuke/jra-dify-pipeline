#!/usr/bin/env node
/**
 * 馬場パースと GET /baba/latest 用の最新-only 整形。
 * Usage: node --experimental-strip-types scripts/test-baba.mjs
 */

import {
  parseCushionHtml,
  parseMoistHtml,
  mergeBaba,
  buildLatestBaba,
  resolveVenueKey,
  formatMoistureForApi,
  formatBabaSummary,
  fetchBaba,
  fetchCourseInfoByVenue,
  requestColo,
  BABA_FETCH_FAILED_EVENT,
  CUSHION_URL,
  MOIST_URL,
  INDEX_URLS,
} from "../src/baba.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

const cushionHtml = `
<div id="cushion_data_list">
<div id="rcA" title="中山">
<div class="unit">
<div class="time">9月18日（金曜）10時30分</div>
<div class="cushion">9.6</div>
</div>
<div class="unit">
<div class="time">9月13日（日曜）7時00分</div>
<div class="cushion">8.2</div>
</div>
</div>
<div id="rcB" title="阪神">
<div class="unit">
<div class="time">9月18日（金曜）10時00分</div>
<div class="cushion">8.3</div>
</div>
</div>
</div>
`;

const moistHtml = `
<div id="moist_data_list">
<div id="rcA" title="中山">
<div class="unit">
<div class="time">9月18日（金曜）10時30分</div>
<div class="turf">
<span class="mg" data-condition="hard">13.1</span>
<span class="m4c" data-condition="hard">14.1</span>
</div>
<div class="dirt">
<span class="mg" data-condition="hard">7.3</span>
<span class="m4c" data-condition="hard">7.4</span>
</div>
<ul class="note_list narrow mt10 moist_caution">
<li>注記：特になし</li>
</ul>
</div>
<div class="unit">
<div class="time">9月13日（日曜）6時00分</div>
<div class="turf">
<span class="mg" data-condition="soft">13.5</span>
<span class="m4c" data-condition="soft">14.8</span>
</div>
<div class="dirt">
<span class="mg" data-condition="soft">14.1</span>
<span class="m4c" data-condition="soft">15.4</span>
</div>
<ul class="note_list narrow mt10 moist_caution">
<li>注記：測定時刻までの当日雨量は1.0ミリメートルでした</li>
</ul>
</div>
</div>
<div id="rcB" title="阪神">
<div class="unit">
<div class="time">9月18日（金曜）10時00分</div>
<div class="turf">
<span class="mg" data-condition="wet">14.0</span>
<span class="m4c" data-condition="hard">12.0</span>
</div>
<div class="dirt">
<span class="mg" data-condition="heavy">16.0</span>
<span class="m4c" data-condition="heavy">16.2</span>
</div>
</div>
</div>
</div>
`;

const venues = mergeBaba(parseCushionHtml(cushionHtml), parseMoistHtml(moistHtml));
assert(venues.length === 2, `two venues parsed (got ${venues.length})`);

const nakayama = venues.find((v) => v.venueCode === "06");
assert(nakayama?.measurements.length === 2, "中山 has two measurements (history kept in debug dump)");
assert(nakayama?.measurements[0].cushion === 9.6, "中山 latest cushion is 9.6 not 8.2");
assert(nakayama?.measurements[0].turf?.goal === 13.1, "中山 latest turf goal moisture is 13.1");
assert(nakayama?.measurements[1].rainfallMm === 1, "older 中山 measurement still has rainfall");

assert(resolveVenueKey("06")?.venueCode === "06", "resolve 06");
assert(resolveVenueKey("中山")?.venueCode === "06", "resolve 中山");
assert(resolveVenueKey("中山競馬場")?.venueCode === "06", "resolve 中山競馬場");
assert(resolveVenueKey("unknown") === null, "unknown venue is null");

const courseByVenue = new Map([
  [
    "06",
    {
      venueName: "中山",
      venueCode: "06",
      turfLength: { shibaNoshiba: "12から14", shibaYoshiba: null, shogaiNoshiba: "12から14", shogaiYoshiba: "12から16" },
      usedCourse: "Bコース（Aコースから3メートル外に内柵を設置）",
      turfCondition: "3コーナーから4コーナーの内柵沿いに傷みがあります。",
    },
  ],
]);

const latest = buildLatestBaba(venues, courseByVenue, { fetchedAt: "2026-09-18T12:00:00.000Z" });
assert(latest.venues.length === 2, `latest returns one row per venue (got ${latest.venues.length})`);
assert(
  latest.venues.every((v) => !("measurements" in v)),
  "latest payload has no measurements history"
);
assert(latest.venues[0].venueCode === "06", "first venue is 中山");
assert(latest.venues[0].cushion === 9.6, "latest 中山 cushion");
assert(latest.venues[0].turf?.condition === "良", `中山 turf condition 良 (got ${latest.venues[0].turf?.condition})`);
assert(latest.venues[0].dirt?.goal === 7.3, "中山 latest dirt, not Sunday 14.1");
assert(latest.venues[0].rainfallMm == null, "latest 中山 has no rainfall note");
assert(latest.venues[0].usedCourse?.includes("Bコース"), "course info attached");
assert(latest.venues[0].summary.includes("クッション値9.6"), `summary uses latest: ${latest.venues[0].summary}`);
assert(!latest.venues[0].summary.includes("8.2"), "summary does not include older cushion");
assert(latest.text.includes("中山(06)"), `text names 中山: ${latest.text}`);
assert(latest.text.includes("阪神(09)"), "text names 阪神");
assert(!latest.text.includes("9月13日"), "text omits older measurement");

const hanshin = latest.venues.find((v) => v.venueCode === "09");
assert(hanshin?.turf?.condition === "稍重" || hanshin?.turf?.goalCondition === "稍重", "阪神 turf mixed conditions");
assert(hanshin?.dirt?.condition === "不良", `阪神 dirt 不良 (got ${hanshin?.dirt?.condition})`);

const onlyNakayama = buildLatestBaba(venues, courseByVenue, { venueFilter: "06" });
assert(onlyNakayama.venues.length === 1 && onlyNakayama.venues[0].venueCode === "06", "venue=06 filters");
const byName = buildLatestBaba(venues, courseByVenue, { venueFilter: "阪神" });
assert(byName.venues.length === 1 && byName.venues[0].venueCode === "09", "venue=阪神 filters");
const unknown = buildLatestBaba(venues, courseByVenue, { venueFilter: "大井" });
assert(unknown.venues.length === 0 && unknown.text === "", "unknown venue yields empty latest payload");

const mixed = formatMoistureForApi({
  goal: 14,
  corner4: 12,
  goalCondition: "wet",
  corner4Condition: "hard",
});
assert(mixed?.goalCondition === "稍重" && mixed?.corner4Condition === "良", "mixed moisture keeps both JP labels");

const summary = formatBabaSummary(nakayama.measurements[0], courseByVenue.get("06"));
assert(summary.startsWith("馬場[9月18日（金曜）10時30分]"), `summary time ${summary}`);

assert(requestColo({ cf: { colo: "NRT" } }) === "NRT", "requestColo reads cf.colo");
assert(requestColo({ cf: { colo: "NRT", country: "JP" } }) === "NRT", "requestColo ignores other cf fields");
assert(requestColo({ cf: { cacheTtl: 60 } }) === null, "cf without colo is null");
assert(requestColo({ cf: { colo: "" } }) === null, "empty colo is null");
assert(requestColo({}) === null, "missing cf is null");
assert(requestColo(null) === null, "null request is null");
assert(requestColo(new Request("https://example.test/baba/latest")) === null, "Request without cf is null");

async function captureBabaLogs(fn) {
  const lines = [];
  const levels = [];
  const orig = {
    error: console.error,
    warn: console.warn,
    log: console.log,
  };
  for (const level of ["error", "warn", "log"]) {
    console[level] = (...args) => {
      const line = args.map((a) => String(a)).join(" ");
      if (line.includes(BABA_FETCH_FAILED_EVENT)) {
        lines.push(line);
        levels.push(level);
      } else {
        orig[level](...args);
      }
    };
  }
  try {
    try {
      const value = await fn();
      return { lines, levels, value, error: undefined };
    } catch (error) {
      return { lines, levels, value: undefined, error };
    }
  } finally {
    console.error = orig.error;
    console.warn = orig.warn;
    console.log = orig.log;
  }
}

function parseBabaLogs(lines) {
  return lines.map((line, i) => {
    assert(!line.includes("\n"), `log ${i} is a single line`);
    return JSON.parse(line);
  });
}

const forbiddenHeaders = {
  server: "Ceph Object Gateway",
  "content-type": "text/html; charset=UTF-8",
  "content-length": "3008",
  "cf-ray": "ray-123-NRT",
  "cf-cache-status": "DYNAMIC",
  "x-amz-request-id": "amz-req-1",
  "x-cache": "Error from cloudfront",
  via: "1.1 abc",
  age: "3",
  date: "Fri, 27 Nov 2026 11:04:00 GMT",
  "set-cookie": "session=super-secret-value; Path=/",
  "akamai-grn": "grn-0.1",
  "x-akamai-session-info": "name=SESSION",
  "x-request-id": "rid-9",
  warning: "do-not-log-this-warning",
};

const forbiddenBody = `${"A".repeat(2048)}BODYTAIL`;

const cushion403 = await captureBabaLogs(async () => {
  const inits = [];
  const fetchImpl = async (url, init) => {
    inits.push(init);
    if (url === CUSHION_URL) {
      return new Response(forbiddenBody, {
        status: 403,
        statusText: "Forbidden",
        headers: forbiddenHeaders,
      });
    }
    if (url === MOIST_URL) return new Response("ok", { status: 200 });
    throw new Error(`unexpected url ${url}`);
  };
  try {
    await fetchBaba(fetchImpl, "NRT");
    return { inits, threw: false };
  } catch (error) {
    return { inits, threw: true, error };
  }
});

assert(cushion403.value?.threw === true, "cushion 403 still throws");
const cushionError = cushion403.value?.error;
assert(cushionError instanceof Error, "cushion 403 throws Error");
assert(cushionError?.message === "cushion fetch failed: 403", `exception message unchanged (${cushionError?.message})`);
assert(String(cushionError) === "Error: cushion fetch failed: 403", "Error toString stays Error: cushion fetch failed: 403");
assert(cushion403.value?.inits.every((init) => init === undefined), "fetch is called without RequestInit");
assert(!String(cushionError).includes("super-secret-value"), "exception does not include set-cookie");
assert(!String(cushionError).includes("BODYTAIL"), "exception does not include response body");

const cushionLogs = parseBabaLogs(cushion403.lines);
assert(cushionLogs.length === 1, `only the failed cushion fetch is logged (got ${cushionLogs.length})`);
const cushionLog = cushionLogs[0];
assert(cushion403.levels[0] === "error", "cushion failure uses console.error");
assert(cushionLog.event === BABA_FETCH_FAILED_EVENT, "event is baba_fetch_failed");
assert(cushionLog.target === "cushion", "target is cushion");
assert(cushionLog.url === CUSHION_URL, "url is the cushion URL");
assert(cushionLog.status === 403, "status is 403");
assert(cushionLog.statusText === "Forbidden", "statusText is Forbidden");
assert(cushionLog.colo === "NRT", `colo is NRT (got ${cushionLog.colo})`);
assert(Number.isFinite(Date.parse(cushionLog.timestamp)), `timestamp is ISO (${cushionLog.timestamp})`);
assert(cushionLog.headers.server === "Ceph Object Gateway", "logs server");
assert(cushionLog.headers["content-type"] === "text/html; charset=UTF-8", "logs content-type");
assert(cushionLog.headers["content-length"] === "3008", "logs content-length");
assert(cushionLog.headers["cf-ray"] === "ray-123-NRT", "logs cf-ray");
assert(cushionLog.headers["cf-cache-status"] === "DYNAMIC", "logs cf-cache-status");
assert(cushionLog.headers["x-amz-request-id"] === "amz-req-1", "logs x-amz-request-id");
assert(cushionLog.headers["x-cache"] === "Error from cloudfront", "logs x-cache");
assert(cushionLog.headers.via === "1.1 abc", "logs via");
assert(cushionLog.headers.age === "3", "logs age");
assert(cushionLog.headers.date === "Fri, 27 Nov 2026 11:04:00 GMT", "logs date");
assert(cushionLog.headers["set-cookie"] === true, "set-cookie is presence only");
assert(cushionLog.headers["akamai-grn"] === "grn-0.1", "logs akamai-grn");
assert(cushionLog.headers["x-akamai-session-info"] === "name=SESSION", "logs x-akamai-*");
assert(cushionLog.headers["x-request-id"] === "rid-9", "logs other x- headers");
assert(cushionLog.headers.warning === undefined, "non-listed headers are omitted");
assert(cushionLog.body === "A".repeat(2048), "body is truncated to 2048 chars");
assert(cushionLog.bodyTruncated === true, "bodyTruncated is true");
assert(cushionLog.bodyLength === forbiddenBody.length, "bodyLength is the full length");
const cushionLogText = cushion403.lines[0];
assert(!cushionLogText.includes("super-secret-value"), "log omits set-cookie value");
assert(!cushionLogText.includes("BODYTAIL"), "log omits the body past 2KB");
assert(!cushionLogText.includes("do-not-log-this-warning"), "log omits unrelated headers");

const bothFailed = await captureBabaLogs(() => {
  const fetchImpl = async (url) => {
    const status = url === CUSHION_URL ? 403 : 502;
    return new Response(`nope ${status}`, { status, statusText: "nope", headers: { server: "origin" } });
  };
  return fetchBaba(fetchImpl);
});
assert(bothFailed.error instanceof Error, "both failed still throws");
assert(bothFailed.error?.message === "cushion fetch failed: 403", "cushion failure is still the thrown error");
const bothLogs = parseBabaLogs(bothFailed.lines);
assert(bothLogs.map((l) => l.target).sort().join(",") === "cushion,moist", "both non-ok fetches are logged");
assert(bothLogs.every((l) => l.colo === null), "omitted colo is null");
assert(bothLogs.find((l) => l.target === "moist")?.status === 502, "moist status is logged even though cushion is thrown");
assert(bothLogs.every((l) => l.headers["set-cookie"] === false), "absent set-cookie is false");

const moistOnly = await captureBabaLogs(() => {
  const fetchImpl = async (url) => {
    if (url === MOIST_URL) return new Response("moist denied", { status: 403, statusText: "Forbidden" });
    return new Response("ok", { status: 200 });
  };
  return fetchBaba(fetchImpl, "KIX");
});
assert(moistOnly.error?.message === "moist fetch failed: 403", "moist-only failure message unchanged");
const moistLogs = parseBabaLogs(moistOnly.lines);
assert(moistLogs.length === 1 && moistLogs[0].target === "moist", "200 cushion is not logged");
assert(moistLogs[0].colo === "KIX", "moist log keeps colo");
assert(moistLogs[0].body === "moist denied", "short body is kept whole");
assert(moistLogs[0].bodyTruncated === false, "short body is not truncated");

const networkErr = new Error("connect ECONNRESET");
const network = await captureBabaLogs(() => {
  const fetchImpl = async (url) => {
    if (url === CUSHION_URL) throw networkErr;
    return new Response("ok", { status: 200 });
  };
  return fetchBaba(fetchImpl, "NRT");
});
assert(network.error === networkErr, "network error is rethrown as the same object");
const networkLogs = parseBabaLogs(network.lines);
assert(network.levels[0] === "error", "network failure uses console.error");
assert(networkLogs.length === 1, "network failure logs once");
assert(networkLogs[0].target === "cushion" && networkLogs[0].url === CUSHION_URL, "network log names cushion");
assert(networkLogs[0].error === "connect ECONNRESET", "network log has the error message");
assert(networkLogs[0].colo === "NRT", "network log has colo");
assert(networkLogs[0].status === undefined, "network log has no status");

const stringThrow = await captureBabaLogs(() => {
  const fetchImpl = async () => {
    throw "socket closed";
  };
  return fetchBaba(fetchImpl, null);
});
assert(stringThrow.error === "socket closed", "non-Error throw is rethrown unchanged");
const stringLogs = parseBabaLogs(stringThrow.lines);
assert(stringLogs.length === 2, "both in-flight fetches log when both throw");
assert(stringLogs.every((l) => l.error === "socket closed"), "string throw is logged as a message");

const asciiCushion = `<div id="rcA" title="Tokyo"><div class="time">t1</div><div class="cushion">9.6</div></div>`;
const asciiMoist = `<div id="rcA" title="Tokyo"><div class="time">t1</div></div>`;
const success = await captureBabaLogs(() => {
  const fetchImpl = async (url) => {
    if (url === CUSHION_URL) return new Response(asciiCushion, { status: 200 });
    if (url === MOIST_URL) return new Response(asciiMoist, { status: 200 });
    throw new Error(`unexpected url ${url}`);
  };
  return fetchBaba(fetchImpl, "NRT");
});
assert(success.error === undefined, `200 fetchBaba does not throw (${success.error})`);
assert(success.lines.length === 0, "200 responses are not logged");
assert(success.value?.[0]?.measurements?.[0]?.cushion === 9.6, "200 body is still parsed (not consumed by the logger)");

const bodyBoom = await captureBabaLogs(() => {
  const fetchImpl = async (url) => {
    if (url === CUSHION_URL) {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error("body exploded"));
        },
      });
      return new Response(stream, {
        status: 403,
        statusText: "Forbidden",
        headers: { server: "Ceph Object Gateway", "x-request-id": "rid-boom" },
      });
    }
    return new Response("ok", { status: 200 });
  };
  return fetchBaba(fetchImpl, "NRT");
});
assert(bodyBoom.error?.message === "cushion fetch failed: 403", "body read failure does not replace the status error");
const boomLogs = parseBabaLogs(bodyBoom.lines);
assert(boomLogs.length === 1, "body read failure still logs the HTTP failure");
assert(boomLogs[0].status === 403, "body read failure keeps status");
assert(boomLogs[0].headers.server === "Ceph Object Gateway", "body read failure still logs headers");
assert(boomLogs[0].bodyReadError === "body exploded", `bodyReadError recorded (${boomLogs[0].bodyReadError})`);
assert(boomLogs[0].body === "", "unreadable body is empty in the log");

const indexResult = await captureBabaLogs(() => {
  const inits = [];
  const fetchImpl = async (url, init) => {
    inits.push(init);
    if (url === INDEX_URLS[0]) return new Response("not a course page", { status: 200 });
    if (url === INDEX_URLS[1]) {
      return new Response("index denied\nsecond", {
        status: 403,
        statusText: "Forbidden",
        headers: { server: "Ceph Object Gateway", "x-cache": "Error" },
      });
    }
    if (url === INDEX_URLS[2]) throw new Error("index down");
    throw new Error(`unexpected url ${url}`);
  };
  return fetchCourseInfoByVenue(fetchImpl, "FUK").then((map) => ({ map, inits }));
});
assert(indexResult.error === undefined, "index failures stay best-effort and do not throw");
assert(indexResult.value?.map.size === 0, "failed index pages are still skipped");
assert(indexResult.value?.inits.every((init) => init === undefined), "index fetch adds no RequestInit");
const indexLogs = parseBabaLogs(indexResult.lines);
assert(indexLogs.length === 2, `index logs 403 and network error (got ${indexLogs.length})`);
const indexHttp = indexLogs.find((l) => l.status === 403);
const indexNet = indexLogs.find((l) => l.error === "index down");
assert(indexHttp?.target === "index" && indexHttp.url === INDEX_URLS[1], "index 403 names the URL");
assert(indexHttp?.colo === "FUK", "index 403 has colo");
assert(indexHttp?.body === "index denied\nsecond", "index body keeps its newline inside JSON");
assert(indexHttp?.headers["set-cookie"] === false, "index without set-cookie logs false");
assert(indexResult.levels.every((level) => level === "warn"), "index failures use console.warn");
assert(indexNet?.target === "index" && indexNet.url === INDEX_URLS[2], "index network error names the URL");
assert(indexNet?.colo === "FUK", "index network error has colo");
assert(!indexResult.lines.some((line) => line.includes("\n")), "index logs are single lines");

const indexOk = await captureBabaLogs(() => {
  const fetchImpl = async () => new Response("plain", { status: 200 });
  return fetchCourseInfoByVenue(fetchImpl, null);
});
assert(indexOk.error === undefined && indexOk.lines.length === 0, "index 200 pages are not logged");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll assertions passed");
