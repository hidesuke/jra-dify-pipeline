// JRA 馬場状態（クッション値・含水率）の取得とパース。
//
// クッション値は「JS 描画で取れない」と言われがちだが、実体は baba2025.js が
// 相対パスの静的 HTML フラグメント（_data_cushion.html / _data_moist.html）を
// ajax 読み込みしているだけ。よってヘッドレスブラウザは不要で、Worker から
// 直接 GET できる。ファイルは Shift_JIS なので TextDecoder("shift_jis") で復号する
// （workerd でサポートされていることを確認済み）。1 ファイルに開催中の全場
// （rcA/rcB/rcC…）が入り、会場は title 属性（会場名）で識別されるため、
// 場コードへマッピングする。

export const CUSHION_URL = "https://www.jra.go.jp/keiba/baba/_data_cushion.html";
export const MOIST_URL = "https://www.jra.go.jp/keiba/baba/_data_moist.html";

const VENUE_NAME_TO_CODE: Record<string, string> = {
  "札幌": "01",
  "函館": "02",
  "福島": "03",
  "新潟": "04",
  "東京": "05",
  "中山": "06",
  "中京": "07",
  "京都": "08",
  "阪神": "09",
  "小倉": "10",
};

// 含水率の色分け（data-condition）→ 馬場状態区分。baba2025.js の定義に準拠。
const CONDITION_JP: Record<string, string> = {
  hard: "良",
  wet: "稍重",
  soft: "重",
  heavy: "不良",
};

export function conditionToJp(condition: string | null): string | null {
  if (!condition) return null;
  return CONDITION_JP[condition] ?? condition;
}

/** 芝またはダートの含水率（ゴール前 mg / 4 コーナー m4c）と馬場状態区分 */
export interface MoisturePair {
  goal: number | null; // ゴール前（mg）の含水率(%)
  corner4: number | null; // 4 コーナー（m4c）の含水率(%)
  goalCondition: string | null; // ゴール前の区分 hard/soft/heavy/wet
  corner4Condition: string | null; // 4 コーナーの区分
}

/** 1 回の計測（クッション値・含水率・当日雨量） */
export interface BabaMeasurement {
  time: string; // 生の計測時刻文字列 例 "9月13日（日曜）7時00分"
  month: number | null;
  day: number | null;
  cushion: number | null; // クッション値
  turf: MoisturePair | null; // 芝の含水率
  dirt: MoisturePair | null; // ダートの含水率
  rainfallMm: number | null; // 測定時刻までの当日雨量(mm)
}

/** 会場ごとの馬場データ（計測は新しい順） */
export interface VenueBaba {
  venueName: string;
  venueCode: string | null;
  measurements: BabaMeasurement[];
}

/** 芝丈（cm）。芝コース・障害コース × 野芝・洋芝 */
export interface TurfLength {
  shibaNoshiba: string | null; // 芝コースの野芝
  shibaYoshiba: string | null; // 芝コースの洋芝
  shogaiNoshiba: string | null; // 障害コースの野芝
  shogaiYoshiba: string | null; // 障害コースの洋芝
}

/** 会場ごとのコース情報（芝丈・使用コース・芝の状態） */
export interface CourseInfo {
  venueName: string;
  venueCode: string | null;
  turfLength: TurfLength | null; // 芝丈
  usedCourse: string | null; // 使用コース（例: Bコース…）
  turfCondition: string | null; // 芝の状態（傷み等のコメント）
}

function toNumberOrNull(raw: string | undefined): number | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (!v || v === "-" || v === "－") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseMonthDay(time: string): { month: number | null; day: number | null } {
  const m = time.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return { month: null, day: null };
  return { month: Number(m[1]), day: Number(m[2]) };
}

/** `<div id="rcX" title="会場名">…</div>` の会場ブロックに分割する */
function splitVenueBlocks(html: string): { venueName: string; body: string }[] {
  const re = /<div\s+id="rc[A-Z]"\s+title="([^"]*)"\s*>/g;
  const starts: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    starts.push({ name: m[1], index: m.index });
  }
  return starts.map((s, i) => ({
    venueName: s.name,
    body: html.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : undefined),
  }));
}

/** turf / dirt の含水率ブロックをパースする */
function parseMoisturePair(chunk: string, kind: "turf" | "dirt"): MoisturePair | null {
  const block = chunk.match(new RegExp(`<div class="${kind}">([\\s\\S]*?)<\\/div>`));
  if (!block) return null;
  const inner = block[1];
  const mg = inner.match(/<span[^>]*class="mg"[^>]*data-condition="([^"]*)"[^>]*>([^<]*)<\/span>/);
  const m4c = inner.match(/<span[^>]*class="m4c"[^>]*data-condition="([^"]*)"[^>]*>([^<]*)<\/span>/);
  return {
    goal: toNumberOrNull(mg?.[2]),
    corner4: toNumberOrNull(m4c?.[2]),
    goalCondition: mg?.[1]?.trim() || null,
    corner4Condition: m4c?.[1]?.trim() || null,
  };
}

/** 当日雨量(mm)を moist_caution の注記からパースする */
function parseRainfall(chunk: string): number | null {
  const m = chunk.match(/当日雨量は([\d.]+)ミリメートル/);
  return m ? toNumberOrNull(m[1]) : null;
}

/** _data_cushion.html をパースして 会場名 -> {time -> cushion} を返す */
export function parseCushionHtml(html: string): Map<string, { time: string; cushion: number | null }[]> {
  const result = new Map<string, { time: string; cushion: number | null }[]>();
  for (const { venueName, body } of splitVenueBlocks(html)) {
    const units: { time: string; cushion: number | null }[] = [];
    const unitRe = /<div class="time">([\s\S]*?)<\/div>\s*<div class="cushion">([\s\S]*?)<\/div>/g;
    let u: RegExpExecArray | null;
    while ((u = unitRe.exec(body)) !== null) {
      units.push({ time: u[1].trim(), cushion: toNumberOrNull(u[2]) });
    }
    result.set(venueName, units);
  }
  return result;
}

interface MoistUnit {
  time: string;
  turf: MoisturePair | null;
  dirt: MoisturePair | null;
  rainfallMm: number | null;
}

/** _data_moist.html をパースして 会場名 -> [{time, turf, dirt, rainfallMm}] を返す */
export function parseMoistHtml(html: string): Map<string, MoistUnit[]> {
  const result = new Map<string, MoistUnit[]>();
  for (const { venueName, body } of splitVenueBlocks(html)) {
    const units: MoistUnit[] = [];
    const timeRe = /<div class="time">([\s\S]*?)<\/div>/g;
    const times: { time: string; index: number }[] = [];
    let t: RegExpExecArray | null;
    while ((t = timeRe.exec(body)) !== null) {
      times.push({ time: t[1].trim(), index: t.index });
    }
    for (let i = 0; i < times.length; i++) {
      const chunk = body.slice(times[i].index, i + 1 < times.length ? times[i + 1].index : undefined);
      units.push({
        time: times[i].time,
        turf: parseMoisturePair(chunk, "turf"),
        dirt: parseMoisturePair(chunk, "dirt"),
        rainfallMm: parseRainfall(chunk),
      });
    }
    result.set(venueName, units);
  }
  return result;
}

/** クッションと含水率をマージして会場ごとの構造化データにする */
export function mergeBaba(
  cushion: Map<string, { time: string; cushion: number | null }[]>,
  moist: Map<string, MoistUnit[]>
): VenueBaba[] {
  const venueNames = new Set<string>([...cushion.keys(), ...moist.keys()]);
  const out: VenueBaba[] = [];
  for (const venueName of venueNames) {
    // クッションと含水率は計測時刻が数十分ずれるため、時刻文字列ではなく
    // 「月日」でまとめる。パースできない場合のみ時刻文字列をキーにする。
    const byDay = new Map<string, BabaMeasurement>();
    const keyFor = (time: string, month: number | null, day: number | null) =>
      month != null && day != null ? `${month}-${day}` : time;
    const ensure = (time: string): BabaMeasurement => {
      const { month, day } = parseMonthDay(time);
      const key = keyFor(time, month, day);
      let e = byDay.get(key);
      if (!e) {
        e = { time, month, day, cushion: null, turf: null, dirt: null, rainfallMm: null };
        byDay.set(key, e);
      }
      return e;
    };
    for (const c of cushion.get(venueName) ?? []) ensure(c.time).cushion = c.cushion;
    for (const m of moist.get(venueName) ?? []) {
      const e = ensure(m.time);
      e.turf = m.turf;
      e.dirt = m.dirt;
      e.rainfallMm = m.rainfallMm;
    }
    out.push({
      venueName,
      venueCode: VENUE_NAME_TO_CODE[venueName] ?? null,
      measurements: [...byDay.values()],
    });
  }
  return out;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const decodeShiftJis = async (res: Response) =>
  new TextDecoder("shift_jis").decode(await res.arrayBuffer());

/** JRA から馬場データを取得・パースする。取得失敗時は例外を投げる */
export async function fetchBaba(fetchImpl: FetchLike = fetch): Promise<VenueBaba[]> {
  const [cushionRes, moistRes] = await Promise.all([fetchImpl(CUSHION_URL), fetchImpl(MOIST_URL)]);
  if (!cushionRes.ok) throw new Error(`cushion fetch failed: ${cushionRes.status}`);
  if (!moistRes.ok) throw new Error(`moist fetch failed: ${moistRes.status}`);
  const [cushionHtml, moistHtml] = await Promise.all([decodeShiftJis(cushionRes), decodeShiftJis(moistRes)]);
  return mergeBaba(parseCushionHtml(cushionHtml), parseMoistHtml(moistHtml));
}

// 芝丈・使用コース・芝の状態は各会場のインデックスページに静的掲載されている。
// index.html / index2.html / index3.html が同時開催の各場（会場は <title> で判別）。
export const INDEX_URLS = [
  "https://www.jra.go.jp/keiba/baba/index.html",
  "https://www.jra.go.jp/keiba/baba/index2.html",
  "https://www.jra.go.jp/keiba/baba/index3.html",
];

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTextOrNull(html: string | undefined): string | null {
  if (html == null) return null;
  const t = stripTags(html);
  return t ? t : null;
}

function parseVenueNameFromTitle(html: string): string | null {
  const m = html.match(/<title>[^<]*（(.+?)競馬場）/);
  return m ? m[1].trim() : null;
}

/** 芝丈テーブル（`<div class="turf_length">`）をパースする */
function parseTurfLength(html: string): TurfLength | null {
  const block = html.match(/<div class="turf_length">([\s\S]*?)<\/table>/);
  if (!block) return null;
  const tbody = block[1];
  const row = (label: string): [string | null, string | null] => {
    const re = new RegExp(
      `<th[^>]*scope="row"[^>]*>\\s*${label}\\s*<\\/th>\\s*<td>([\\s\\S]*?)<\\/td>\\s*<td>([\\s\\S]*?)<\\/td>`
    );
    const m = tbody.match(re);
    if (!m) return [null, null];
    return [cleanTextOrNull(m[1]), cleanTextOrNull(m[2])];
  };
  const [shibaNoshiba, shibaYoshiba] = row("芝");
  const [shogaiNoshiba, shogaiYoshiba] = row("障害");
  if (!shibaNoshiba && !shibaYoshiba && !shogaiNoshiba && !shogaiYoshiba) return null;
  return { shibaNoshiba, shibaYoshiba, shogaiNoshiba, shogaiYoshiba };
}

/** `<h3>{見出し}</h3>` 直後の `.content` テキストを取り出す */
function contentAfterHeading(html: string, heading: string): string | null {
  const re = new RegExp(`<h3>\\s*${heading}\\s*<\\/h3>[\\s\\S]*?<div class="content">([\\s\\S]*?)<\\/div>`);
  const m = html.match(re);
  return m ? cleanTextOrNull(m[1]) : null;
}

/** インデックスページ 1 枚から会場のコース情報をパースする */
export function parseCourseInfo(html: string): CourseInfo | null {
  const venueName = parseVenueNameFromTitle(html);
  if (!venueName) return null;
  return {
    venueName,
    venueCode: VENUE_NAME_TO_CODE[venueName] ?? null,
    turfLength: parseTurfLength(html),
    usedCourse: contentAfterHeading(html, "使用コース"),
    turfCondition: contentAfterHeading(html, "芝の状態"),
  };
}

/** 各会場のコース情報を場コード -> CourseInfo で返す（best-effort、失敗ページはスキップ） */
export async function fetchCourseInfoByVenue(
  fetchImpl: FetchLike = fetch
): Promise<Map<string, CourseInfo>> {
  const map = new Map<string, CourseInfo>();
  await Promise.all(
    INDEX_URLS.map(async (url) => {
      try {
        const res = await fetchImpl(url);
        if (!res.ok) return;
        const info = parseCourseInfo(await decodeShiftJis(res));
        if (info?.venueCode) map.set(info.venueCode, info);
      } catch {
        // ページが無い場合（開催数が少ない等）はスキップ
      }
    })
  );
  return map;
}

/**
 * 指定した場コードの馬場計測を 1 件選ぶ。
 * targetDate（YYYY-MM-DD）と同じ月日の計測があればそれを、無ければ最新（先頭）を返す。
 * exact=false の場合は「対象日の値ではなく直近参考値」であることを示す。
 */
export function selectMeasurement(
  venues: VenueBaba[],
  venueCode: string,
  targetDate?: string
): { measurement: BabaMeasurement; exact: boolean } | null {
  const venue = venues.find((v) => v.venueCode === venueCode);
  if (!venue || venue.measurements.length === 0) return null;

  if (targetDate) {
    const tm = targetDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (tm) {
      const month = Number(tm[1]);
      const day = Number(tm[2]);
      const exact = venue.measurements.find((m) => m.month === month && m.day === day);
      if (exact) return { measurement: exact, exact: true };
    }
  }
  return { measurement: venue.measurements[0], exact: false };
}

/** 芝丈を読みやすい文字列にする（値の無い項目・「なし」は省く） */
function formatTurfLength(tl: TurfLength): string | null {
  const seg = (label: string, noshiba: string | null, yoshiba: string | null): string | null => {
    const xs: string[] = [];
    if (noshiba && noshiba !== "なし") xs.push(`野芝${noshiba}`);
    if (yoshiba && yoshiba !== "なし") xs.push(`洋芝${yoshiba}`);
    return xs.length ? `${label}${xs.join("・")}` : null;
  };
  const parts = [seg("芝", tl.shibaNoshiba, tl.shibaYoshiba), seg("障害", tl.shogaiNoshiba, tl.shogaiYoshiba)].filter(
    (x): x is string => Boolean(x)
  );
  return parts.length ? `芝丈(cm) ${parts.join(" ")}` : null;
}

/** remarks へ入れる 1 行サマリ文字列を作る */
export function formatBabaSummary(m: BabaMeasurement, course?: CourseInfo | null): string {
  const surface = (label: string, p: MoisturePair | null): string => {
    if (!p) return `${label}:不明`;
    const gj = conditionToJp(p.goalCondition);
    const cj = conditionToJp(p.corner4Condition);
    const g = p.goal ?? "-";
    const c = p.corner4 ?? "-";
    // ゴール前と 4 角の区分が同じならまとめて、違えば地点別に表記する。
    if (gj && gj === cj) {
      return `${label}:${gj}(含水率 ゴール前${g} 4角${c})`;
    }
    return `${label}:含水率 ゴール前${g}(${gj ?? "?"}) 4角${c}(${cj ?? "?"})`;
  };
  const parts = [
    `クッション値${m.cushion ?? "不明"}`,
    surface("芝", m.turf),
    surface("ダート", m.dirt),
  ];
  if (m.rainfallMm != null) parts.push(`当日雨量${m.rainfallMm}mm`);

  if (course) {
    if (course.usedCourse) parts.push(`使用コース:${course.usedCourse}`);
    if (course.turfLength) {
      const tl = formatTurfLength(course.turfLength);
      if (tl) parts.push(tl);
    }
    if (course.turfCondition) parts.push(`芝の状態:${course.turfCondition}`);
  }
  return `馬場[${m.time}] ${parts.join(" / ")}`;
}
