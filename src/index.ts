import { getSchedulesForDate, type ScheduleItem } from "./schedules";

export type { ScheduleItem };

export interface Env {
  DIFY_API_KEY: string;
  DIFY_API_URL: string;
  PREFIX_CODE?: string;
  RACE_QUEUE: Queue<RaceMessage>;
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
const VENUE_OFFSETS: Record<string, number> = {
  "01": 0xF8, // 札幌
  "02": 0x43, // 函館
  "03": 0x8E, // 福島
  "04": 0xD9, // 新潟
  "05": 0x24, // 東京
  "06": 0x6F, // 中山
  "07": 0xBA, // 中京
  "08": 0x05, // 京都
  "09": 0x50, // 阪神
  "10": 0x9B  // 小倉
};

export function calculateInitialChecksum(venueCode: string, kai: number, nichi: number): number {
  const base = VENUE_OFFSETS[venueCode] ?? 0x6F;
  return (base + (nichi - 1) * 0x30 + (kai - 1) * 0x1B) % 256;
}

export function generateRaceUrls(item: ScheduleItem, dateStrCompact: string, prefix = "pw01dde01") {
  const header = `${prefix}${item.venueCode}${item.year.toString().padStart(4, "0")}${item.kai.toString().padStart(2, "0")}${item.nichi.toString().padStart(2, "0")}`;
  let currentCode = calculateInitialChecksum(item.venueCode, item.kai, item.nichi);
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
    const now = new Date();
    // UTCからJST(+9h)へ変換し、翌日(+24h)を指定 -> 合計 +33h
    const targetTime = new Date(now.getTime() + 33 * 60 * 60 * 1000);
    const yyyy = targetTime.getUTCFullYear();
    const mm = String(targetTime.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(targetTime.getUTCDate()).padStart(2, "0");
    const targetDateKey = `${yyyy}-${mm}-${dd}`;

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
      console.log(`Executing Dify API: ${targetDate} 場:${venueCode} ${raceNo}R`);

      try {
        const res = await fetch(env.DIFY_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.DIFY_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: {
              race_url: raceUrl,
              target_date: targetDate,
              venue_code: venueCode,
              race_number: raceNo
            },
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

  // 3. 手動テスト用エンドポイント（例: /?date=2026-09-12）
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const targetDateKey = url.searchParams.get("date") || "2026-09-12";
    const schedules = getSchedulesForDate(targetDateKey);

    if (!schedules) {
      return new Response(`No schedule found for date: ${targetDateKey}`, { status: 404 });
    }

    const dateCompact = targetDateKey.replace(/-/g, "");
    const prefix = env.PREFIX_CODE || "pw01dde01";

    const messages = schedules.flatMap(s =>
      generateRaceUrls(s, dateCompact, prefix).map(r => ({
        body: {
          targetDate: targetDateKey,
          venueCode: s.venueCode,
          raceNo: r.raceNo,
          raceUrl: r.url
        }
      }))
    );

    await env.RACE_QUEUE.sendBatch(messages);
    return new Response(`Enqueued ${messages.length} races for ${targetDateKey} successfully.`, { status: 200 });
  }
};