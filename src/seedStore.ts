import { DEFAULT_SEED, readStoredSeed, SEED_FORMULA_VERSION } from "./checksum.ts";

// チェックサム seed の保存。式は src/checksum.ts（formulaVersion 2）。
//
// 共通キー `checksum_seed` は全場共通の値。formulaVersion が 2 でないレコードは読まない。
// 場ごとの上書きは `checksum_seed:{場コード}:{年}:{回次}`（例: checksum_seed:04:2026:04）。
// 上書きが無い開催は共通 seed、それも無ければ既定の 0x4B。上書きが一つも無いとき URL は共通 seed だけになる。
// 回次まで含める。次の回には前の回の上書きを持ち越さない。
// 日次では分けない。Cron は翌日分を前日に作るので、同じ回の上書きを翌日まで使う。

export interface SeedKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface StoredSeed {
  seed: number;
  updatedAt: string;
  /** 2 未満、または欠落は旧式の seed。生成には使わない。 */
  formulaVersion?: number;
  sourceUrl?: string;
  date?: string;
  venueCode?: string;
  year?: number;
  kai?: number;
}

export interface VenueSeedRecord extends StoredSeed {
  venueCode: string;
  year: number;
  kai: number;
}

export type SeedSource = "venue" | "global" | "default";

export interface ResolvedSeed {
  venueCode: string;
  year: number;
  kai: number;
  seed: number;
  source: SeedSource;
}

export interface SeedOverview {
  globalSeed: number;
  globalStored: boolean;
  venues: VenueSeedRecord[];
}

export interface PendingVenue {
  venueCode: string;
  url: string;
  reason?: string;
}

export interface PendingCorrection {
  date: string;
  createdAt: string;
  venues: PendingVenue[];
}

export const DEFAULT_PUBLIC_BASE_URL = "https://jra-dify-pipeline.hdsk.workers.dev";

const SEED_KEY = "checksum_seed";
const PENDING_KEY = "seed_pending";
const VENUE_SEED_PREFIX = "checksum_seed:";
const VENUE_SEED_KEY_RE = /^checksum_seed:(\d{2}):(\d{4}):(\d{2})$/;

export function resolvePublicBaseUrl(
  env: { PUBLIC_BASE_URL?: string },
  requestUrl?: string
): string {
  const fromEnv = env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (requestUrl) return new URL(requestUrl).origin;
  return DEFAULT_PUBLIC_BASE_URL;
}

export function seedFormUrl(env: { PUBLIC_BASE_URL?: string }, requestUrl?: string): string {
  return `${resolvePublicBaseUrl(env, requestUrl)}/seed`;
}

function parseSeedRecord(raw: string | null): StoredSeed | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSeed;
    if (readStoredSeed(parsed) === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getStoredSeedRecord(kv: SeedKv | undefined): Promise<StoredSeed | null> {
  if (!kv) return null;
  return parseSeedRecord(await kv.get(SEED_KEY));
}

export async function getStoredSeed(kv: SeedKv | undefined): Promise<number> {
  const record = await getStoredSeedRecord(kv);
  return record?.seed ?? DEFAULT_SEED;
}

export async function saveSeed(
  kv: SeedKv | undefined,
  record: Omit<StoredSeed, "updatedAt"> & { updatedAt?: string }
): Promise<void> {
  if (!kv) {
    console.warn("CHECKSUM_SEED KV is not bound; seed was not persisted");
    return;
  }
  const stored: StoredSeed = {
    seed: record.seed,
    formulaVersion: SEED_FORMULA_VERSION,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    sourceUrl: record.sourceUrl,
    date: record.date,
    venueCode: record.venueCode,
    year: record.year,
    kai: record.kai,
  };
  await kv.put(SEED_KEY, JSON.stringify(stored));
}

export function formatSeedHex(seed: number): string {
  return seed.toString(16).toUpperCase().padStart(2, "0");
}

export function formatResolvedSeeds(seeds: ResolvedSeed[]): string {
  return seeds
    .map((r) => {
      const hex = formatSeedHex(r.seed);
      return r.source === "venue" ? `${r.venueCode}=0x${hex}` : `${r.venueCode}=0x${hex}(${r.source})`;
    })
    .join(",");
}

/** 場・年・回次の KV キー。回次は 2 桁に揃える（4 と 04 を同じキーにする）。 */
export function venueSeedStorageKey(venueCode: string, year: number, kai: number): string {
  if (!/^\d{2}$/.test(venueCode)) {
    throw new Error(`invalid venue code: ${venueCode}`);
  }
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`invalid year: ${year}`);
  }
  if (!Number.isInteger(kai) || kai < 1 || kai > 99) {
    throw new Error(`invalid kai: ${kai}`);
  }
  return `${VENUE_SEED_PREFIX}${venueCode}:${year}:${kai.toString().padStart(2, "0")}`;
}

export async function getVenueSeedRecord(
  kv: SeedKv | undefined,
  venueCode: string,
  year: number,
  kai: number
): Promise<StoredSeed | null> {
  if (!kv) return null;
  return parseSeedRecord(await kv.get(venueSeedStorageKey(venueCode, year, kai)));
}

export async function saveVenueSeed(
  kv: SeedKv | undefined,
  record: Omit<StoredSeed, "updatedAt" | "venueCode" | "year" | "kai"> & {
    venueCode: string;
    year: number;
    kai: number;
    updatedAt?: string;
  }
): Promise<void> {
  if (!kv) {
    console.warn("CHECKSUM_SEED KV is not bound; venue seed was not persisted");
    return;
  }
  const stored: StoredSeed = {
    seed: record.seed,
    formulaVersion: SEED_FORMULA_VERSION,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    sourceUrl: record.sourceUrl,
    date: record.date,
    venueCode: record.venueCode,
    year: record.year,
    kai: record.kai,
  };
  await kv.put(venueSeedStorageKey(record.venueCode, record.year, record.kai), JSON.stringify(stored));
}

export async function listVenueSeedRecords(kv: SeedKv | undefined): Promise<VenueSeedRecord[]> {
  if (!kv?.list) {
    if (kv) console.warn("CHECKSUM_SEED KV does not support list(); per-course seeds stay hidden on /seed");
    return [];
  }
  const names: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const listed = await kv.list({ prefix: VENUE_SEED_PREFIX, limit: 100, cursor });
    for (const key of listed.keys) names.push(key.name);
    if (listed.list_complete || !listed.cursor || listed.cursor === cursor) break;
    cursor = listed.cursor;
  }

  const records: VenueSeedRecord[] = [];
  for (const name of names) {
    const match = VENUE_SEED_KEY_RE.exec(name);
    if (!match) continue;
    const record = parseSeedRecord(await kv.get(name));
    if (!record) continue;
    records.push({
      ...record,
      venueCode: match[1],
      year: Number(match[2]),
      kai: Number(match[3]),
    });
  }
  records.sort((a, b) => a.venueCode.localeCompare(b.venueCode) || a.year - b.year || a.kai - b.kai);
  return records;
}

export async function loadSeedOverview(kv: SeedKv | undefined): Promise<SeedOverview> {
  const global = await getStoredSeedRecord(kv);
  return {
    globalSeed: global?.seed ?? DEFAULT_SEED,
    globalStored: global != null,
    venues: await listVenueSeedRecords(kv),
  };
}

/**
 * 各開催の seed。formulaVersion 2 の場・年・回次があればそれ、無ければ共通 `checksum_seed`、
 * それも無ければ初期値 0x4B。
 * override は今保存した値。KV の書き込み直後に読めなくても、その場だけはこれを使う。
 */
export async function resolveSeeds(
  kv: SeedKv | undefined,
  courses: { venueCode: string; year: number; kai: number }[],
  override?: { venueCode: string; year: number; kai: number; seed: number }
): Promise<ResolvedSeed[]> {
  const global = await getStoredSeedRecord(kv);
  const cache = new Map<string, ResolvedSeed>();
  const resolved: ResolvedSeed[] = [];
  for (const course of courses) {
    const cacheKey = `${course.venueCode}:${course.year}:${course.kai}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      resolved.push(cached);
      continue;
    }
    if (
      override &&
      override.venueCode === course.venueCode &&
      override.year === course.year &&
      override.kai === course.kai
    ) {
      const entry: ResolvedSeed = {
        venueCode: course.venueCode,
        year: course.year,
        kai: course.kai,
        seed: override.seed,
        source: "venue",
      };
      cache.set(cacheKey, entry);
      resolved.push(entry);
      continue;
    }
    const venue = await getVenueSeedRecord(kv, course.venueCode, course.year, course.kai);
    const entry: ResolvedSeed = {
      venueCode: course.venueCode,
      year: course.year,
      kai: course.kai,
      seed: venue?.seed ?? global?.seed ?? DEFAULT_SEED,
      source: venue ? "venue" : global ? "global" : "default",
    };
    cache.set(cacheKey, entry);
    resolved.push(entry);
  }
  return resolved;
}

function parsePending(raw: string | null): PendingCorrection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingCorrection[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) => p && typeof p.date === "string" && Array.isArray(p.venues) && p.venues.length > 0
    );
  } catch {
    return [];
  }
}

export async function getPendingCorrections(kv: SeedKv | undefined): Promise<PendingCorrection[]> {
  if (!kv) return [];
  return parsePending(await kv.get(PENDING_KEY));
}

export async function addPendingCorrection(
  kv: SeedKv | undefined,
  date: string,
  venues: PendingVenue[]
): Promise<PendingCorrection[]> {
  if (venues.length === 0) return getPendingCorrections(kv);
  if (!kv) {
    console.warn("CHECKSUM_SEED KV is not bound; pending correction was not stored");
    return [{ date, createdAt: new Date().toISOString(), venues }];
  }

  const now = new Date().toISOString();
  const existing = await getPendingCorrections(kv);
  const current = existing.find((p) => p.date === date);
  if (!current) {
    existing.push({ date, createdAt: now, venues: [...venues] });
  } else {
    const byVenue = new Map(current.venues.map((v) => [v.venueCode, v]));
    for (const venue of venues) byVenue.set(venue.venueCode, venue);
    current.venues = [...byVenue.values()];
  }
  await kv.put(PENDING_KEY, JSON.stringify(existing));
  return existing;
}

export async function setPendingCorrections(
  kv: SeedKv | undefined,
  pending: PendingCorrection[]
): Promise<void> {
  if (!kv) return;
  if (pending.length === 0) {
    await kv.delete(PENDING_KEY);
    return;
  }
  await kv.put(PENDING_KEY, JSON.stringify(pending));
}

export class MemorySeedKv implements SeedKv {
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix ?? "";
    const all = [...this.map.keys()].filter((name) => name.startsWith(prefix)).sort();
    const parsed = options?.cursor ? Number(options.cursor) : 0;
    const start = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const limit = options?.limit ?? all.length;
    const slice = all.slice(start, start + limit);
    const next = start + slice.length;
    const listComplete = next >= all.length;
    return {
      keys: slice.map((name) => ({ name })),
      list_complete: listComplete,
      cursor: listComplete ? undefined : String(next),
    };
  }
}
