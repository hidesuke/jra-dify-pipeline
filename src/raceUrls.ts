import type { ScheduleItem } from "./schedules/index.ts";
import { DEFAULT_PREFIX, compactDate, generateRaceUrls } from "./checksum.ts";
import { resolveSeeds, type ResolvedSeed, type SeedKv } from "./seedStore.ts";

export interface RaceUrlRow {
  venueCode: string;
  raceNo: number;
  url: string;
}

/** 開催ごとの seed で馬柱 URL を作る。場が違えば seed も別になる。 */
export async function rowsForSchedules(
  kv: SeedKv | undefined,
  schedules: ScheduleItem[],
  date: string,
  prefix = DEFAULT_PREFIX,
  raceNo?: number,
  override?: { venueCode: string; year: number; kai: number; seed: number }
): Promise<{ rows: RaceUrlRow[]; seeds: ResolvedSeed[] }> {
  const dateCompact = compactDate(date);
  const seeds = await resolveSeeds(kv, schedules, override);
  const rows = schedules.flatMap((item, index) =>
    generateRaceUrls(item, dateCompact, prefix, seeds[index].seed)
      .filter((race) => raceNo === undefined || race.raceNo === raceNo)
      .map((race) => ({
        venueCode: item.venueCode,
        raceNo: race.raceNo,
        url: race.url,
      }))
  );
  return { rows, seeds };
}
