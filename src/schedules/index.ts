import { SCHEDULE_2026 } from "./2026.ts";
import type { ScheduleItem, YearSchedule } from "./types.ts";

export type { ScheduleItem, YearSchedule };

/**
 * 年ごとの開催表。新しい年は `src/schedules/YYYY.ts` を追加し、ここに登録する。
 */
const SCHEDULES_BY_YEAR: Record<number, YearSchedule> = {
  2026: SCHEDULE_2026,
};

export const VENUE_CODE_TO_NAME: Record<string, string> = {
  "01": "札幌",
  "02": "函館",
  "03": "福島",
  "04": "新潟",
  "05": "東京",
  "06": "中山",
  "07": "中京",
  "08": "京都",
  "09": "阪神",
  "10": "小倉",
};

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

export function venueName(venueCode: string): string {
  return VENUE_CODE_TO_NAME[venueCode] ?? venueCode;
}

export function getSchedulesForDate(dateKey: string): ScheduleItem[] | undefined {
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isFinite(year)) {
    return undefined;
  }
  return SCHEDULES_BY_YEAR[year]?.[dateKey];
}

export interface WeekVenue {
  venueCode: string;
  venueName: string;
  kai: number;
  nichi: number;
}

export interface WeekMeeting {
  date: string;
  weekday: string;
  label: string;
  venues: WeekVenue[];
}

function parseDateKey(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

export function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayJp(dateKey: string): string {
  const d = parseDateKey(dateKey);
  if (!d) return "";
  return WEEKDAY_JP[d.getUTCDay()] ?? "";
}

/** JST の今週（月曜〜日曜）＋週明け月曜（祝日開催用） */
export function dateKeysInJstWeek(todayKey: string): string[] {
  const d = parseDateKey(todayKey);
  if (!d) return [];
  const dow = d.getUTCDay(); // 0=日
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  const keys: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const x = new Date(monday);
    x.setUTCDate(monday.getUTCDate() + i);
    keys.push(formatDateKey(x));
  }
  return keys;
}

export function addDaysToDateKey(dateKey: string, days: number): string | null {
  const d = parseDateKey(dateKey);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateKey(d);
}

function meetingLabel(dateKey: string, venues: WeekVenue[]): string {
  const wd = weekdayJp(dateKey);
  const [, m, d] = dateKey.split("-");
  const names = venues.map((v) => v.venueName).join("・");
  return `${Number(m)}月${Number(d)}日（${wd}） ${names}`.trim();
}

export function meetingsForDateKeys(dateKeys: string[]): WeekMeeting[] {
  const meetings: WeekMeeting[] = [];
  for (const date of dateKeys) {
    const schedules = getSchedulesForDate(date);
    if (!schedules || schedules.length === 0) continue;
    const venues: WeekVenue[] = schedules.map((s) => ({
      venueCode: s.venueCode,
      venueName: venueName(s.venueCode),
      kai: s.kai,
      nichi: s.nichi,
    }));
    meetings.push({
      date,
      weekday: weekdayJp(date),
      label: meetingLabel(date, venues),
      venues,
    });
  }
  return meetings;
}

/**
 * キック画面用の開催一覧。今週（＋週明け月曜）を優先し、
 * 無ければ前後数日の開催を出す。
 */
export function getKickMeetings(todayKey: string): WeekMeeting[] {
  const week = meetingsForDateKeys(dateKeysInJstWeek(todayKey));
  if (week.length > 0) return week;
  const fallbackKeys: string[] = [];
  for (let i = -2; i <= 14; i++) {
    const key = addDaysToDateKey(todayKey, i);
    if (key) fallbackKeys.push(key);
  }
  return meetingsForDateKeys(fallbackKeys);
}

export function pickDefaultMeetingDate(meetings: WeekMeeting[], todayKey: string): string {
  if (meetings.some((m) => m.date === todayKey)) return todayKey;
  const upcoming = meetings.find((m) => m.date >= todayKey);
  return upcoming?.date ?? meetings[0]?.date ?? todayKey;
}
