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

export interface ScheduleItem {
  venueCode: string; // "01":札幌, "02":函館, "03":福島, "04":新潟, "05":東京, "06":中山, "07":中京, "08":京都, "09":阪神, "10":小倉
  year: number;
  kai: number;       // 回次
  nichi: number;     // 日次
}

// ---------------------------------------------------------
// 2026年9月12日以降〜年末までの全JRA開催スケジュール
// ---------------------------------------------------------
export const SCHEDULE_2026: Record<string, ScheduleItem[]> = {
  // === 9月 ===
  "2026-09-12": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 3 }, // 4回中山3日
    { venueCode: "07", year: 2026, kai: 3, nichi: 3 }  // 3回中京3日
  ],
  "2026-09-13": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 4 }, // 4回中山4日
    { venueCode: "07", year: 2026, kai: 3, nichi: 4 }  // 3回中京4日
  ],
  "2026-09-19": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 5 }, // 4回中山5日
    { venueCode: "07", year: 2026, kai: 3, nichi: 5 }  // 3回中京5日
  ],
  "2026-09-20": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 6 }, // 4回中山6日
    { venueCode: "07", year: 2026, kai: 3, nichi: 6 }  // 3回中京6日
  ],
  "2026-09-21": [ // 祝日・月曜開催（敬老の日）
    { venueCode: "06", year: 2026, kai: 4, nichi: 7 }, // 4回中山7日
    { venueCode: "07", year: 2026, kai: 3, nichi: 7 }  // 3回中京7日
  ],
  "2026-09-26": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 8 }, // 4回中山8日
    { venueCode: "07", year: 2026, kai: 3, nichi: 8 }  // 3回中京8日
  ],
  "2026-09-27": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 9 }, // 4回中山9日 (スプリンターズS)
    { venueCode: "07", year: 2026, kai: 3, nichi: 9 }  // 3回中京9日
  ],

  // === 10月 ===
  "2026-10-03": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 1 }, // 4回東京1日
    { venueCode: "08", year: 2026, kai: 4, nichi: 1 }  // 4回京都1日
  ],
  "2026-10-04": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 2 }, // 4回東京2日
    { venueCode: "08", year: 2026, kai: 4, nichi: 2 }  // 4回京都2日
  ],
  "2026-10-10": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 3 }, // 4回東京3日
    { venueCode: "08", year: 2026, kai: 4, nichi: 3 }, // 4回京都3日
    { venueCode: "04", year: 2026, kai: 4, nichi: 1 }  // 4回新潟1日
  ],
  "2026-10-11": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 4 }, // 4回東京4日
    { venueCode: "08", year: 2026, kai: 4, nichi: 4 }, // 4回京都4日
    { venueCode: "04", year: 2026, kai: 4, nichi: 2 }  // 4回新潟2日
  ],
  "2026-10-12": [ // 祝日・月曜開催（スポーツの日）
    { venueCode: "05", year: 2026, kai: 4, nichi: 5 }, // 4回東京5日
    { venueCode: "08", year: 2026, kai: 4, nichi: 5 }  // 4回京都5日
  ],
  "2026-10-17": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 6 }, // 4回東京6日
    { venueCode: "08", year: 2026, kai: 4, nichi: 6 }, // 4回京都6日
    { venueCode: "04", year: 2026, kai: 4, nichi: 3 }  // 4回新潟3日
  ],
  "2026-10-18": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 7 }, // 4回東京7日
    { venueCode: "08", year: 2026, kai: 4, nichi: 7 }, // 4回京都7日 (秋華賞)
    { venueCode: "04", year: 2026, kai: 4, nichi: 4 }  // 4回新潟4日
  ],
  "2026-10-24": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 8 }, // 4回東京8日
    { venueCode: "08", year: 2026, kai: 4, nichi: 8 }, // 4回京都8日
    { venueCode: "04", year: 2026, kai: 4, nichi: 5 }  // 4回新潟5日
  ],
  "2026-10-25": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 9 }, // 4回東京9日
    { venueCode: "08", year: 2026, kai: 4, nichi: 9 }, // 4回京都9日 (菊花賞)
    { venueCode: "04", year: 2026, kai: 4, nichi: 6 }  // 4回新潟6日
  ],
  "2026-10-31": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 10 }, // 4回東京10日
    { venueCode: "08", year: 2026, kai: 4, nichi: 10 }, // 4回京都10日
    { venueCode: "04", year: 2026, kai: 4, nichi: 7 }   // 4回新潟7日
  ],

  // === 11月 ===
  "2026-11-01": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 11 }, // 4回東京11日 (天皇賞・秋)
    { venueCode: "08", year: 2026, kai: 4, nichi: 11 }, // 4回京都11日
    { venueCode: "04", year: 2026, kai: 4, nichi: 8 }   // 4回新潟8日
  ],
  "2026-11-07": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 1 }, // 5回東京1日
    { venueCode: "08", year: 2026, kai: 5, nichi: 1 }, // 5回京都1日
    { venueCode: "03", year: 2026, kai: 3, nichi: 1 }  // 3回福島1日
  ],
  "2026-11-08": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 2 }, // 5回東京2日
    { venueCode: "08", year: 2026, kai: 5, nichi: 2 }, // 5回京都2日
    { venueCode: "03", year: 2026, kai: 3, nichi: 2 }  // 3回福島2日
  ],
  "2026-11-14": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 3 }, // 5回東京3日
    { venueCode: "08", year: 2026, kai: 5, nichi: 3 }, // 5回京都3日
    { venueCode: "03", year: 2026, kai: 3, nichi: 3 }  // 3回福島3日
  ],
  "2026-11-15": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 4 }, // 5回東京4日
    { venueCode: "08", year: 2026, kai: 5, nichi: 4 }, // 5回京都4日 (エリザベス女王杯)
    { venueCode: "03", year: 2026, kai: 3, nichi: 4 }  // 3回福島4日
  ],
  "2026-11-21": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 5 }, // 5回東京5日
    { venueCode: "08", year: 2026, kai: 5, nichi: 5 }, // 5回京都5日
    { venueCode: "03", year: 2026, kai: 3, nichi: 5 }  // 3回福島5日
  ],
  "2026-11-22": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 6 }, // 5回東京6日
    { venueCode: "08", year: 2026, kai: 5, nichi: 6 }, // 5回京都6日 (マイルCS)
    { venueCode: "03", year: 2026, kai: 3, nichi: 6 }  // 3回福島6日
  ],
  "2026-11-23": [ // 祝日・月曜振替
    { venueCode: "05", year: 2026, kai: 5, nichi: 7 }, // 5回東京7日
    { venueCode: "08", year: 2026, kai: 5, nichi: 7 }  // 5回京都7日
  ],
  "2026-11-28": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 8 }, // 5回東京8日
    { venueCode: "08", year: 2026, kai: 5, nichi: 8 }  // 5回京都8日
  ],
  "2026-11-29": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 9 }, // 5回東京9日 (ジャパンC)
    { venueCode: "08", year: 2026, kai: 5, nichi: 9 }  // 5回京都9日
  ],

  // === 12月 ===
  "2026-12-05": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 1 }, // 5回中山1日
    { venueCode: "09", year: 2026, kai: 5, nichi: 1 }, // 5回阪神1日
    { venueCode: "07", year: 2026, kai: 4, nichi: 1 }  // 4回中京1日
  ],
  "2026-12-06": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 2 }, // 5回中山2日
    { venueCode: "09", year: 2026, kai: 5, nichi: 2 }, // 5回阪神2日 (チャンピオンズCは中京)
    { venueCode: "07", year: 2026, kai: 4, nichi: 2 }  // 4回中京2日 (チャンピオンズC)
  ],
  "2026-12-12": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 3 }, // 5回中山3日
    { venueCode: "09", year: 2026, kai: 5, nichi: 3 }, // 5回阪神3日
    { venueCode: "07", year: 2026, kai: 4, nichi: 3 }  // 4回中京3日
  ],
  "2026-12-13": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 4 }, // 5回中山4日
    { venueCode: "09", year: 2026, kai: 5, nichi: 4 }, // 5回阪神4日 (阪神JF)
    { venueCode: "07", year: 2026, kai: 4, nichi: 4 }  // 4回中京4日
  ],
  "2026-12-19": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 5 }, // 5回中山5日
    { venueCode: "09", year: 2026, kai: 5, nichi: 5 }, // 5回阪神5日
    { venueCode: "07", year: 2026, kai: 4, nichi: 5 }  // 4回中京5日
  ],
  "2026-12-20": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 6 }, // 5回中山6日
    { venueCode: "09", year: 2026, kai: 5, nichi: 6 }, // 5回阪神6日 (朝日杯FS)
    { venueCode: "07", year: 2026, kai: 4, nichi: 6 }  // 4回中京6日
  ],
  "2026-12-26": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 7 }, // 5回中山7日 (中山大障害)
    { venueCode: "09", year: 2026, kai: 5, nichi: 7 }  // 5回阪神7日
  ],
  "2026-12-27": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 8 }, // 5回中山8日 (有馬記念)
    { venueCode: "09", year: 2026, kai: 5, nichi: 8 }  // 5回阪神8日
  ],
  "2026-12-28": [ // 年末最終開催日（月曜）
    { venueCode: "06", year: 2026, kai: 5, nichi: 9 }, // 5回中山9日 (ホープフルS)
    { venueCode: "09", year: 2026, kai: 5, nichi: 9 }  // 5回阪神9日
  ]
};

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

    const schedules = SCHEDULE_2026[targetDateKey];
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
    const schedules = SCHEDULE_2026[targetDateKey];

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