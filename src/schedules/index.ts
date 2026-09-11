import { SCHEDULE_2026 } from "./2026";
import type { ScheduleItem, YearSchedule } from "./types";

export type { ScheduleItem, YearSchedule };

/**
 * 年ごとの開催表。新しい年は `src/schedules/YYYY.ts` を追加し、ここに登録する。
 */
const SCHEDULES_BY_YEAR: Record<number, YearSchedule> = {
  2026: SCHEDULE_2026,
};

export function getSchedulesForDate(dateKey: string): ScheduleItem[] | undefined {
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isFinite(year)) {
    return undefined;
  }
  return SCHEDULES_BY_YEAR[year]?.[dateKey];
}
