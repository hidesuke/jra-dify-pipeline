// Dify へ同時に投げるレース数 N。
//
// Cloudflare Queues の max_concurrency / max_batch_size はデプロイしないと変わらない。
// N 自体は CHECKSUM_SEED のキー dify_concurrency に置き、各バッチの先頭で読む。
// 未設定・壊れた値・読み取り失敗は既定 3。バッチを失敗させない（失敗は max_retries を消費する）。
//
// 上限は wrangler.jsonc の consumers.max_batch_size と揃える。
// consumer の max_concurrency は 1。バッチは同時に 1 本だけで、その中の先頭 N 件だけを並列に処理する。
// 余ったメッセージを retry() で戻すと attempts が増え、Dify を呼ぶ前にリトライ上限へ届く。
// そのため余りは同じキューへ新しいメッセージとして戻し、元は ack する。試行回数は priorAttempts に載せる。

export const DIFY_CONCURRENCY_KEY = "dify_concurrency";
export const DIFY_CONCURRENCY_DEFAULT = 3;
export const DIFY_CONCURRENCY_MIN = 1;
export const DIFY_CONCURRENCY_MAX = 10;

/** 壊れた priorAttempts を無視する上限。正当な値は 1〜（max_retries+1）に収まる。 */
const MAX_CARRIED_ATTEMPTS = 100;

export interface ConcurrencyKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface ConcurrencySetting {
  concurrency: number;
  source: "kv" | "default";
  min: number;
  max: number;
  defaultConcurrency: number;
  updatedAt: string | null;
}

interface StoredConcurrency {
  concurrency: number;
  updatedAt?: string;
}

export function concurrencyBounds(): { min: number; max: number; defaultConcurrency: number } {
  return {
    min: DIFY_CONCURRENCY_MIN,
    max: DIFY_CONCURRENCY_MAX,
    defaultConcurrency: DIFY_CONCURRENCY_DEFAULT,
  };
}

export function defaultConcurrencySetting(): ConcurrencySetting {
  return {
    concurrency: DIFY_CONCURRENCY_DEFAULT,
    source: "default",
    ...concurrencyBounds(),
    updatedAt: null,
  };
}

/** 1〜上限の整数だけを受け付ける。文字列の "3" と数値の 3 は可。小数・空・範囲外は不可。 */
export function parseConcurrencyInput(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    if (value < DIFY_CONCURRENCY_MIN || value > DIFY_CONCURRENCY_MAX) return null;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < DIFY_CONCURRENCY_MIN || parsed > DIFY_CONCURRENCY_MAX) {
      return null;
    }
    return parsed;
  }
  return null;
}

/**
 * 失敗判定に使う試行回数。
 * 延期で作り直したメッセージはキューの attempts が 1 に戻るので、body の priorAttempts を足す。
 * priorAttempts が無いときはキューの attempts そのもの（従来どおり）。
 */
export function effectiveAttempts(queueAttempts: number, priorAttempts: number | undefined): number {
  const current = Number.isInteger(queueAttempts) && queueAttempts >= 1 ? queueAttempts : 1;
  const carried =
    typeof priorAttempts === "number" &&
    Number.isInteger(priorAttempts) &&
    priorAttempts >= 1 &&
    priorAttempts <= MAX_CARRIED_ATTEMPTS
      ? priorAttempts
      : 1;
  return carried + current - 1;
}

/** キューへ戻す body。試行回数は増やさない。 */
export function withCarriedAttempts<T extends { priorAttempts?: number }>(
  body: T,
  queueAttempts: number
): T {
  return {
    ...body,
    priorAttempts: effectiveAttempts(queueAttempts, body.priorAttempts),
  };
}

/**
 * バッチの先頭 N 件を処理し、残りは戻す。
 * N が 1 未満や非整数のときは既定値を使う。0 件処理のまま戻すと延々と再投入になる。
 */
export function splitForConcurrency<T>(
  messages: readonly T[],
  concurrency: number
): { active: T[]; deferred: T[] } {
  if (messages.length === 0) return { active: [], deferred: [] };
  const requested =
    Number.isInteger(concurrency) && concurrency >= DIFY_CONCURRENCY_MIN
      ? concurrency
      : DIFY_CONCURRENCY_DEFAULT;
  const take = Math.min(requested, messages.length);
  return {
    active: messages.slice(0, take),
    deferred: messages.slice(take),
  };
}

export async function readConcurrency(kv: ConcurrencyKv | undefined): Promise<ConcurrencySetting> {
  const fallback = defaultConcurrencySetting();
  if (!kv) return fallback;
  try {
    const raw = await kv.get(DIFY_CONCURRENCY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StoredConcurrency;
    const concurrency = parseConcurrencyInput(parsed?.concurrency);
    if (concurrency == null) {
      console.error("Invalid dify_concurrency value; using default");
      return fallback;
    }
    return {
      concurrency,
      source: "kv",
      ...concurrencyBounds(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    console.error("Failed to read dify_concurrency; using default", error);
    return fallback;
  }
}

export async function writeConcurrency(
  kv: ConcurrencyKv,
  concurrency: number,
  now = new Date()
): Promise<ConcurrencySetting> {
  const stored: StoredConcurrency = {
    concurrency,
    updatedAt: now.toISOString(),
  };
  await kv.put(DIFY_CONCURRENCY_KEY, JSON.stringify(stored));
  return {
    concurrency,
    source: "kv",
    ...concurrencyBounds(),
    updatedAt: stored.updatedAt ?? null,
  };
}

export function concurrencyResponseBody(setting: ConcurrencySetting): {
  concurrency: number;
  source: "kv" | "default";
  min: number;
  max: number;
  default: number;
  updatedAt: string | null;
} {
  return {
    concurrency: setting.concurrency,
    source: setting.source,
    min: setting.min,
    max: setting.max,
    default: setting.defaultConcurrency,
    updatedAt: setting.updatedAt,
  };
}

function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * GET は現在値。POST / PUT は変更。
 * 値はクエリ `concurrency`、JSON `{"concurrency":N}`、フォーム `concurrency=N`、本文が整数だけのとき。
 */
export async function concurrencyFromRequest(req: Request): Promise<unknown> {
  const fromQuery = new URL(req.url).searchParams.get("concurrency");
  if (fromQuery != null && fromQuery.trim() !== "") return fromQuery;
  const text = await req.text();
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as { concurrency?: unknown };
      return data?.concurrency;
    } catch {
      return undefined;
    }
  }
  const params = new URLSearchParams(trimmed);
  if (params.has("concurrency")) return params.get("concurrency");
  if (/^[1-9]\d*$/.test(trimmed)) return trimmed;
  return undefined;
}

export async function handleConcurrencyRequest(
  req: Request,
  kv: ConcurrencyKv | undefined
): Promise<Response> {
  const allow = "GET, POST, PUT";
  if (req.method === "GET") {
    return json(concurrencyResponseBody(await readConcurrency(kv)));
  }
  if (req.method !== "POST" && req.method !== "PUT") {
    return json({ error: "Method not allowed" }, 405, { Allow: allow });
  }

  const parsed = parseConcurrencyInput(await concurrencyFromRequest(req));
  if (parsed == null) {
    return json(
      {
        error: `concurrency は ${DIFY_CONCURRENCY_MIN} 以上 ${DIFY_CONCURRENCY_MAX} 以下の整数にしてください`,
        min: DIFY_CONCURRENCY_MIN,
        max: DIFY_CONCURRENCY_MAX,
      },
      400
    );
  }
  if (!kv) {
    return json({ error: "CHECKSUM_SEED KV が無いため同時実行数を保存できません" }, 503);
  }
  try {
    const setting = await writeConcurrency(kv, parsed);
    return json(concurrencyResponseBody(setting));
  } catch (error) {
    console.error("Failed to store dify_concurrency", error);
    return json({ error: "同時実行数を保存できませんでした" }, 502);
  }
}
