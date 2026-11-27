// 本体から馬場取得 Worker を Service Binding の fetch() で呼ぶ。
// RPC は placement が効かないため使わない。JRA への直接 fetch はここには置かない。

import { INGRESS_COLO_HEADER, normalizeAirportCode, type CourseInfo, type VenueBaba } from "./baba.ts";

export const BABA_FETCH_PLACEMENT_EVENT = "baba_fetch_placement";
export const BABA_FETCHER_URL = "https://jra-baba-fetcher.internal/bundle";

export interface BabaFetcherBinding {
  fetch(input: Request): Promise<Response>;
}

interface BabaBundle {
  venues: VenueBaba[];
  courseByVenue: Map<string, CourseInfo>;
}

function safePlacement(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(trimmed) ? trimmed : null;
}

function logPlacement(status: number, placement: string | null): void {
  try {
    console.log(
      JSON.stringify({
        event: BABA_FETCH_PLACEMENT_EVENT,
        status,
        placement,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    // ログ出力の失敗で取得結果は変えない
  }
}

function safeErrorMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * 馬場取得 Worker の応答。失敗時は例外。
 * ingressColo は本体の request.cf.colo。取得先の拠点ではない。
 * placement は応答の cf-placement（remote-NRT など）。プラットフォームが付けないときは null。
 */
export async function fetchBabaBundle(
  fetcher: BabaFetcherBinding | undefined,
  ingressColo: string | null
): Promise<BabaBundle> {
  if (!fetcher) throw new Error("BABA_FETCHER binding is missing");
  const headers = new Headers();
  const ingress = normalizeAirportCode(ingressColo);
  if (ingress) headers.set(INGRESS_COLO_HEADER, ingress);
  const res = await fetcher.fetch(new Request(BABA_FETCHER_URL, { method: "GET", headers }));
  logPlacement(res.status, safePlacement(res.headers.get("cf-placement")));
  if (!res.ok) {
    let message = `baba fetcher failed: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      const error = safeErrorMessage(body?.error);
      if (error) message = error;
    } catch {
      // 本文が JSON でなくてもステータスだけで失敗にする
    }
    throw new Error(message);
  }
  const body = (await res.json()) as { venues?: unknown; course?: unknown };
  const venues = Array.isArray(body.venues) ? (body.venues as VenueBaba[]) : [];
  const courseRecord =
    body.course && typeof body.course === "object" ? (body.course as Record<string, CourseInfo>) : {};
  return { venues, courseByVenue: new Map(Object.entries(courseRecord)) };
}
