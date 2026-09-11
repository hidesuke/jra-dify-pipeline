import type { YearSchedule } from "./types";

// 2026年9月12日以降〜年末までの全JRA開催スケジュール
export const SCHEDULE_2026: YearSchedule = {
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
