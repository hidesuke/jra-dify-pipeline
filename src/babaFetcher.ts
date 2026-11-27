// 馬場取得専用 Worker の fetch ハンドラ。
//
// placement は fetch ハンドラにだけ効く。RPC には効かない。
// 本体の HTTP と Cron は Service Binding の fetch() でここを呼ぶ。queue（Dify）は呼ばない。
//
// request.cf.colo は「リクエストが入った拠点」で、placement で運ばれたあとの実行拠点とは限らない。
// Service Binding 経由では空のこともある。外向き fetch と同じ拠点を知るため、JRA の前に
// cdn-cgi/trace を 1 回だけ取る。trace の失敗では JRA 取得を止めない。trace 本文（IP を含む）はログに出さない。

import {
  INGRESS_COLO_HEADER,
  fetchBaba,
  fetchCourseInfoByVenue,
  normalizeAirportCode,
  requestColo,
  type BabaColoInfo,
  type CourseInfo,
  type FetchLike,
  type VenueBaba,
} from "./baba.ts";

export const BABA_FETCH_OK_EVENT = "baba_fetch_ok";
export const TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace";

const TRACE_TIMEOUT_MS = 2000;
const TRACE_BODY_LIMIT = 4096;

export function parseTraceBody(text: string): { egressColo: string | null; loc: string | null } {
  let egressColo: string | null = null;
  let loc: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1).trim();
    if (key === "colo") egressColo = normalizeAirportCode(value);
    if (key === "loc" && /^[A-Za-z]{2}$/.test(value)) loc = value.toUpperCase();
  }
  return { egressColo, loc };
}

/** この Worker の外向き fetch が出た拠点。失敗しても JRA 取得は続ける。 */
export async function readEgressLocation(
  fetchImpl: FetchLike
): Promise<{ egressColo: string | null; loc: string | null }> {
  try {
    const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(TRACE_TIMEOUT_MS)
      : undefined;
    const res = await fetchImpl(TRACE_URL, { cache: "no-store", signal });
    if (!res.ok) return { egressColo: null, loc: null };
    const text = await res.text();
    if (text.length > TRACE_BODY_LIMIT) return { egressColo: null, loc: null };
    return parseTraceBody(text);
  } catch {
    return { egressColo: null, loc: null };
  }
}

function logBabaFetchOk(info: BabaColoInfo, venues: number, courses: number): void {
  try {
    console.log(
      JSON.stringify({
        event: BABA_FETCH_OK_EVENT,
        ...info,
        venues,
        courses,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {
    // ログ出力の失敗で取得結果は変えない
  }
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!message || message.length > 200 || /[\r\n]/.test(message)) return "baba fetch failed";
  return message;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * cushion / moist / index を取り、パース済み JSON を返す。
 * クッションか含水率が失敗したら 502。インデックスページの失敗は従来どおり欠落のまま 200。
 */
export async function handleBabaFetch(
  req: { method?: string; cf?: unknown; headers: Headers },
  fetchImpl: FetchLike = fetch
): Promise<Response> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed\n", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const requestColoValue = requestColo(req);
  const ingressColo = normalizeAirportCode(req.headers.get(INGRESS_COLO_HEADER));
  const { egressColo, loc } = await readEgressLocation(fetchImpl);
  const coloInfo: BabaColoInfo = {
    colo: egressColo ?? requestColoValue,
    requestColo: requestColoValue,
    egressColo,
    loc,
    ingressColo,
  };

  try {
    const [venues, courseByVenue] = await Promise.all([
      fetchBaba(fetchImpl, coloInfo),
      fetchCourseInfoByVenue(fetchImpl, coloInfo),
    ]);
    logBabaFetchOk(coloInfo, venues.length, courseByVenue.size);
    const payload: { venues: VenueBaba[]; course: Record<string, CourseInfo> } = {
      venues,
      course: Object.fromEntries(courseByVenue),
    };
    if (method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return jsonResponse(payload, 200);
  } catch (error) {
    return jsonResponse({ error: errorText(error) }, 502);
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    return handleBabaFetch(req, fetch);
  },
};
