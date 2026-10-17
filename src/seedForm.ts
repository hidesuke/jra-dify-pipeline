import { getSchedulesForDate, venueName } from "./schedules/index.ts";
import type { RaceUrlCheck } from "./verifyRaceUrl.ts";
import { verifyRaceUrl } from "./verifyRaceUrl.ts";
import {
  DEFAULT_PREFIX,
  remapPendingForCorrectedUrl,
  validateSubmittedRaceUrl,
} from "./checksum.ts";
import {
  formatSeedHex,
  getPendingCorrections,
  loadSeedOverview,
  saveVenueSeed,
  setPendingCorrections,
  type PendingCorrection,
  type SeedKv,
  type SeedOverview,
} from "./seedStore.ts";
import { escapeHtml, htmlPage } from "./html.ts";

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

export interface UpdatedVenueSeed {
  venueCode: string;
  year: number;
  kai: number;
  seed: number;
}

export type EnqueueAfterSeed = (
  updated: UpdatedVenueSeed,
  pending: PendingCorrection[]
) => Promise<SeedEnqueueResult[]>;

function seedStatusBlock(status: SeedOverview): string {
  const globalHex = formatSeedHex(status.globalSeed);
  const globalNote = status.globalStored ? "KV の共通シード" : "未設定のため初期値";
  const items =
    status.venues.length === 0
      ? `<li>場ごとのシードはまだありません。</li>`
      : status.venues
          .map((v) => {
            const when = v.date ? `（${escapeHtml(v.date)} の 1R から）` : "";
            return `<li>${escapeHtml(venueName(v.venueCode))}（${escapeHtml(v.venueCode)}） ${v.year}年${v.kai}回: <code>0x${formatSeedHex(v.seed)}</code>${when}</li>`;
          })
          .join("");
  return `<p class="muted">共通シード（場ごとの値がないときのフォールバック）: <code>0x${escapeHtml(globalHex)}</code>（${escapeHtml(globalNote)}）</p>
  <ul>${items}</ul>`;
}

function pendingListHtml(pending: PendingCorrection[]): string {
  if (pending.length === 0) {
    return `<p class="muted">補正待ちの 1R 失敗はありません。場ごとのシードは、次にその場の 1R がエラーページになるまで保持されます。</p>`;
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
  return `<p>失敗した場の正しい 1R URL を貼ってください。更新されるのはその URL の場・年・回だけです。別の場が失敗しているときは、その場の 1R URL でもう一度補正してください。</p><ul>${items}</ul>`;
}

function formHtml(params: {
  pending: PendingCorrection[];
  status: SeedOverview;
  error?: string;
  submittedUrl?: string;
}): string {
  const { pending, status, error, submittedUrl } = params;
  const errorBlock = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const disabled = pending.length === 0 ? " disabled" : "";
  const value = submittedUrl ? ` value="${escapeHtml(submittedUrl)}"` : "";
  return `
  <h1>チェックサムシードの補正</h1>
  ${seedStatusBlock(status)}
  ${pendingListHtml(pending)}
  ${errorBlock}
  <form method="post" action="/seed">
    <label for="url">正しい 1R URL</label>
    <input id="url" name="url" type="url" required placeholder="https://www.jra.go.jp/JRADB/accessD.html?CNAME=..."${value}${disabled}>
    <button type="submit"${disabled}>この場のシードを更新してキューに投入</button>
  </form>
  <nav class="links" aria-label="他の機能">
    <a href="/kick">予想を実行</a>
    <a href="/baba/latest?format=text">馬場状態を見る</a>
  </nav>
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
  const status = await loadSeedOverview(env.CHECKSUM_SEED);

  if (req.method === "GET") {
    return htmlPage("チェックサムシードの補正", formHtml({ pending, status }));
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
      formHtml({ pending, status, error: validated.error, submittedUrl: rawUrl }),
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
        status,
        error: `入力 URL は出馬表として検証できませんでした（${check.kind}: ${check.reason ?? "不明"}）`,
        submittedUrl: rawUrl,
      }),
      400
    );
  }

  const updated = {
    venueCode: validated.parsed.venueCode,
    year: validated.parsed.year,
    kai: validated.parsed.kai,
    seed: validated.seed,
  };
  await saveVenueSeed(env.CHECKSUM_SEED, {
    seed: validated.seed,
    sourceUrl: validated.parsed.url,
    date: validated.parsed.date,
    venueCode: validated.parsed.venueCode,
    year: validated.parsed.year,
    kai: validated.parsed.kai,
  });

  const pendingForEnqueue = remapPendingForCorrectedUrl(pending, {
    pendingDate: validated.pendingDate,
    venueCode: validated.parsed.venueCode,
    correctedDate: validated.parsed.date,
  });
  const results = await enqueue(updated, pendingForEnqueue);
  const remaining: PendingCorrection[] = results
    .filter((r) => r.stillFailed.length > 0)
    .map((r) => ({
      date: r.date,
      createdAt: new Date().toISOString(),
      venues: r.stillFailed,
    }));
  await setPendingCorrections(env.CHECKSUM_SEED, remaining);

  const newHex = formatSeedHex(validated.seed);
  const courseName = venueName(validated.parsed.venueCode);
  const updatedStatus = await loadSeedOverview(env.CHECKSUM_SEED);
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
  <p>${escapeHtml(courseName)}（${escapeHtml(validated.parsed.venueCode)}） ${validated.parsed.year}年${validated.parsed.kai}回のシードを <code>0x${escapeHtml(newHex)}</code> に更新しました。他の場のシードは変更していません。</p>
  ${seedStatusBlock(updatedStatus)}
  ${blocks || "<p>投入対象はありませんでした。</p>"}
  <p><a class="btn" href="/seed">補正ページに戻る</a></p>
  <nav class="links" aria-label="他の機能">
    <a href="/kick">予想を実行</a>
    <a href="/baba/latest?format=text">馬場状態を見る</a>
  </nav>
`
  );
}
