import { authorizePredict } from "./access";
import { getSchedulesForDate, type ScheduleItem } from "./schedules";
import { fetchBaba, fetchCourseInfoByVenue, selectMeasurement, formatBabaSummary } from "./baba";
import { notifyRaceUrlFailures } from "./notify";
import { verifyVenue1RUrls, type RaceUrlCheck } from "./verifyRaceUrl";
import {
  DEFAULT_PREFIX,
  compactDate,
  generateRaceUrls,
} from "./checksum";
import {
  addPendingCorrection,
  getStoredSeed,
  seedFormUrl,
  type PendingCorrection,
} from "./seedStore";
import { handleSeedRequest, type SeedEnqueueResult } from "./seedForm";

export type { ScheduleItem };
export { calculateInitialChecksum, generateRaceUrls, DEFAULT_SEED } from "./checksum";

export interface Env {
  DIFY_API_KEY: string;
  DIFY_API_URL: string;
  PREFIX_CODE?: string;
  PUBLIC_BASE_URL?: string;
  CHECKSUM_SEED?: KVNamespace;
  RACE_QUEUE: Queue<RaceMessage>;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_ALLOWED_EMAIL?: string;
  PREDICT_SECRET?: string;
  /** Cloudflare Email Service（send_email バインディング） */
  EMAIL?: import("./notify").SendEmailBinding;
  /** 通知先。Email Routing の検証済み Destination。未設定時は CF_ACCESS_ALLOWED_EMAIL */
  NOTIFY_EMAIL?: string;
  /** From（koumeinowana.info 上のアドレス） */
  NOTIFY_FROM?: string;
}

/** RaceMessage に載せる馬場サマリ（remarks へ差し込む） */
export interface BabaAttachment {
  summary: string; // remarks に入れる 1 行テキスト
  measuredAt: string; // 計測時刻（生文字列）
}

/** JST の暦日。extraDays=1 なら JST の翌日 */
export function jstDateKey(now = new Date(), extraDays = 0): string {
  const t = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  t.setUTCDate(t.getUTCDate() + extraDays);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface RaceMessage {
  targetDate: string;
  venueCode: string;
  raceNo: number;
  raceUrl: string;
  baba?: BabaAttachment;
}

type RaceRow = { venueCode: string; raceNo: number; url: string };

function prefixOf(env: Env): string {
  return env.PREFIX_CODE?.trim() || DEFAULT_PREFIX;
}

/**
 * 対象日の各場について馬場データを 1 件ずつ引く（best-effort）。
 * 取得に失敗しても投入は止めない（空 Map を返す）。
 */
async function loadBabaByVenue(
  targetDate: string,
  venueCodes: string[]
): Promise<Map<string, BabaAttachment>> {
  const map = new Map<string, BabaAttachment>();
  try {
    const [venues, courseByVenue] = await Promise.all([fetchBaba(), fetchCourseInfoByVenue()]);
    for (const code of new Set(venueCodes)) {
      const sel = selectMeasurement(venues, code, targetDate);
      if (!sel) continue;
      map.set(code, {
        summary: formatBabaSummary(sel.measurement, courseByVenue.get(code)),
        measuredAt: sel.measurement.time,
      });
    }
  } catch (error) {
    console.error("Failed to fetch baba data (continuing without it):", error);
  }
  return map;
}

async function sendRaceBatch(env: Env, messages: MessageSendRequest<RaceMessage>[]): Promise<void> {
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    await env.RACE_QUEUE.sendBatch(messages.slice(i, i + chunkSize));
  }
}

async function rowsForSchedules(
  schedules: ScheduleItem[],
  date: string,
  env: Env,
  seed: number,
  raceNo?: number
): Promise<RaceRow[]> {
  const dateCompact = compactDate(date);
  const prefix = prefixOf(env);
  return schedules.flatMap((s) =>
    generateRaceUrls(s, dateCompact, prefix, seed)
      .filter((r) => raceNo === undefined || r.raceNo === raceNo)
      .map((r) => ({
        venueCode: s.venueCode,
        raceNo: r.raceNo,
        url: r.url,
      }))
  );
}

// ---------------------------------------------------------
// Cloudflare Worker Handler
// ---------------------------------------------------------
export default {
  // 1. Cron Trigger: 翌日分のレースを Queue に送信
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const targetDateKey = jstDateKey(new Date(), 1);
    console.log(`Cron ${controller.cron} target=${targetDateKey}`);

    const schedules = getSchedulesForDate(targetDateKey);
    if (!schedules || schedules.length === 0) {
      console.log(`No race scheduled for tomorrow: ${targetDateKey}`);
      return;
    }

    const seed = await getStoredSeed(env.CHECKSUM_SEED);
    const allRows = await rowsForSchedules(schedules, targetDateKey, env, seed);

    const { rows, checks } = await filterRowsBy1RVerification(env, targetDateKey, allRows);
    logVerification(targetDateKey, checks);

    if (rows.length === 0) {
      console.log(`No races enqueued for ${targetDateKey} after 1R URL verification`);
      return;
    }

    const babaByVenue = await loadBabaByVenue(targetDateKey, rows.map((r) => r.venueCode));
    const messages: MessageSendRequest<RaceMessage>[] = rows.map((r) => ({
      body: {
        targetDate: targetDateKey,
        venueCode: r.venueCode,
        raceNo: r.raceNo,
        raceUrl: r.url,
        baba: babaByVenue.get(r.venueCode),
      },
    }));

    await sendRaceBatch(env, messages);
    console.log(`Successfully enqueued ${messages.length} races for ${targetDateKey} (seed=0x${seed.toString(16).toUpperCase().padStart(2, "0")})`);
  },

  // 2. Queue Consumer: Dify API を順次キック
  async queue(batch: MessageBatch<RaceMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const { targetDate, venueCode, raceNo, raceUrl, baba } = msg.body;
      // 馬場情報がある場合は remarks（備考欄）に追記する。
      const remarks = `${targetDate} 場:${venueCode} ${raceNo}R${baba ? ` ｜ ${baba.summary}` : ""}`;
      console.log(`Executing Dify API: ${remarks} ${raceUrl}`);

      try {
        const res = await fetch(env.DIFY_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.DIFY_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: {
              url: raceUrl,
              remarks
            },
            query: `${targetDate} 場:${venueCode} ${raceNo}R`,
            response_mode: "blocking",
            user: "cloudflare-queue-worker"
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Dify API error (${res.status}): ${errText}`);
        }

        msg.ack();
      } catch (error) {
        console.error(`Failed to process ${targetDate} ${venueCode} ${raceNo}R:`, error);
        msg.retry();
      }
    }
  },

  // 3. GET / は馬柱 URL の一覧のみ。予想は GET|POST /run（認証必須）
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/run") {
      const denied = await authorizePredict(req, env, ctx);
      if (denied) return denied;
      return enqueueRaces(req, env);
    }

    if (path === "/verify") {
      const denied = await authorizePredict(req, env, ctx);
      if (denied) return denied;
      return verifyRaces(req, env);
    }

    if (path === "/seed") {
      const denied = await authorizePredict(req, env, ctx);
      if (denied) return denied;
      return handleSeedRequest(req, env, (seed, pending) => enqueueAfterSeedUpdate(env, seed, pending));
    }

    if (path === "/baba") {
      return babaDebug(req);
    }

    if (path !== "/") {
      return new Response("Not found\n", { status: 404 });
    }

    return listRaceUrls(req, env);
  }
};

/**
 * 各場 1R を検証し、エラーページの場を除外する。
 * エラー／取得失敗はメール通知（設定時）。取得失敗の場は除外せず投入を続行する。
 * パラメータエラーの場は KV に補正待ちとして残し、メールに /seed へのリンクを付ける。
 */
async function filterRowsBy1RVerification(
  env: Env,
  date: string,
  rows: RaceRow[],
  requestUrl?: string
): Promise<{ rows: RaceRow[]; checks: RaceUrlCheck[] }> {
  const checks = await verifyVenue1RUrls(rows);
  await recordFailuresAndNotify(env, date, checks, requestUrl);
  const badVenues = new Set(
    checks.filter((c) => c.kind === "error_page").map((c) => c.venueCode)
  );
  if (badVenues.size === 0) return { rows, checks };
  return {
    rows: rows.filter((r) => !badVenues.has(r.venueCode)),
    checks,
  };
}

async function recordFailuresAndNotify(
  env: Env,
  date: string,
  checks: RaceUrlCheck[],
  requestUrl?: string
): Promise<void> {
  const errorPages = checks.filter((c) => c.kind === "error_page");
  const notifyTargets = checks.filter((c) => c.kind === "error_page" || c.kind === "fetch_failed");
  if (errorPages.length > 0) {
    await addPendingCorrection(
      env.CHECKSUM_SEED,
      date,
      errorPages.map((c) => ({
        venueCode: c.venueCode,
        url: c.url,
        reason: c.reason,
      }))
    );
  }
  if (notifyTargets.length === 0) return;
  await notifyRaceUrlFailures(env, date, notifyTargets, {
    seedFormUrl: errorPages.length > 0 ? seedFormUrl(env, requestUrl) : undefined,
  });
}

function logVerification(date: string, checks: RaceUrlCheck[]): void {
  if (checks.length === 0) {
    console.log(`1R URL verification skipped for ${date} (no 1R in selection)`);
    return;
  }
  for (const c of checks) {
    const line = `1R verify ${date} 場:${c.venueCode} ${c.kind} ${c.reason ?? ""} ${c.url}`;
    if (c.ok) console.log(line);
    else console.error(line);
  }
}

/** シード更新後、失敗していた日付・場を再生成して Queue へ入れる */
async function enqueueAfterSeedUpdate(
  env: Env,
  seed: number,
  pending: PendingCorrection[]
): Promise<SeedEnqueueResult[]> {
  const results: SeedEnqueueResult[] = [];
  for (const item of pending) {
    const schedules = getSchedulesForDate(item.date);
    const wanted = new Set(item.venues.map((v) => v.venueCode));
    const selected = (schedules ?? []).filter((s) => wanted.has(s.venueCode));
    const rows = await rowsForSchedules(selected, item.date, env, seed);
    const checks = await verifyVenue1RUrls(rows);
    logVerification(item.date, checks);
    const stillBad = new Set(
      checks.filter((c) => !c.ok).map((c) => c.venueCode)
    );
    const okRows = rows.filter((r) => !stillBad.has(r.venueCode));
    const babaByVenue = await loadBabaByVenue(item.date, okRows.map((r) => r.venueCode));
    const messages: MessageSendRequest<RaceMessage>[] = okRows.map((r) => ({
      body: {
        targetDate: item.date,
        venueCode: r.venueCode,
        raceNo: r.raceNo,
        raceUrl: r.url,
        baba: babaByVenue.get(r.venueCode),
      },
    }));
    if (messages.length > 0) await sendRaceBatch(env, messages);
    const preview = okRows
      .map((r) => {
        const baba = babaByVenue.get(r.venueCode);
        return `${r.venueCode}:${r.raceNo}R ${r.url}${baba ? ` | ${baba.summary}` : ""}`;
      })
      .join("\n");
    results.push({
      date: item.date,
      venueCodes: [...new Set(okRows.map((r) => r.venueCode))],
      enqueued: messages.length,
      stillFailed: checks
        .filter((c) => !c.ok)
        .map((c) => ({
          venueCode: c.venueCode,
          reason: c.reason ?? c.kind,
          url: c.url,
        })),
      preview,
      checks,
    });
    console.log(
      `Seed 0x${seed.toString(16).toUpperCase().padStart(2, "0")} re-enqueue ${item.date}: ${messages.length} races, stillFailed=${stillBad.size}`
    );
  }
  return results;
}

// GET /baba : 取得・パースした馬場データを JSON で返す（読み取り専用・認証なし）。
// ?date=YYYY-MM-DD を付けると、各場について選ばれる計測（対象日 or 直近参考値）も返す。
async function babaDebug(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || undefined;
  try {
    const [venues, courseByVenue] = await Promise.all([fetchBaba(), fetchCourseInfoByVenue()]);
    const course = Object.fromEntries(courseByVenue);
    const selected = date
      ? venues.map((v) => ({
          venueCode: v.venueCode,
          venueName: v.venueName,
          course: v.venueCode ? courseByVenue.get(v.venueCode) ?? null : null,
          ...(selectMeasurement(venues, v.venueCode ?? "", date) ?? { measurement: null, exact: false })
        }))
      : undefined;
    return Response.json({ fetchedAt: new Date().toISOString(), date: date ?? null, venues, course, selected });
  } catch (error) {
    return new Response(`baba fetch error: ${error}\n`, { status: 502 });
  }
}

async function resolveRaces(req: Request, env: Env): Promise<{ error: Response } | { date: string; rows: RaceRow[] }> {
  const url = new URL(req.url);
  const targetDateKey = url.searchParams.get("date") || jstDateKey();
  const venueFilter = url.searchParams.get("venue");
  const raceFilter = url.searchParams.get("race");
  const schedules = getSchedulesForDate(targetDateKey);

  if (!schedules) {
    return { error: new Response(`No schedule found for date: ${targetDateKey}`, { status: 404 }) };
  }

  const selected = venueFilter
    ? schedules.filter(s => s.venueCode === venueFilter)
    : schedules;
  if (selected.length === 0) {
    return { error: new Response(`No venue ${venueFilter} on ${targetDateKey}`, { status: 404 }) };
  }

  const raceNo = raceFilter ? Number(raceFilter) : undefined;
  if (raceFilter && (!Number.isInteger(raceNo) || raceNo! < 1 || raceNo! > 12)) {
    return { error: new Response(`Invalid race: ${raceFilter}`, { status: 400 }) };
  }

  const seed = await getStoredSeed(env.CHECKSUM_SEED);
  const rows = await rowsForSchedules(selected, targetDateKey, env, seed, raceNo);

  if (rows.length === 0) {
    return { error: new Response(`No races matched for ${targetDateKey}`, { status: 404 }) };
  }

  return { date: targetDateKey, rows };
}

async function listRaceUrls(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveRaces(req, env);
  if ("error" in resolved) return resolved.error;

  const body = `${resolved.rows.map((r) => r.url).join("\n")}\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function enqueueRaces(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveRaces(req, env);
  if ("error" in resolved) return resolved.error;

  const { rows, checks } = await filterRowsBy1RVerification(env, resolved.date, resolved.rows, req.url);
  logVerification(resolved.date, checks);

  if (rows.length === 0) {
    const detail = formatVerifyLines(checks);
    return new Response(
      `No races enqueued for ${resolved.date} (1R URL verification failed)\n${detail}\n`,
      { status: 422 }
    );
  }

  const babaByVenue = await loadBabaByVenue(resolved.date, rows.map((r) => r.venueCode));

  const messages = rows.map((r) => ({
    body: {
      targetDate: resolved.date,
      venueCode: r.venueCode,
      raceNo: r.raceNo,
      raceUrl: r.url,
      baba: babaByVenue.get(r.venueCode),
    },
  }));

  await sendRaceBatch(env, messages);
  const skipped = checks.filter((c) => c.kind === "error_page");
  const verifyBlock = checks.length
    ? `\n1R verification:\n${formatVerifyLines(checks)}\n`
    : "\n";
  const skipNote =
    skipped.length > 0
      ? `Skipped venues (error page): ${skipped.map((c) => c.venueCode).join(",")}\n`
      : "";
  const preview = rows
    .map((r) => {
      const baba = babaByVenue.get(r.venueCode);
      return `${r.venueCode}:${r.raceNo}R ${r.url}${baba ? ` | ${baba.summary}` : ""}`;
    })
    .join("\n");
  return new Response(
    `Enqueued ${messages.length} races for ${resolved.date}\n${skipNote}${verifyBlock}${preview}\n`,
    { status: 200 }
  );
}

/** GET|POST /verify : 各場 1R の URL 検証のみ（キュー投入なし・認証必須） */
async function verifyRaces(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveRaces(req, env);
  if ("error" in resolved) return resolved.error;

  const checks = await verifyVenue1RUrls(resolved.rows);
  logVerification(resolved.date, checks);

  const errorPages = checks.filter((c) => c.kind === "error_page");
  if (errorPages.length > 0) {
    await addPendingCorrection(
      env.CHECKSUM_SEED,
      resolved.date,
      errorPages.map((c) => ({
        venueCode: c.venueCode,
        url: c.url,
        reason: c.reason,
      }))
    );
  }

  const notify = new URL(req.url).searchParams.get("notify") === "1";
  if (notify) {
    const failures = checks.filter((c) => !c.ok);
    if (failures.length > 0) {
      await notifyRaceUrlFailures(env, resolved.date, failures, {
        seedFormUrl: errorPages.length > 0 ? seedFormUrl(env, req.url) : undefined,
      });
    }
  }

  const failed = checks.some((c) => !c.ok);
  const body = `Verified ${checks.length} venue 1R URL(s) for ${resolved.date}\n${formatVerifyLines(checks)}\n`;
  return new Response(body, {
    status: failed ? 422 : 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function formatVerifyLines(checks: RaceUrlCheck[]): string {
  if (checks.length === 0) return "(no 1R in selection)";
  return checks
    .map((c) => `${c.venueCode}:1R ${c.kind} ${c.reason ?? ""} ${c.url}`)
    .join("\n");
}
