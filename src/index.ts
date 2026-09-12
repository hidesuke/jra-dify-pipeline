import { authorizePredict } from "./access";
import { getSchedulesForDate, type ScheduleItem } from "./schedules";

export type { ScheduleItem };

export interface Env {
  DIFY_API_KEY: string;
  DIFY_API_URL: string;
  PREFIX_CODE?: string;
  RACE_QUEUE: Queue<RaceMessage>;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_ALLOWED_EMAIL?: string;
  PREDICT_SECRET?: string;
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
}

// ---------------------------------------------------------
// 競馬場オフセット & URL生成ロジック
// ---------------------------------------------------------
// 1R のチェックサム。場は 0x4A 刻み。日は十進2桁を BCD（12日 → 0x12）として加算する。
// 月は提供サンプルがすべて 9 月のため未検証。
export function calculateInitialChecksum(
  venueCode: string,
  kai: number,
  nichi: number,
  dateStrCompact: string
): number {
  const venue = Number(venueCode);
  const day = Number(dateStrCompact.slice(6, 8));
  const dayBcd = ((Math.floor(day / 10) << 4) | (day % 10)) & 0xff;
  return (venue * 0x4A + kai * 0x75 + nichi * 0x95 + dayBcd * 0x9B + 0x16) % 256;
}

export function generateRaceUrls(item: ScheduleItem, dateStrCompact: string, prefix = "pw01dde01") {
  const header = `${prefix}${item.venueCode}${item.year.toString().padStart(4, "0")}${item.kai.toString().padStart(2, "0")}${item.nichi.toString().padStart(2, "0")}`;
  let currentCode = calculateInitialChecksum(item.venueCode, item.kai, item.nichi, dateStrCompact);
  const results: { raceNo: number; url: string }[] = [];

  for (let r = 1; r <= 12; r++) {
    const rStr = r.toString().padStart(2, "0");
    const hex = currentCode.toString(16).toUpperCase().padStart(2, "0");
    const url = `https://jra.jp/JRADB/accessD.html?CNAME=${header}${rStr}${dateStrCompact}/${hex}`;
    results.push({ raceNo: r, url });

    if (r < 9 || r >= 10) {
      currentCode = (currentCode - 0x4B + 256) % 256;
    } else if (r === 9) {
      currentCode = (currentCode - 0x0B + 256) % 256;
    }
  }
  return results;
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

    const dateCompact = targetDateKey.replace(/-/g, "");
    const prefix = env.PREFIX_CODE || "pw01dde01";
    const messages: MessageSendRequest<RaceMessage>[] = [];

    for (const schedule of schedules) {
      const raceList = generateRaceUrls(schedule, dateCompact, prefix);
      for (const item of raceList) {
        messages.push({
          body: {
            targetDate: targetDateKey,
            venueCode: schedule.venueCode,
            raceNo: item.raceNo,
            raceUrl: item.url
          }
        });
      }
    }

    await env.RACE_QUEUE.sendBatch(messages);
    console.log(`Successfully enqueued ${messages.length} races for ${targetDateKey}`);
  },

  // 2. Queue Consumer: Dify API を順次キック
  async queue(batch: MessageBatch<RaceMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const { targetDate, venueCode, raceNo, raceUrl } = msg.body;
      console.log(`Executing Dify API: ${targetDate} 場:${venueCode} ${raceNo}R ${raceUrl}`);

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
              remarks: `${targetDate} 場:${venueCode} ${raceNo}R`
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

    if (path !== "/") {
      return new Response("Not found\n", { status: 404 });
    }

    return listRaceUrls(req, env);
  }
};

type RaceRow = { venueCode: string; raceNo: number; url: string };

function resolveRaces(req: Request, env: Env): { error: Response } | { date: string; rows: RaceRow[] } {
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

  const dateCompact = targetDateKey.replace(/-/g, "");
  const prefix = env.PREFIX_CODE || "pw01dde01";
  const rows = selected.flatMap(s =>
    generateRaceUrls(s, dateCompact, prefix)
      .filter(r => raceNo === undefined || r.raceNo === raceNo)
      .map(r => ({
        venueCode: s.venueCode,
        raceNo: r.raceNo,
        url: r.url
      }))
  );

  if (rows.length === 0) {
    return { error: new Response(`No races matched for ${targetDateKey}`, { status: 404 }) };
  }

  return { date: targetDateKey, rows };
}

function listRaceUrls(req: Request, env: Env): Response {
  const resolved = resolveRaces(req, env);
  if ("error" in resolved) return resolved.error;

  const body = `${resolved.rows.map((r) => r.url).join("\n")}\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function enqueueRaces(req: Request, env: Env): Promise<Response> {
  const resolved = resolveRaces(req, env);
  if ("error" in resolved) return resolved.error;

  const messages = resolved.rows.map(r => ({
    body: {
      targetDate: resolved.date,
      venueCode: r.venueCode,
      raceNo: r.raceNo,
      raceUrl: r.url
    }
  }));

  await env.RACE_QUEUE.sendBatch(messages);
  const preview = resolved.rows.map(r => `${r.venueCode}:${r.raceNo}R ${r.url}`).join("\n");
  return new Response(`Enqueued ${messages.length} races for ${resolved.date}\n${preview}\n`, { status: 200 });
}