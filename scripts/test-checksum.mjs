#!/usr/bin/env node
/**
 * チェックサム seed / 失敗セッション / URL パース。
 * Usage: node scripts/test-checksum.mjs
 */

const DEFAULT_SEED = 0x16;
const DEFAULT_PREFIX = "pw01dde01";
const NAKAYAMA_1R =
  "https://jra.jp/JRADB/accessD.html?CNAME=pw01dde0106202604030120260912/4B";

function dayBcd(dateStrCompact) {
  const day = Number(dateStrCompact.slice(6, 8));
  return ((Math.floor(day / 10) << 4) | (day % 10)) & 0xff;
}

function calculateInitialChecksum(venueCode, kai, nichi, dateStrCompact, seed = DEFAULT_SEED) {
  const venue = Number(venueCode);
  return (venue * 0x4a + kai * 0x75 + nichi * 0x95 + dayBcd(dateStrCompact) * 0x9b + seed) % 256;
}

function generateRaceUrls(item, dateStrCompact, prefix = DEFAULT_PREFIX, seed = DEFAULT_SEED) {
  const header = `${prefix}${item.venueCode}${item.year.toString().padStart(4, "0")}${item.kai.toString().padStart(2, "0")}${item.nichi.toString().padStart(2, "0")}`;
  let currentCode = calculateInitialChecksum(item.venueCode, item.kai, item.nichi, dateStrCompact, seed);
  const results = [];
  for (let r = 1; r <= 12; r++) {
    const rStr = r.toString().padStart(2, "0");
    const hex = currentCode.toString(16).toUpperCase().padStart(2, "0");
    results.push({
      raceNo: r,
      url: `https://jra.jp/JRADB/accessD.html?CNAME=${header}${rStr}${dateStrCompact}/${hex}`,
    });
    if (r < 9 || r >= 10) currentCode = (currentCode - 0x4b + 256) % 256;
    else if (r === 9) currentCode = (currentCode - 0x0b + 256) % 256;
  }
  return results;
}

function parseRaceUrl(input) {
  const url = new URL(input.trim());
  const cname = url.searchParams.get("CNAME");
  const slash = cname.lastIndexOf("/");
  const body = cname.slice(0, slash);
  const checksumHex = cname.slice(slash + 1).toUpperCase();
  const dateCompact = body.slice(-8);
  return {
    prefix: body.slice(0, -20),
    venueCode: body.slice(-20, -18),
    year: Number(body.slice(-18, -14)),
    kai: Number(body.slice(-14, -12)),
    nichi: Number(body.slice(-12, -10)),
    raceNo: Number(body.slice(-10, -8)),
    dateCompact,
    date: `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`,
    checksum: Number.parseInt(checksumHex, 16),
    checksumHex,
  };
}

function extractSeedFrom1R(parsed) {
  const venue = Number(parsed.venueCode);
  const base = venue * 0x4a + parsed.kai * 0x75 + parsed.nichi * 0x95 + dayBcd(parsed.dateCompact) * 0x9b;
  return ((parsed.checksum - (base % 256)) + 256) % 256;
}

function validateSubmittedRaceUrl({ rawUrl, pending, expectedPrefix, getSchedule }) {
  if (pending.length === 0) return { ok: false, error: "補正待ちの 1R 失敗がありません" };
  const parsed = parseRaceUrl(rawUrl);
  if (parsed.raceNo !== 1) return { ok: false, error: "1R の URL を入力してください" };
  if (parsed.prefix !== expectedPrefix) return { ok: false, error: "prefix" };
  const match = pending.find(
    (p) => p.date === parsed.date && p.venues.some((v) => v.venueCode === parsed.venueCode)
  );
  if (!match) return { ok: false, error: "失敗記録にない日付・場です" };
  const schedule = getSchedule(parsed.date, parsed.venueCode);
  if (!schedule) return { ok: false, error: "開催表にない" };
  if (schedule.year !== parsed.year || schedule.kai !== parsed.kai || schedule.nichi !== parsed.nichi) {
    return { ok: false, error: "開催表の回次・日次と一致しません" };
  }
  return { ok: true, parsed, seed: extractSeedFrom1R(parsed), pendingDate: match.date };
}

function configuredAccessAuds(env) {
  return (env.CF_ACCESS_AUD ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatRaceUrlFailureEmail({ date, failures, seedFormUrl }) {
  const errorPages = failures.filter((f) => f.kind === "error_page");
  const lines = [`対象日: ${date}`];
  if (errorPages.length > 0 && seedFormUrl) {
    lines.push("Cloudflare Access");
    lines.push(seedFormUrl);
  }
  return { text: lines.join("\n") };
}

class MemorySeedKv {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    return this.map.get(key) ?? null;
  }
  async put(key, value) {
    this.map.set(key, value);
  }
  async delete(key) {
    this.map.delete(key);
  }
}

const SEED_KEY = "checksum_seed";
const PENDING_KEY = "seed_pending";

async function getStoredSeed(kv) {
  const raw = await kv.get(SEED_KEY);
  if (!raw) return DEFAULT_SEED;
  return JSON.parse(raw).seed;
}

async function saveSeed(kv, record) {
  await kv.put(SEED_KEY, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
}

async function getPendingCorrections(kv) {
  const raw = await kv.get(PENDING_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function addPendingCorrection(kv, date, venues) {
  const existing = await getPendingCorrections(kv);
  const current = existing.find((p) => p.date === date);
  if (!current) existing.push({ date, createdAt: new Date().toISOString(), venues: [...venues] });
  else {
    const byVenue = new Map(current.venues.map((v) => [v.venueCode, v]));
    for (const venue of venues) byVenue.set(venue.venueCode, venue);
    current.venues = [...byVenue.values()];
  }
  await kv.put(PENDING_KEY, JSON.stringify(existing));
}

async function setPendingCorrections(kv, pending) {
  if (pending.length === 0) await kv.delete(PENDING_KEY);
  else await kv.put(PENDING_KEY, JSON.stringify(pending));
}

const schedule = { venueCode: "06", year: 2026, kai: 4, nichi: 3 };
const hanshin = { venueCode: "09", year: 2026, kai: 4, nichi: 3 };

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

function getSchedule(date, venueCode) {
  if (date !== "2026-09-12") return undefined;
  if (venueCode === "06") return schedule;
  if (venueCode === "09") return hanshin;
  return undefined;
}

const checksum = calculateInitialChecksum("06", 4, 3, "20260912");
assert(checksum === 0x4b, `default 1R checksum is 0x4B (got 0x${checksum.toString(16)})`);

const urls = generateRaceUrls(schedule, "20260912");
assert(urls[0].url === NAKAYAMA_1R, `generated 1R matches known URL\n  ${urls[0].url}`);
assert(urls[1].url.endsWith("/00"), `2R checksum is 1R-0x4B (got ${urls[1].url.slice(-2)})`);

const parsed = parseRaceUrl(NAKAYAMA_1R);
assert(parsed.venueCode === "06" && parsed.raceNo === 1 && parsed.date === "2026-09-12", "parse known 1R");
assert(extractSeedFrom1R(parsed) === 0x16, "extract seed 0x16 from known 1R");

const shifted = generateRaceUrls(schedule, "20260912", DEFAULT_PREFIX, 0x17);
assert(shifted[0].url !== NAKAYAMA_1R, "different seed changes 1R checksum");
assert(extractSeedFrom1R(parseRaceUrl(shifted[0].url)) === 0x17, "round-trip seed 0x17");

const pending = [
  {
    date: "2026-09-12",
    venues: [
      { venueCode: "06", url: "https://jra.jp/bad" },
      { venueCode: "09", url: "https://jra.jp/bad2" },
    ],
  },
];

const okSubmit = validateSubmittedRaceUrl({
  rawUrl: NAKAYAMA_1R,
  pending,
  expectedPrefix: DEFAULT_PREFIX,
  getSchedule,
});
assert(okSubmit.ok && okSubmit.seed === 0x16, "one venue 1R is enough to recover seed");

const race2 = validateSubmittedRaceUrl({
  rawUrl: urls[1].url,
  pending,
  expectedPrefix: DEFAULT_PREFIX,
  getSchedule,
});
assert(!race2.ok && race2.error.includes("1R"), `reject non-1R (${race2.error})`);

const emptyPending = validateSubmittedRaceUrl({
  rawUrl: NAKAYAMA_1R,
  pending: [],
  expectedPrefix: DEFAULT_PREFIX,
  getSchedule,
});
assert(!emptyPending.ok && emptyPending.error.includes("補正待ち"), "reject when no pending session");

{
  const kv = new MemorySeedKv();
  assert((await getStoredSeed(kv)) === DEFAULT_SEED, "missing KV seed falls back to 0x16");
  await saveSeed(kv, { seed: 0x99, sourceUrl: NAKAYAMA_1R });
  assert((await getStoredSeed(kv)) === 0x99, "persisted seed is read back");
  await addPendingCorrection(kv, "2026-09-12", [{ venueCode: "06", url: "u1" }]);
  await addPendingCorrection(kv, "2026-09-12", [{ venueCode: "09", url: "u2" }]);
  await addPendingCorrection(kv, "2026-09-13", [{ venueCode: "06", url: "u3" }]);
  const all = await getPendingCorrections(kv);
  assert(all.length === 2, `pending dates merged/appended (got ${all.length})`);
  assert(all.find((p) => p.date === "2026-09-12")?.venues.length === 2, "same date venues merged");
  await setPendingCorrections(kv, []);
  assert((await getPendingCorrections(kv)).length === 0, "clear pending");
}

{
  const mail = formatRaceUrlFailureEmail({
    date: "2026-09-12",
    seedFormUrl: "https://jra-dify-pipeline.hdsk.workers.dev/seed",
    failures: [{ venueCode: "06", kind: "error_page" }],
  });
  assert(mail.text.includes("/seed"), "email includes seed form URL");
  assert(mail.text.includes("Cloudflare Access"), "email mentions Access");
  assert(!mail.text.includes("token="), "email has no correction token");
}

{
  const env = { CF_ACCESS_AUD: "aud-run, aud-seed" };
  assert(configuredAccessAuds(env).join(",") === "aud-run,aud-seed", "comma-separated Access AUDs");
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll checksum/seed assertions passed");
