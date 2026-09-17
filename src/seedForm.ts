import { getSchedulesForDate } from "./schedules";
import type { RaceUrlCheck } from "./verifyRaceUrl";
import { verifyRaceUrl } from "./verifyRaceUrl";
import {
  DEFAULT_PREFIX,
  DEFAULT_SEED,
  validateSubmittedRaceUrl,
} from "./checksum";
import {
  getPendingCorrections,
  getStoredSeedRecord,
  saveSeed,
  setPendingCorrections,
  type PendingCorrection,
  type SeedKv,
} from "./seedStore";

export interface SeedFormEnv {
  CHECKSUM_SEED?: SeedKv;
  PREFIX_CODE?: string;
}

export interface SeedEnqueueResult {
  date: string;
  venueCodes: string[];
  enqueued: number;
  stillFailed: { venueCode: string; reason: string; url: string }[];
  preview: string;
  checks: RaceUrlCheck[];
}

export type EnqueueAfterSeed = (
  seed: number,
  pending: PendingCorrection[]
) => Promise<SeedEnqueueResult[]>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage(title: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; max-width: 44rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.25rem; }
    label { display: block; font-weight: 600; margin-top: 1rem; }
    input[type=url] { width: 100%; box-sizing: border-box; padding: 0.5rem; margin-top: 0.35rem; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; }
    .muted { color: #666; }
    .error { color: #b00020; }
    .ok { color: #0b6b2c; }
    code, pre { word-break: break-all; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
${body}
</body>
</html>
`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function pendingListHtml(pending: PendingCorrection[]): string {
  if (pending.length === 0) {
    return `<p class="muted">補正待ちの 1R 失敗はありません。シードは次に 1R がエラーページになるまで保持されます。</p>`;
  }
  const items = pending
    .map((p) => {
      const venues = p.venues
        .map(
          (v) =>
            `<li>場 ${escapeHtml(v.venueCode)}（生成 URL: <code>${escapeHtml(v.url)}</code>${
              v.reason ? ` / ${escapeHtml(v.reason)}` : ""
            }）</li>`
        )
        .join("");
      return `<li><strong>${escapeHtml(p.date)}</strong><ul>${venues}</ul></li>`;
    })
    .join("");
  return `<p>次の失敗について、いずれか 1 場の正しい 1R URL を貼ってください。シードは全場共通です。</p><ul>${items}</ul>`;
}

function formHtml(params: {
  pending: PendingCorrection[];
  seedHex: string;
  error?: string;
  submittedUrl?: string;
}): string {
  const { pending, seedHex, error, submittedUrl } = params;
  const errorBlock = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const disabled = pending.length === 0 ? " disabled" : "";
  const value = submittedUrl ? ` value="${escapeHtml(submittedUrl)}"` : "";
  return `
  <h1>チェックサムシードの補正</h1>
  <p class="muted">現在のシード: <code>0x${escapeHtml(seedHex)}</code></p>
  ${pendingListHtml(pending)}
  ${errorBlock}
  <form method="post" action="/seed">
    <label for="url">正しい 1R URL</label>
    <input id="url" name="url" type="url" required placeholder="https://jra.jp/JRADB/accessD.html?CNAME=..."${value}${disabled}>
    <button type="submit"${disabled}>シードを更新してキューに投入</button>
  </form>
`;
}

export async function handleSeedRequest(
  req: Request,
  env: SeedFormEnv,
  enqueue: EnqueueAfterSeed
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed\n", { status: 405, headers: { Allow: "GET, POST" } });
  }

  const pending = await getPendingCorrections(env.CHECKSUM_SEED);
  const stored = await getStoredSeedRecord(env.CHECKSUM_SEED);
  const seedHex = (stored?.seed ?? DEFAULT_SEED).toString(16).toUpperCase().padStart(2, "0");

  if (req.method === "GET") {
    return htmlPage("チェックサムシードの補正", formHtml({ pending, seedHex }));
  }

  const form = await req.formData();
  const rawUrl = String(form.get("url") ?? "");
  const prefix = env.PREFIX_CODE?.trim() || DEFAULT_PREFIX;
  const validated = validateSubmittedRaceUrl({
    rawUrl,
    pending,
    expectedPrefix: prefix,
    getSchedule: (date, venueCode) =>
      getSchedulesForDate(date)?.find((s) => s.venueCode === venueCode),
  });

  if (!validated.ok) {
    return htmlPage(
      "チェックサムシードの補正",
      formHtml({ pending, seedHex, error: validated.error, submittedUrl: rawUrl }),
      400
    );
  }

  const check = await verifyRaceUrl({
    venueCode: validated.parsed.venueCode,
    raceNo: validated.parsed.raceNo,
    url: validated.parsed.url,
  });
  if (!check.ok) {
    return htmlPage(
      "チェックサムシードの補正",
      formHtml({
        pending,
        seedHex,
        error: `入力 URL は出馬表として検証できませんでした（${check.kind}: ${check.reason ?? "不明"}）`,
        submittedUrl: rawUrl,
      }),
      400
    );
  }

  await saveSeed(env.CHECKSUM_SEED, {
    seed: validated.seed,
    sourceUrl: validated.parsed.url,
    date: validated.parsed.date,
    venueCode: validated.parsed.venueCode,
  });

  const results = await enqueue(validated.seed, pending);
  const remaining: PendingCorrection[] = results
    .filter((r) => r.stillFailed.length > 0)
    .map((r) => ({
      date: r.date,
      createdAt: new Date().toISOString(),
      venues: r.stillFailed,
    }));
  await setPendingCorrections(env.CHECKSUM_SEED, remaining);

  const newHex = validated.seed.toString(16).toUpperCase().padStart(2, "0");
  const blocks = results
    .map((r) => {
      const failed =
        r.stillFailed.length > 0
          ? `<p class="error">未投入: ${r.stillFailed
              .map((f) => `${escapeHtml(f.venueCode)} (${escapeHtml(f.reason)})`)
              .join("、")}</p>`
          : "";
      return `<h2>${escapeHtml(r.date)}</h2>
        <p class="ok">${r.enqueued} レースをキューに投入しました（場: ${escapeHtml(r.venueCodes.join(","))}）</p>
        ${failed}
        <pre>${escapeHtml(r.preview || "(なし)")}</pre>`;
    })
    .join("");

  return htmlPage(
    "シードを更新しました",
    `
  <h1>シードを更新しました</h1>
  <p>新しいシード: <code>0x${escapeHtml(newHex)}</code>（次の 1R エラーまで保持します）</p>
  ${blocks || "<p>投入対象はありませんでした。</p>"}
  <p><a href="/seed">補正ページに戻る</a></p>
`
  );
}
