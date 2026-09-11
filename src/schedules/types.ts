export interface ScheduleItem {
  venueCode: string; // "01":札幌, "02":函館, "03":福島, "04":新潟, "05":東京, "06":中山, "07":中京, "08":京都, "09":阪神, "10":小倉
  year: number;
  kai: number; // 回次
  nichi: number; // 日次
}

export type YearSchedule = Record<string, ScheduleItem[]>;
