// JRA 馬柱 URL のチェックサム。
//
// 1R = (場 * 0x4A + 回次 * 0x75 + 日次 * 0x95 + 日BCD * 0x9B + seed) % 256
// 2R 以降は -0x4B（9R→10R だけ -0x0B）。
// seed の既定は 0x16。月の項は 9 月サンプルのみのため、不足分は seed に吸収する。

import type { ScheduleItem } from "./schedules";
import type { PendingCorrection } from "./seedStore";

export const DEFAULT_SEED = 0x16;
export const DEFAULT_PREFIX = "pw01dde01";
export const JRA_ACCESS_ORIGIN = "https://jra.jp";
export const JRA_ACCESS_PATH = "/JRADB/accessD.html";

/** スマホは www.jra.go.jp、PC は jra.jp。生成 URL は従来どおり jra.jp に正規化する。 */
const JRA_ACCESS_HOSTS = new Set(["jra.jp", "www.jra.jp", "jra.go.jp", "www.jra.go.jp"]);

export function isJraAccessHost(hostname: string): boolean {
  return JRA_ACCESS_HOSTS.has(hostname.trim().toLowerCase());
}

export interface ParsedRaceUrl {
  prefix: string;
  venueCode: string;
  year: number;
  kai: number;
  nichi: number;
  raceNo: number;
  dateCompact: string;
  date: string;
  checksum: number;
  checksumHex: string;
  url: string;
}

export type ParseRaceUrlResult =
  | { ok: true; parsed: ParsedRaceUrl }
  | { ok: false; error: string };

export type ValidateCorrectionResult =
  | { ok: true; parsed: ParsedRaceUrl; seed: number; pendingDate: string }
  | { ok: false; error: string };

function dayBcd(dateStrCompact: string): number {
  const day = Number(dateStrCompact.slice(6, 8));
  return ((Math.floor(day / 10) << 4) | (day % 10)) & 0xff;
}

export function calculateInitialChecksum(
  venueCode: string,
  kai: number,
  nichi: number,
  dateStrCompact: string,
  seed = DEFAULT_SEED
): number {
  const venue = Number(venueCode);
  return (venue * 0x4a + kai * 0x75 + nichi * 0x95 + dayBcd(dateStrCompact) * 0x9b + seed) % 256;
}

export function generateRaceUrls(
  item: ScheduleItem,
  dateStrCompact: string,
  prefix = DEFAULT_PREFIX,
  seed = DEFAULT_SEED
): { raceNo: number; url: string }[] {
  const header = `${prefix}${item.venueCode}${item.year.toString().padStart(4, "0")}${item.kai.toString().padStart(2, "0")}${item.nichi.toString().padStart(2, "0")}`;
  let currentCode = calculateInitialChecksum(item.venueCode, item.kai, item.nichi, dateStrCompact, seed);
  const results: { raceNo: number; url: string }[] = [];

  for (let r = 1; r <= 12; r++) {
    const rStr = r.toString().padStart(2, "0");
    const hex = currentCode.toString(16).toUpperCase().padStart(2, "0");
    const url = `${JRA_ACCESS_ORIGIN}${JRA_ACCESS_PATH}?CNAME=${header}${rStr}${dateStrCompact}/${hex}`;
    results.push({ raceNo: r, url });

    if (r < 9 || r >= 10) {
      currentCode = (currentCode - 0x4b + 256) % 256;
    } else if (r === 9) {
      currentCode = (currentCode - 0x0b + 256) % 256;
    }
  }
  return results;
}

export function compactDate(dateKey: string): string {
  return dateKey.replace(/-/g, "");
}

export function dateKeyFromCompact(dateCompact: string): string {
  return `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`;
}

export function parseRaceUrl(input: string): ParseRaceUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "URL が空です" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL として解釈できません" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "http または https の URL を入力してください" };
  }
  if (!isJraAccessHost(url.hostname) || url.pathname !== JRA_ACCESS_PATH) {
    return {
      ok: false,
      error: `対応する URL は jra.jp または www.jra.go.jp の ${JRA_ACCESS_PATH}?CNAME=... です`,
    };
  }

  const cname = url.searchParams.get("CNAME");
  if (!cname) return { ok: false, error: "CNAME パラメータがありません" };

  const slash = cname.lastIndexOf("/");
  if (slash < 0) return { ok: false, error: "CNAME にチェックサム（/XX）がありません" };

  const body = cname.slice(0, slash);
  const checksumHex = cname.slice(slash + 1).toUpperCase();
  if (!/^[0-9A-F]{2}$/.test(checksumHex)) {
    return { ok: false, error: "チェックサムは 2 桁の 16 進数である必要があります" };
  }
  if (body.length < 21) {
    return { ok: false, error: "CNAME の本文が短すぎます" };
  }

  const dateCompact = body.slice(-8);
  const raceNo = Number(body.slice(-10, -8));
  const nichi = Number(body.slice(-12, -10));
  const kai = Number(body.slice(-14, -12));
  const year = Number(body.slice(-18, -14));
  const venueCode = body.slice(-20, -18);
  const prefix = body.slice(0, -20);

  if (!/^\d{8}$/.test(dateCompact)) return { ok: false, error: "CNAME の日付が不正です" };
  if (!Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12) {
    return { ok: false, error: "レース番号が不正です" };
  }
  if (!Number.isInteger(nichi) || nichi < 1) return { ok: false, error: "日次が不正です" };
  if (!Number.isInteger(kai) || kai < 1) return { ok: false, error: "回次が不正です" };
  if (!Number.isInteger(year) || year < 2000) return { ok: false, error: "年が不正です" };
  if (!/^\d{2}$/.test(venueCode)) return { ok: false, error: "場コードが不正です" };
  if (!prefix) return { ok: false, error: "CNAME の接頭辞がありません" };

  return {
    ok: true,
    parsed: {
      prefix,
      venueCode,
      year,
      kai,
      nichi,
      raceNo,
      dateCompact,
      date: dateKeyFromCompact(dateCompact),
      checksum: Number.parseInt(checksumHex, 16),
      checksumHex,
      url: `${JRA_ACCESS_ORIGIN}${JRA_ACCESS_PATH}?CNAME=${body}/${checksumHex}`,
    },
  };
}

/** 1R URL から加算定数 seed を逆算する */
export function extractSeedFrom1R(parsed: ParsedRaceUrl): number {
  const venue = Number(parsed.venueCode);
  const base = venue * 0x4a + parsed.kai * 0x75 + parsed.nichi * 0x95 + dayBcd(parsed.dateCompact) * 0x9b;
  return ((parsed.checksum - (base % 256)) + 256) % 256;
}

export function validateSubmittedRaceUrl(params: {
  rawUrl: string;
  pending: PendingCorrection[];
  expectedPrefix: string;
  getSchedule: (date: string, venueCode: string) => ScheduleItem | undefined;
}): ValidateCorrectionResult {
  const { rawUrl, pending, expectedPrefix, getSchedule } = params;
  if (pending.length === 0) {
    return { ok: false, error: "補正待ちの 1R 失敗がありません" };
  }

  const parsedResult = parseRaceUrl(rawUrl);
  if (!parsedResult.ok) return parsedResult;

  const { parsed } = parsedResult;
  if (parsed.raceNo !== 1) {
    return { ok: false, error: "1R の URL を入力してください" };
  }
  if (parsed.prefix !== expectedPrefix) {
    return {
      ok: false,
      error: `CNAME 接頭辞が一致しません（期待: ${expectedPrefix}、入力: ${parsed.prefix}）`,
    };
  }

  const match = pending.find(
    (p) => p.date === parsed.date && p.venues.some((v) => v.venueCode === parsed.venueCode)
  );
  if (!match) {
    const expected = pending
      .flatMap((p) => p.venues.map((v) => `${p.date} 場:${v.venueCode}`))
      .join("、");
    return {
      ok: false,
      error: `失敗記録にない日付・場です。対象は ${expected} です`,
    };
  }

  const schedule = getSchedule(parsed.date, parsed.venueCode);
  if (!schedule) {
    return { ok: false, error: `開催表に ${parsed.date} 場:${parsed.venueCode} がありません` };
  }
  if (schedule.year !== parsed.year || schedule.kai !== parsed.kai || schedule.nichi !== parsed.nichi) {
    return {
      ok: false,
      error: `開催表の回次・日次と一致しません（表: ${schedule.year} ${schedule.kai}回 ${schedule.nichi}日 / 入力: ${parsed.year} ${parsed.kai}回 ${parsed.nichi}日）。シードではなく開催表を確認してください`,
    };
  }

  return {
    ok: true,
    parsed,
    seed: extractSeedFrom1R(parsed),
    pendingDate: match.date,
  };
}
