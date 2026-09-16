import { DEFAULT_SEED } from "./checksum";

export interface SeedKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface StoredSeed {
  seed: number;
  updatedAt: string;
  sourceUrl?: string;
  date?: string;
  venueCode?: string;
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
    if (typeof parsed.seed !== "number" || parsed.seed < 0 || parsed.seed > 255) return null;
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
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    sourceUrl: record.sourceUrl,
    date: record.date,
    venueCode: record.venueCode,
  };
  await kv.put(SEED_KEY, JSON.stringify(stored));
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
}
