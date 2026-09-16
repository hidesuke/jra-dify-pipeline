// JRA 馬柱 URL の検証。
//
// 不正な CNAME でも HTTP ステータスは 200 のまま「パラメータエラー」ページが
// 返るため、本文マーカーで判定する（Shift_JIS）。
// 各場は 1R だけ見ればチェックサム／回次・日次のずれを検知できる。

import type { FetchLike } from "./baba";

export type RaceUrlCheckKind = "ok" | "error_page" | "fetch_failed";

export interface RaceUrlCheck {
  venueCode: string;
  raceNo: number;
  url: string;
  kind: RaceUrlCheckKind;
  /** true = 出馬表として有効 */
  ok: boolean;
  title?: string;
  reason?: string;
}

export interface RaceUrlRef {
  venueCode: string;
  raceNo: number;
  url: string;
}

const decodeShiftJis = async (res: Response) =>
  new TextDecoder("shift_jis").decode(await res.arrayBuffer());

/** HTML から <title> を取り出す */
export function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

/**
 * JRA のパラメータエラーページかどうか。
 * タイトル／error.css／error_code を優先し、出馬表マーカー欠落も補助にする。
 */
export function isJraErrorPage(html: string): boolean {
  const title = extractHtmlTitle(html) ?? "";
  if (title.includes("パラメータエラー")) return true;
  if (/error\.css/i.test(html) || /class="error_code"/i.test(html)) return true;
  if (html.includes("ご指定のページが見つかりませんでした")) return true;
  return false;
}

/** 出馬表ページらしいか（エラーでないことの裏取り） */
export function looksLikeShutsubaPage(html: string): boolean {
  const title = extractHtmlTitle(html) ?? "";
  if (title.includes("出馬表")) return true;
  return /class="race_title"/i.test(html);
}

/** 取得済み HTML を判定する（単体テスト用） */
export function classifyRaceHtml(html: string): { kind: "ok" | "error_page"; title: string | null; reason: string } {
  const title = extractHtmlTitle(html);
  if (isJraErrorPage(html)) {
    return {
      kind: "error_page",
      title,
      reason: title?.includes("パラメータエラー")
        ? "パラメータエラーページ"
        : "エラーページマーカーを検出",
    };
  }
  if (looksLikeShutsubaPage(html)) {
    return { kind: "ok", title, reason: "出馬表ページ" };
  }
  return {
    kind: "error_page",
    title,
    reason: "出馬表マーカーがなく、想定外のページ",
  };
}

/** 1 URL を GET して判定する */
export async function verifyRaceUrl(
  ref: RaceUrlRef,
  fetchImpl: FetchLike = fetch
): Promise<RaceUrlCheck> {
  try {
    const res = await fetchImpl(ref.url);
    if (!res.ok) {
      return {
        ...ref,
        kind: "fetch_failed",
        ok: false,
        reason: `HTTP ${res.status}`,
      };
    }
    const html = await decodeShiftJis(res);
    const classified = classifyRaceHtml(html);
    return {
      ...ref,
      kind: classified.kind,
      ok: classified.kind === "ok",
      title: classified.title ?? undefined,
      reason: classified.reason,
    };
  } catch (error) {
    return {
      ...ref,
      kind: "fetch_failed",
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 各場の 1R だけを検証する。
 * rows に 1R が無い場はスキップ（例: ?race=2 だけの /run）。
 */
export async function verifyVenue1RUrls(
  rows: RaceUrlRef[],
  fetchImpl: FetchLike = fetch
): Promise<RaceUrlCheck[]> {
  const byVenue = new Map<string, RaceUrlRef>();
  for (const row of rows) {
    if (row.raceNo !== 1) continue;
    if (!byVenue.has(row.venueCode)) byVenue.set(row.venueCode, row);
  }
  const targets = [...byVenue.values()];
  return Promise.all(targets.map((ref) => verifyRaceUrl(ref, fetchImpl)));
}
