/**
 * Dify Workflow API（streaming）の呼び出しと結果判定。
 *
 * - 成功: workflow_finished かつ status=succeeded
 * - タイムアウト系 error / 接続切断: ack（リトライしない）
 * - それ以外の失敗: リトライ
 */

export const DIFY_QUEUE_MAX_RETRIES = 3; // wrangler.jsonc の max_retries と揃える

export type DifyRunOutcome =
  | { kind: "success"; workflowRunId?: string; detail: string }
  | { kind: "timeout"; detail: string }
  | { kind: "disconnect"; detail: string }
  | { kind: "retryable"; detail: string };

export interface DifyRunInput {
  apiUrl: string;
  apiKey: string;
  raceUrl: string;
  remarks: string;
  query: string;
  user?: string;
}

/** タイムアウト扱いにする error イベントか（文言は揺れうるので部分一致） */
export function isTimeoutErrorPayload(payload: unknown): boolean {
  const obj = asRecord(payload);
  if (!obj) return false;
  const message = collectErrorText(obj);
  if (/timed?\s*out|timeout/i.test(message)) return true;
  return false;
}

/** workflow_finished の成功判定 */
export function isWorkflowFinishedSuccess(payload: unknown): boolean {
  const obj = asRecord(payload);
  if (!obj) return false;
  const data = asRecord(obj.data) ?? obj;
  const status = typeof data.status === "string" ? data.status : "";
  return status === "succeeded";
}

export function workflowFinishedFailureDetail(payload: unknown): string {
  const obj = asRecord(payload);
  const data = asRecord(obj?.data) ?? obj ?? {};
  const status = typeof data.status === "string" ? data.status : "unknown";
  const error = typeof data.error === "string" ? data.error : "";
  return error ? `workflow_finished status=${status}: ${error}` : `workflow_finished status=${status}`;
}

export function formatErrorEventDetail(payload: unknown): string {
  const obj = asRecord(payload);
  if (!obj) return "error event";
  const status = obj.status != null ? String(obj.status) : "";
  const code = typeof obj.code === "string" ? obj.code : "";
  const message = collectErrorText(obj);
  return [status && `status=${status}`, code && `code=${code}`, message]
    .filter(Boolean)
    .join(" ");
}

/**
 * SSE テキストをイベント配列に分解（テスト用にも公開）。
 * `event:` 行と data JSON 内の `event` の両方を扱う。
 */
export function parseSseBlocks(text: string): Array<{ eventType: string | null; data: unknown; rawData: string }> {
  const blocks = text.replace(/\r\n/g, "\n").split("\n\n");
  const out: Array<{ eventType: string | null; data: unknown; rawData: string }> = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    let eventType: string | null = null;
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice("event:".length).trim() || null;
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }
    if (dataLines.length === 0) continue; // ping など
    const rawData = dataLines.join("\n");
    let data: unknown = rawData;
    try {
      data = JSON.parse(rawData);
    } catch {
      // 非 JSON はそのまま
    }
    const dataObj = asRecord(data);
    if (!eventType && dataObj && typeof dataObj.event === "string") {
      eventType = dataObj.event;
    }
    out.push({ eventType, data, rawData });
  }
  return out;
}

/**
 * 1 件分の SSE ストリームを読んで結果を決める。
 * 切断（本文途中終了・読取例外）は disconnect。
 */
export async function consumeDifySseStream(
  body: ReadableStream<Uint8Array> | null
): Promise<DifyRunOutcome> {
  if (!body) {
    return { kind: "disconnect", detail: "empty response body" };
  }

  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let workflowRunId: string | undefined;

  const applyEvents = (chunk: string): DifyRunOutcome | null => {
    for (const ev of parseSseBlocks(chunk)) {
      const id = extractWorkflowRunId(ev.data);
      if (id) workflowRunId = id;
      const outcome = classifySseEvent(ev.eventType, ev.data);
      if (outcome.kind === "ignore") continue;
      if (outcome.kind === "success") {
        return { ...outcome, workflowRunId: workflowRunId ?? outcome.workflowRunId };
      }
      return outcome;
    }
    return null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      if (parts.length > 0) {
        const decided = applyEvents(`${parts.join("\n\n")}\n\n`);
        if (decided) return decided;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const decided = applyEvents(`${buffer}\n\n`);
      if (decided) return decided;
    }
  } catch (error) {
    return {
      kind: "disconnect",
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  return {
    kind: "disconnect",
    detail: workflowRunId
      ? `stream ended without workflow_finished (workflow_run_id=${workflowRunId})`
      : "stream ended without workflow_finished",
  };
}

type Classified = DifyRunOutcome | { kind: "ignore" };

export function classifySseEvent(eventType: string | null, data: unknown): Classified {
  const type = (eventType ?? (asRecord(data)?.event as string | undefined) ?? "").toLowerCase();

  if (!type || type === "ping") return { kind: "ignore" };

  if (type === "error") {
    const detail = formatErrorEventDetail(data);
    if (isTimeoutErrorPayload(data)) {
      return { kind: "timeout", detail };
    }
    return { kind: "retryable", detail: `error event: ${detail}` };
  }

  if (type === "workflow_finished") {
    if (isWorkflowFinishedSuccess(data)) {
      const id = extractWorkflowRunId(data);
      return { kind: "success", workflowRunId: id, detail: "workflow_finished succeeded" };
    }
    return { kind: "retryable", detail: workflowFinishedFailureDetail(data) };
  }

  return { kind: "ignore" };
}

/** HTTP ステータスから初期判定（ストリーム開始前） */
export function classifyHttpFailure(status: number, bodyText: string): DifyRunOutcome {
  // エッジ／ゲートウェイのタイムアウトっぽいもの
  if (status === 408 || status === 504 || status === 524) {
    return { kind: "timeout", detail: `HTTP ${status}: ${trimBody(bodyText)}` };
  }
  return { kind: "retryable", detail: `HTTP ${status}: ${trimBody(bodyText)}` };
}

export async function runDifyWorkflowStreaming(input: DifyRunInput): Promise<DifyRunOutcome> {
  let res: Response;
  try {
    res = await fetch(input.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          url: input.raceUrl,
          remarks: input.remarks,
        },
        query: input.query,
        response_mode: "streaming",
        user: input.user ?? "cloudflare-queue-worker",
      }),
    });
  } catch (error) {
    return {
      kind: "disconnect",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return classifyHttpFailure(res.status, errText);
  }

  return consumeDifySseStream(res.body);
}

/** リトライしてよいか。success / timeout / disconnect は不可 */
export function shouldRetryOutcome(outcome: DifyRunOutcome): boolean {
  return outcome.kind === "retryable";
}

/** attempts は 1 始まり。max_retries=3 なら 4 回目が最終 */
export function isFinalQueueAttempt(attempts: number, maxRetries = DIFY_QUEUE_MAX_RETRIES): boolean {
  return attempts > maxRetries;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function collectErrorText(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof obj.message === "string") parts.push(obj.message);
  if (typeof obj.error === "string") parts.push(obj.error);
  const data = asRecord(obj.data);
  if (data) {
    if (typeof data.message === "string") parts.push(data.message);
    if (typeof data.error === "string") parts.push(data.error);
  }
  return parts.join(" ");
}

function extractWorkflowRunId(payload: unknown): string | undefined {
  const obj = asRecord(payload);
  if (!obj) return undefined;
  if (typeof obj.workflow_run_id === "string") return obj.workflow_run_id;
  const data = asRecord(obj.data);
  if (data && typeof data.id === "string") return data.id;
  return undefined;
}

function trimBody(text: string, max = 300): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
