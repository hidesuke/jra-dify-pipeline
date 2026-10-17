#!/usr/bin/env node
/**
 * 場・年・回次の seed は #17 の式の上書き。
 * 上書きが無いとき 2026-10-18 は新潟 /77、東京 /00、京都 /DE。
 * Usage: node --experimental-strip-types scripts/test-seed-per-venue.mjs
 */

import { getSchedulesForDate } from "../src/schedules/index.ts";
import { rowsForSchedules } from "../src/raceUrls.ts";
import { handleSeedRequest } from "../src/seedForm.ts";
import { formatRaceUrlFailureEmail } from "../src/notify.ts";
import { DEFAULT_SEED, SEED_FORMULA_VERSION, generateRaceUrls } from "../src/checksum.ts";
import {
  MemorySeedKv,
  addPendingCorrection,
  getPendingCorrections,
  getStoredSeed,
  saveSeed,
  saveVenueSeed,
  venueSeedStorageKey,
} from "../src/seedStore.ts";

const OVERRIDE = 0x10;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

function meeting(date, venueCode) {
  const item = getSchedulesForDate(date)?.find((s) => s.venueCode === venueCode);
  if (!item) throw new Error(`no schedule ${date} ${venueCode}`);
  return item;
}

function firstUrls(rows) {
  const byVenue = {};
  for (const row of rows) {
    if (row.raceNo === 1) byVenue[row.venueCode] = row.url;
  }
  return byVenue;
}

async function urlsFor(kv, date) {
  const schedules = getSchedulesForDate(date);
  const { rows, seeds } = await rowsForSchedules(kv, schedules, date);
  return { urls: firstUrls(rows), seeds };
}

function generated(item, date, seed = DEFAULT_SEED) {
  return generateRaceUrls(item, date.replace(/-/g, ""), "pw01dde01", seed)[0].url;
}

const niigata = meeting("2026-10-18", "04");
const tokyo = meeting("2026-10-18", "05");
const kyoto = meeting("2026-10-18", "08");
const NIIGATA = generated(niigata, "2026-10-18");
const TOKYO = generated(tokyo, "2026-10-18");
const KYOTO = generated(kyoto, "2026-10-18");

assert(NIIGATA.endsWith("/77"), `default 新潟 10/18 is /77 (${NIIGATA})`);
assert(TOKYO.endsWith("/00"), `default 東京 10/18 is /00 (${TOKYO})`);
assert(KYOTO.endsWith("/DE"), `default 京都 10/18 is /DE (${KYOTO})`);
assert(DEFAULT_SEED === 0x4b, "default seed is #17's 0x4B");

{
  const empty = new MemorySeedKv();
  const { urls, seeds } = await urlsFor(empty, "2026-10-18");
  assert(urls["04"] === NIIGATA && urls["05"] === TOKYO && urls["08"] === KYOTO, "no keys match #17 on 2026-10-18");
  assert(seeds.every((s) => s.source === "default" && s.seed === DEFAULT_SEED), "no keys use the default seed");
}

{
  const legacyGlobal = new MemorySeedKv();
  await legacyGlobal.put("checksum_seed", JSON.stringify({ seed: 0x00, updatedAt: "2026-10-01T00:00:00.000Z" }));
  const { urls, seeds } = await urlsFor(legacyGlobal, "2026-10-18");
  assert(urls["04"] === NIIGATA && urls["05"] === TOKYO && urls["08"] === KYOTO, "global record without formulaVersion is ignored");
  assert(seeds.every((s) => s.source === "default"), "ignored global record falls back to default");
  assert((await getStoredSeed(legacyGlobal)) === DEFAULT_SEED, "getStoredSeed ignores a legacy global record");
}

{
  const legacyVenue = new MemorySeedKv();
  const key = venueSeedStorageKey("04", 2026, 4);
  await legacyVenue.put(key, JSON.stringify({ seed: 0x00, venueCode: "04", year: 2026, kai: 4 }));
  await legacyVenue.put(
    venueSeedStorageKey("05", 2026, 4),
    JSON.stringify({ seed: 0x00, formulaVersion: 1, venueCode: "05", year: 2026, kai: 4 })
  );
  const { urls, seeds } = await urlsFor(legacyVenue, "2026-10-18");
  assert(urls["04"] === NIIGATA && urls["05"] === TOKYO && urls["08"] === KYOTO, "stale per-course records are ignored");
  assert(seeds.every((s) => s.source === "default"), "stale per-course records do not override");
}

{
  const global = new MemorySeedKv();
  await saveSeed(global, { seed: 0x00 });
  const before = await urlsFor(global, "2026-10-18");
  assert(
    before.urls["04"] !== NIIGATA && before.urls["05"] !== TOKYO && before.urls["08"] !== KYOTO,
    "a v2 global seed changes every course"
  );
  assert(before.seeds.every((s) => s.source === "global" && s.seed === 0x00), "courses share the global v2 seed");
  const stored = JSON.parse(await global.get("checksum_seed"));
  assert(stored.formulaVersion === SEED_FORMULA_VERSION, "saveSeed writes formulaVersion 2");

  await saveVenueSeed(global, { seed: DEFAULT_SEED, venueCode: "04", year: 2026, kai: 4, date: "2026-10-18" });
  const after = await urlsFor(global, "2026-10-18");
  assert(after.urls["04"] === NIIGATA, "新潟 override restores only 新潟");
  assert(after.urls["05"] === before.urls["05"] && after.urls["08"] === before.urls["08"], "東京 and 京都 stay on the global seed");
  assert(after.seeds.find((s) => s.venueCode === "04")?.source === "venue", "新潟 source is the per-course record");
  assert(after.seeds.filter((s) => s.venueCode !== "04").every((s) => s.source === "global"), "other courses stay global");
  const venue = JSON.parse(await global.get(venueSeedStorageKey("04", 2026, 4)));
  assert(venue.formulaVersion === SEED_FORMULA_VERSION && venue.seed === DEFAULT_SEED, "per-course record is formulaVersion 2");
  assert((await getStoredSeed(global)) === 0x00, "per-course save does not change the global seed");
}

{
  const onlyNiigata = new MemorySeedKv();
  await saveVenueSeed(onlyNiigata, {
    seed: OVERRIDE,
    venueCode: "04",
    year: 2026,
    kai: 4,
    date: "2026-10-18",
  });
  const { urls } = await urlsFor(onlyNiigata, "2026-10-18");
  assert(urls["04"] === generated(niigata, "2026-10-18", OVERRIDE), "新潟 uses its override");
  assert(urls["04"] !== NIIGATA, "the override actually changes 新潟");
  assert(urls["05"] === TOKYO && urls["08"] === KYOTO, "東京 and 京都 stay on the default");
  await saveVenueSeed(onlyNiigata, { seed: 0x11, venueCode: "04", year: 2026, kai: 3 });
  const otherKai = await urlsFor(onlyNiigata, "2026-10-18");
  assert(otherKai.urls["04"] === urls["04"], "a different 回 does not replace 4回新潟");
}

{
  const kv = new MemorySeedKv();
  await saveVenueSeed(kv, { seed: OVERRIDE, venueCode: "04", year: 2026, kai: 4, date: "2026-10-18" });
  const htmlRes = await handleSeedRequest(
    new Request("https://example.com/seed"),
    { CHECKSUM_SEED: kv },
    async () => []
  );
  const html = await htmlRes.text();
  assert(html.includes("新潟（04） 2026年4回: <code>0x10</code>"), "GET /seed shows the 新潟 override");
  assert(
    html.includes("共通シード（場ごとの値がないときのフォールバック）: <code>0x4B</code>"),
    "GET /seed shows the 0x4B fallback"
  );
  assert(!html.includes("東京（05）"), "GET /seed does not invent a 東京 override");
  assert(!html.includes("全場共通"), "GET /seed does not say one seed covers every course");
}

{
  const kv = new MemorySeedKv();
  await addPendingCorrection(kv, "2026-10-18", [
    { venueCode: "04", url: "https://jra.jp/generated-niigata" },
    { venueCode: "05", url: "https://jra.jp/generated-tokyo" },
    { venueCode: "08", url: "https://jra.jp/generated-kyoto" },
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(`<!DOCTYPE html><html><head><title>出馬表</title></head><body><div class="race_title">1R</div></body></html>`, {
      status: 200,
    });
  const seen = [];
  const enqueue = async (updated, pending) => {
    seen.push(updated);
    const still = updated.venueCode === "04" ? ["05", "08"] : ["08"];
    const done = pending.flatMap((p) => p.venues.map((v) => v.venueCode)).filter((code) => !still.includes(code));
    return [
      {
        date: pending[0].date,
        venueCodes: done,
        enqueued: done.length * 12,
        stillFailed: still.map((venueCode) => ({
          venueCode,
          reason: "パラメータエラーページ",
          url: "https://jra.jp/still-bad",
        })),
        preview: done.join(","),
        checks: [],
      },
    ];
  };
  try {
    const niigataUrl = generated(niigata, "2026-10-18", OVERRIDE);
    const first = await handleSeedRequest(
      new Request("https://example.com/seed", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: niigataUrl }),
      }),
      { CHECKSUM_SEED: kv },
      enqueue
    );
    const firstHtml = await first.text();
    assert(first.status === 200, `新潟 calibration accepted (${first.status})`);
    assert(firstHtml.includes("新潟（04） 2026年4回のシードを <code>0x10</code>"), "response names the calibrated course");
    assert(firstHtml.includes("他の場のシードは変更していません"), "response says other courses are unchanged");
    assert((await kv.get("checksum_seed")) == null, "POST /seed does not write the global key");
    const venue = JSON.parse(await kv.get(venueSeedStorageKey("04", 2026, 4)));
    assert(venue.seed === OVERRIDE && venue.formulaVersion === SEED_FORMULA_VERSION, "新潟 key is formulaVersion 2");
    assert((await kv.get(venueSeedStorageKey("05", 2026, 4))) == null, "東京 key was not created");
    const pendingAfter = await getPendingCorrections(kv);
    assert(
      pendingAfter[0]?.venues.map((v) => v.venueCode).join(",") === "05,08",
      "東京 and 京都 stay pending"
    );
    const { urls } = await urlsFor(kv, "2026-10-18");
    assert(urls["04"] === niigataUrl && urls["05"] === TOKYO && urls["08"] === KYOTO, "only 新潟's URL changed");
    assert(seen[0]?.venueCode === "04" && seen[0]?.seed === OVERRIDE && seen[0]?.kai === 4, "enqueue receives the saved 新潟 seed");

    const second = await handleSeedRequest(
      new Request("https://example.com/seed", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: generated(tokyo, "2026-10-18", 0x20) }),
      }),
      { CHECKSUM_SEED: kv },
      enqueue
    );
    assert(second.status === 200, `東京 calibration accepted (${second.status})`);
    const niigataKept = JSON.parse(await kv.get(venueSeedStorageKey("04", 2026, 4)));
    const tokyoStored = JSON.parse(await kv.get(venueSeedStorageKey("05", 2026, 4)));
    assert(niigataKept.seed === OVERRIDE, "新潟 override survives 東京 calibration");
    assert(tokyoStored.seed === 0x20 && tokyoStored.formulaVersion === SEED_FORMULA_VERSION, "東京 override is stored on its own key");
    assert((await kv.get("checksum_seed")) == null, "global key is still absent");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const kv = new MemorySeedKv();
  const schedules = getSchedulesForDate("2026-10-18");
  const { rows } = await rowsForSchedules(kv, schedules, "2026-10-18", "pw01dde01", undefined, {
    venueCode: "04",
    year: 2026,
    kai: 4,
    seed: OVERRIDE,
  });
  const urls = firstUrls(rows);
  assert(urls["04"] === generated(niigata, "2026-10-18", OVERRIDE), "in-memory override changes 新潟 before the KV read");
  assert(urls["05"] === TOKYO && urls["08"] === KYOTO, "in-memory override leaves the other courses");
  assert((await kv.get(venueSeedStorageKey("04", 2026, 4))) == null, "override does not require the venue key to be visible yet");
}

{
  const mail = formatRaceUrlFailureEmail({
    date: "2026-10-18",
    seedFormUrl: "https://jra-dify-pipeline.hdsk.workers.dev/seed",
    failures: [
      { venueCode: "04", raceNo: 1, url: "https://jra.jp/bad", kind: "error_page", ok: false },
      { venueCode: "05", raceNo: 1, url: "https://jra.jp/bad2", kind: "error_page", ok: false },
    ],
  });
  assert(mail.text.includes("/seed"), "failure email links to /seed");
  assert(mail.text.includes("場・年・回"), "failure email says the override is per course meeting");
  assert(mail.text.includes("共通シードは変わりません"), "failure email says the shared seed stays");
  assert(mail.text.includes("場ごとに"), "failure email says to calibrate each failing course");
  assert(!mail.text.includes("全場のシード"), "failure email does not say one URL updates every course");
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll per-course seed assertions passed");
