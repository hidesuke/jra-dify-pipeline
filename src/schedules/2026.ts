import type { YearSchedule } from "./types";

// 2026年 JRA 開催日割
// 出典: https://www.jra.go.jp/keiba/program/2026/pdf/nittei.pdf (変更版 2026.9.6)
export const SCHEDULE_2026: YearSchedule = {
  // === 1月 ===
  "2026-01-04": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 1 }, // 1回中山1日
    { venueCode: "08", year: 2026, kai: 1, nichi: 1 }  // 1回京都1日
  ],
  "2026-01-05": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 2 }, // 1回中山2日
    { venueCode: "08", year: 2026, kai: 1, nichi: 2 }  // 1回京都2日
  ],
  "2026-01-10": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 3 }, // 1回中山3日
    { venueCode: "08", year: 2026, kai: 1, nichi: 3 }  // 1回京都3日
  ],
  "2026-01-11": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 4 }, // 1回中山4日
    { venueCode: "08", year: 2026, kai: 1, nichi: 4 }  // 1回京都4日
  ],
  "2026-01-12": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 5 }, // 1回中山5日
    { venueCode: "08", year: 2026, kai: 1, nichi: 5 }  // 1回京都5日
  ],
  "2026-01-17": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 6 }, // 1回中山6日
    { venueCode: "08", year: 2026, kai: 1, nichi: 6 }  // 1回京都6日
  ],
  "2026-01-18": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 7 }, // 1回中山7日
    { venueCode: "08", year: 2026, kai: 1, nichi: 7 }  // 1回京都7日
  ],
  "2026-01-24": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 8 }, // 1回中山8日
    { venueCode: "08", year: 2026, kai: 1, nichi: 8 }, // 1回京都8日
    { venueCode: "10", year: 2026, kai: 1, nichi: 1 }  // 1回小倉1日
  ],
  "2026-01-25": [
    { venueCode: "06", year: 2026, kai: 1, nichi: 9 }, // 1回中山9日
    { venueCode: "08", year: 2026, kai: 1, nichi: 9 }, // 1回京都9日
    { venueCode: "10", year: 2026, kai: 1, nichi: 2 }  // 1回小倉2日
  ],
  "2026-01-31": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 1 }, // 1回東京1日
    { venueCode: "08", year: 2026, kai: 2, nichi: 1 }, // 2回京都1日
    { venueCode: "10", year: 2026, kai: 1, nichi: 3 }  // 1回小倉3日
  ],

  // === 2月 ===
  "2026-02-01": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 2 }, // 1回東京2日
    { venueCode: "08", year: 2026, kai: 2, nichi: 2 }, // 2回京都2日
    { venueCode: "10", year: 2026, kai: 1, nichi: 4 }  // 1回小倉4日
  ],
  "2026-02-07": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 3 }, // 1回東京3日
    { venueCode: "08", year: 2026, kai: 2, nichi: 3 }, // 2回京都3日
    { venueCode: "10", year: 2026, kai: 1, nichi: 5 }  // 1回小倉5日
  ],
  "2026-02-08": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 4 }, // 1回東京4日
    { venueCode: "08", year: 2026, kai: 2, nichi: 4 }, // 2回京都4日
    { venueCode: "10", year: 2026, kai: 1, nichi: 6 }  // 1回小倉6日
  ],
  "2026-02-14": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 5 }, // 1回東京5日
    { venueCode: "08", year: 2026, kai: 2, nichi: 5 }, // 2回京都5日
    { venueCode: "10", year: 2026, kai: 1, nichi: 7 }  // 1回小倉7日
  ],
  "2026-02-15": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 6 }, // 1回東京6日
    { venueCode: "08", year: 2026, kai: 2, nichi: 6 }, // 2回京都6日
    { venueCode: "10", year: 2026, kai: 1, nichi: 8 }  // 1回小倉8日
  ],
  "2026-02-21": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 7 }, // 1回東京7日
    { venueCode: "09", year: 2026, kai: 1, nichi: 1 }, // 1回阪神1日
    { venueCode: "10", year: 2026, kai: 1, nichi: 9 }  // 1回小倉9日
  ],
  "2026-02-22": [
    { venueCode: "05", year: 2026, kai: 1, nichi: 8 }, // 1回東京8日
    { venueCode: "09", year: 2026, kai: 1, nichi: 2 }, // 1回阪神2日
    { venueCode: "10", year: 2026, kai: 1, nichi: 10 }  // 1回小倉10日
  ],
  "2026-02-28": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 1 }, // 2回中山1日
    { venueCode: "09", year: 2026, kai: 1, nichi: 3 }, // 1回阪神3日
    { venueCode: "10", year: 2026, kai: 1, nichi: 11 }  // 1回小倉11日
  ],

  // === 3月 ===
  "2026-03-01": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 2 }, // 2回中山2日
    { venueCode: "09", year: 2026, kai: 1, nichi: 4 }, // 1回阪神4日
    { venueCode: "10", year: 2026, kai: 1, nichi: 12 }  // 1回小倉12日
  ],
  "2026-03-07": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 3 }, // 2回中山3日
    { venueCode: "09", year: 2026, kai: 1, nichi: 5 }  // 1回阪神5日
  ],
  "2026-03-08": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 4 }, // 2回中山4日
    { venueCode: "09", year: 2026, kai: 1, nichi: 6 }  // 1回阪神6日
  ],
  "2026-03-14": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 5 }, // 2回中山5日
    { venueCode: "07", year: 2026, kai: 1, nichi: 1 }, // 1回中京1日
    { venueCode: "09", year: 2026, kai: 1, nichi: 7 }  // 1回阪神7日
  ],
  "2026-03-15": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 6 }, // 2回中山6日
    { venueCode: "07", year: 2026, kai: 1, nichi: 2 }, // 1回中京2日
    { venueCode: "09", year: 2026, kai: 1, nichi: 8 }  // 1回阪神8日
  ],
  "2026-03-21": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 7 }, // 2回中山7日
    { venueCode: "07", year: 2026, kai: 1, nichi: 3 }, // 1回中京3日
    { venueCode: "09", year: 2026, kai: 1, nichi: 9 }  // 1回阪神9日
  ],
  "2026-03-22": [
    { venueCode: "06", year: 2026, kai: 2, nichi: 8 }, // 2回中山8日
    { venueCode: "07", year: 2026, kai: 1, nichi: 4 }, // 1回中京4日
    { venueCode: "09", year: 2026, kai: 1, nichi: 10 }  // 1回阪神10日
  ],
  "2026-03-28": [
    { venueCode: "06", year: 2026, kai: 3, nichi: 1 }, // 3回中山1日
    { venueCode: "07", year: 2026, kai: 1, nichi: 5 }, // 1回中京5日
    { venueCode: "09", year: 2026, kai: 2, nichi: 1 }  // 2回阪神1日
  ],
  "2026-03-29": [
    { venueCode: "06", year: 2026, kai: 3, nichi: 2 }, // 3回中山2日
    { venueCode: "07", year: 2026, kai: 1, nichi: 6 }, // 1回中京6日
    { venueCode: "09", year: 2026, kai: 2, nichi: 2 }  // 2回阪神2日
  ],

  // === 4月 ===
  "2026-04-04": [
    { venueCode: "06", year: 2026, kai: 3, nichi: 3 }, // 3回中山3日
    { venueCode: "09", year: 2026, kai: 2, nichi: 3 }  // 2回阪神3日
  ],
  "2026-04-05": [
    { venueCode: "06", year: 2026, kai: 3, nichi: 4 }, // 3回中山4日
    { venueCode: "09", year: 2026, kai: 2, nichi: 4 }  // 2回阪神4日
  ],
  "2026-04-11": [
    { venueCode: "03", year: 2026, kai: 1, nichi: 1 }, // 1回福島1日
    { venueCode: "06", year: 2026, kai: 3, nichi: 5 }, // 3回中山5日
    { venueCode: "09", year: 2026, kai: 2, nichi: 5 }  // 2回阪神5日
  ],
  "2026-04-12": [
    { venueCode: "03", year: 2026, kai: 1, nichi: 2 }, // 1回福島2日
    { venueCode: "06", year: 2026, kai: 3, nichi: 6 }, // 3回中山6日
    { venueCode: "09", year: 2026, kai: 2, nichi: 6 }  // 2回阪神6日
  ],
  "2026-04-18": [
    { venueCode: "03", year: 2026, kai: 1, nichi: 3 }, // 1回福島3日
    { venueCode: "06", year: 2026, kai: 3, nichi: 7 }, // 3回中山7日
    { venueCode: "09", year: 2026, kai: 2, nichi: 7 }  // 2回阪神7日
  ],
  "2026-04-19": [
    { venueCode: "03", year: 2026, kai: 1, nichi: 4 }, // 1回福島4日
    { venueCode: "06", year: 2026, kai: 3, nichi: 8 }, // 3回中山8日
    { venueCode: "09", year: 2026, kai: 2, nichi: 8 }  // 2回阪神8日
  ],
  "2026-04-25": [
    { venueCode: "03", year: 2026, kai: 1, nichi: 5 }, // 1回福島5日
    { venueCode: "05", year: 2026, kai: 2, nichi: 1 }, // 2回東京1日
    { venueCode: "08", year: 2026, kai: 3, nichi: 1 }  // 3回京都1日
  ],
  "2026-04-26": [
    { venueCode: "03", year: 2026, kai: 1, nichi: 6 }, // 1回福島6日
    { venueCode: "05", year: 2026, kai: 2, nichi: 2 }, // 2回東京2日
    { venueCode: "08", year: 2026, kai: 3, nichi: 2 }  // 3回京都2日
  ],

  // === 5月 ===
  "2026-05-02": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 1 }, // 1回新潟1日
    { venueCode: "05", year: 2026, kai: 2, nichi: 3 }, // 2回東京3日
    { venueCode: "08", year: 2026, kai: 3, nichi: 3 }  // 3回京都3日
  ],
  "2026-05-03": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 2 }, // 1回新潟2日
    { venueCode: "05", year: 2026, kai: 2, nichi: 4 }, // 2回東京4日
    { venueCode: "08", year: 2026, kai: 3, nichi: 4 }  // 3回京都4日
  ],
  "2026-05-09": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 3 }, // 1回新潟3日
    { venueCode: "05", year: 2026, kai: 2, nichi: 5 }, // 2回東京5日
    { venueCode: "08", year: 2026, kai: 3, nichi: 5 }  // 3回京都5日
  ],
  "2026-05-10": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 4 }, // 1回新潟4日
    { venueCode: "05", year: 2026, kai: 2, nichi: 6 }, // 2回東京6日
    { venueCode: "08", year: 2026, kai: 3, nichi: 6 }  // 3回京都6日
  ],
  "2026-05-16": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 5 }, // 1回新潟5日
    { venueCode: "05", year: 2026, kai: 2, nichi: 7 }, // 2回東京7日
    { venueCode: "08", year: 2026, kai: 3, nichi: 7 }  // 3回京都7日
  ],
  "2026-05-17": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 6 }, // 1回新潟6日
    { venueCode: "05", year: 2026, kai: 2, nichi: 8 }, // 2回東京8日
    { venueCode: "08", year: 2026, kai: 3, nichi: 8 }  // 3回京都8日
  ],
  "2026-05-23": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 7 }, // 1回新潟7日
    { venueCode: "05", year: 2026, kai: 2, nichi: 9 }, // 2回東京9日
    { venueCode: "08", year: 2026, kai: 3, nichi: 9 }  // 3回京都9日
  ],
  "2026-05-24": [
    { venueCode: "04", year: 2026, kai: 1, nichi: 8 }, // 1回新潟8日
    { venueCode: "05", year: 2026, kai: 2, nichi: 10 }, // 2回東京10日
    { venueCode: "08", year: 2026, kai: 3, nichi: 10 }  // 3回京都10日
  ],
  "2026-05-30": [
    { venueCode: "05", year: 2026, kai: 2, nichi: 11 }, // 2回東京11日
    { venueCode: "08", year: 2026, kai: 3, nichi: 11 }  // 3回京都11日
  ],
  "2026-05-31": [
    { venueCode: "05", year: 2026, kai: 2, nichi: 12 }, // 2回東京12日
    { venueCode: "08", year: 2026, kai: 3, nichi: 12 }  // 3回京都12日
  ],

  // === 6月 ===
  "2026-06-06": [
    { venueCode: "05", year: 2026, kai: 3, nichi: 1 }, // 3回東京1日
    { venueCode: "09", year: 2026, kai: 3, nichi: 1 }  // 3回阪神1日
  ],
  "2026-06-07": [
    { venueCode: "05", year: 2026, kai: 3, nichi: 2 }, // 3回東京2日
    { venueCode: "09", year: 2026, kai: 3, nichi: 2 }  // 3回阪神2日
  ],
  "2026-06-13": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 1 }, // 1回函館1日
    { venueCode: "05", year: 2026, kai: 3, nichi: 3 }, // 3回東京3日
    { venueCode: "09", year: 2026, kai: 3, nichi: 3 }  // 3回阪神3日
  ],
  "2026-06-14": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 2 }, // 1回函館2日
    { venueCode: "05", year: 2026, kai: 3, nichi: 4 }, // 3回東京4日
    { venueCode: "09", year: 2026, kai: 3, nichi: 4 }  // 3回阪神4日
  ],
  "2026-06-20": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 3 }, // 1回函館3日
    { venueCode: "05", year: 2026, kai: 3, nichi: 5 }, // 3回東京5日
    { venueCode: "09", year: 2026, kai: 3, nichi: 5 }  // 3回阪神5日
  ],
  "2026-06-21": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 4 }, // 1回函館4日
    { venueCode: "05", year: 2026, kai: 3, nichi: 6 }, // 3回東京6日
    { venueCode: "09", year: 2026, kai: 3, nichi: 6 }  // 3回阪神6日
  ],
  "2026-06-27": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 5 }, // 1回函館5日
    { venueCode: "03", year: 2026, kai: 2, nichi: 1 }, // 2回福島1日
    { venueCode: "10", year: 2026, kai: 2, nichi: 1 }  // 2回小倉1日
  ],
  "2026-06-28": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 6 }, // 1回函館6日
    { venueCode: "03", year: 2026, kai: 2, nichi: 2 }, // 2回福島2日
    { venueCode: "10", year: 2026, kai: 2, nichi: 2 }  // 2回小倉2日
  ],

  // === 7月 ===
  "2026-07-04": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 7 }, // 1回函館7日
    { venueCode: "03", year: 2026, kai: 2, nichi: 3 }, // 2回福島3日
    { venueCode: "10", year: 2026, kai: 2, nichi: 3 }  // 2回小倉3日
  ],
  "2026-07-05": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 8 }, // 1回函館8日
    { venueCode: "03", year: 2026, kai: 2, nichi: 4 }, // 2回福島4日
    { venueCode: "10", year: 2026, kai: 2, nichi: 4 }  // 2回小倉4日
  ],
  "2026-07-11": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 9 }, // 1回函館9日
    { venueCode: "03", year: 2026, kai: 2, nichi: 5 }, // 2回福島5日
    { venueCode: "10", year: 2026, kai: 2, nichi: 5 }  // 2回小倉5日
  ],
  "2026-07-12": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 10 }, // 1回函館10日
    { venueCode: "03", year: 2026, kai: 2, nichi: 6 }, // 2回福島6日
    { venueCode: "10", year: 2026, kai: 2, nichi: 6 }  // 2回小倉6日
  ],
  "2026-07-18": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 11 }, // 1回函館11日
    { venueCode: "03", year: 2026, kai: 2, nichi: 7 }, // 2回福島7日
    { venueCode: "10", year: 2026, kai: 2, nichi: 7 }  // 2回小倉7日
  ],
  "2026-07-19": [
    { venueCode: "02", year: 2026, kai: 1, nichi: 12 }, // 1回函館12日
    { venueCode: "03", year: 2026, kai: 2, nichi: 8 }, // 2回福島8日
    { venueCode: "10", year: 2026, kai: 2, nichi: 8 }  // 2回小倉8日
  ],
  "2026-07-25": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 1 }, // 1回札幌1日
    { venueCode: "04", year: 2026, kai: 2, nichi: 1 }, // 2回新潟1日
    { venueCode: "07", year: 2026, kai: 2, nichi: 1 }  // 2回中京1日
  ],
  "2026-07-26": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 2 }, // 1回札幌2日
    { venueCode: "04", year: 2026, kai: 2, nichi: 2 }, // 2回新潟2日
    { venueCode: "07", year: 2026, kai: 2, nichi: 2 }  // 2回中京2日
  ],

  // === 8月 ===
  "2026-08-01": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 3 }, // 1回札幌3日
    { venueCode: "04", year: 2026, kai: 2, nichi: 3 }, // 2回新潟3日
    { venueCode: "07", year: 2026, kai: 2, nichi: 3 }  // 2回中京3日
  ],
  "2026-08-02": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 4 }, // 1回札幌4日
    { venueCode: "04", year: 2026, kai: 2, nichi: 4 }, // 2回新潟4日
    { venueCode: "07", year: 2026, kai: 2, nichi: 4 }  // 2回中京4日
  ],
  "2026-08-08": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 5 }, // 1回札幌5日
    { venueCode: "04", year: 2026, kai: 2, nichi: 5 }, // 2回新潟5日
    { venueCode: "07", year: 2026, kai: 2, nichi: 5 }  // 2回中京5日
  ],
  "2026-08-09": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 6 }, // 1回札幌6日
    { venueCode: "04", year: 2026, kai: 2, nichi: 6 }, // 2回新潟6日
    { venueCode: "07", year: 2026, kai: 2, nichi: 6 }  // 2回中京6日
  ],
  "2026-08-15": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 7 }, // 1回札幌7日
    { venueCode: "04", year: 2026, kai: 2, nichi: 7 }, // 2回新潟7日
    { venueCode: "07", year: 2026, kai: 2, nichi: 7 }  // 2回中京7日
  ],
  "2026-08-16": [
    { venueCode: "01", year: 2026, kai: 1, nichi: 8 }, // 1回札幌8日
    { venueCode: "04", year: 2026, kai: 2, nichi: 8 }, // 2回新潟8日
    { venueCode: "07", year: 2026, kai: 2, nichi: 8 }  // 2回中京8日
  ],
  "2026-08-22": [
    { venueCode: "01", year: 2026, kai: 2, nichi: 1 }, // 2回札幌1日
    { venueCode: "04", year: 2026, kai: 3, nichi: 1 }, // 3回新潟1日
    { venueCode: "07", year: 2026, kai: 3, nichi: 1 }  // 3回中京1日
  ],
  "2026-08-23": [
    { venueCode: "01", year: 2026, kai: 2, nichi: 2 }, // 2回札幌2日
    { venueCode: "04", year: 2026, kai: 3, nichi: 2 }, // 3回新潟2日
    { venueCode: "07", year: 2026, kai: 3, nichi: 2 }  // 3回中京2日
  ],
  "2026-08-29": [
    { venueCode: "01", year: 2026, kai: 2, nichi: 3 }, // 2回札幌3日
    { venueCode: "04", year: 2026, kai: 3, nichi: 3 }, // 3回新潟3日
    { venueCode: "07", year: 2026, kai: 3, nichi: 3 }  // 3回中京3日
  ],
  "2026-08-30": [
    { venueCode: "01", year: 2026, kai: 2, nichi: 4 }, // 2回札幌4日
    { venueCode: "04", year: 2026, kai: 3, nichi: 4 }, // 3回新潟4日
    { venueCode: "07", year: 2026, kai: 3, nichi: 4 }  // 3回中京4日
  ],

  // === 9月 ===
  "2026-09-05": [
    { venueCode: "01", year: 2026, kai: 2, nichi: 5 }, // 2回札幌5日
    { venueCode: "06", year: 2026, kai: 4, nichi: 1 }, // 4回中山1日
    { venueCode: "09", year: 2026, kai: 4, nichi: 1 }  // 4回阪神1日
  ],
  "2026-09-06": [
    { venueCode: "01", year: 2026, kai: 2, nichi: 6 }, // 2回札幌6日
    { venueCode: "06", year: 2026, kai: 4, nichi: 2 }, // 4回中山2日
    { venueCode: "09", year: 2026, kai: 4, nichi: 2 }  // 4回阪神2日
  ],
  "2026-09-12": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 3 }, // 4回中山3日
    { venueCode: "09", year: 2026, kai: 4, nichi: 3 }  // 4回阪神3日
  ],
  "2026-09-13": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 4 }, // 4回中山4日
    { venueCode: "09", year: 2026, kai: 4, nichi: 4 }  // 4回阪神4日
  ],
  "2026-09-19": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 5 }, // 4回中山5日
    { venueCode: "09", year: 2026, kai: 4, nichi: 5 }  // 4回阪神5日
  ],
  "2026-09-20": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 6 }, // 4回中山6日
    { venueCode: "09", year: 2026, kai: 4, nichi: 6 }  // 4回阪神6日
  ],
  "2026-09-21": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 7 }, // 4回中山7日
    { venueCode: "09", year: 2026, kai: 4, nichi: 7 }  // 4回阪神7日
  ],
  "2026-09-26": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 8 }, // 4回中山8日
    { venueCode: "09", year: 2026, kai: 4, nichi: 8 }  // 4回阪神8日
  ],
  "2026-09-27": [
    { venueCode: "06", year: 2026, kai: 4, nichi: 9 }, // 4回中山9日
    { venueCode: "09", year: 2026, kai: 4, nichi: 9 }  // 4回阪神9日
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
    { venueCode: "08", year: 2026, kai: 4, nichi: 3 }  // 4回京都3日
  ],
  "2026-10-11": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 4 }, // 4回東京4日
    { venueCode: "08", year: 2026, kai: 4, nichi: 4 }  // 4回京都4日
  ],
  "2026-10-12": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 5 }, // 4回東京5日
    { venueCode: "08", year: 2026, kai: 4, nichi: 5 }  // 4回京都5日
  ],
  "2026-10-17": [
    { venueCode: "04", year: 2026, kai: 4, nichi: 1 }, // 4回新潟1日
    { venueCode: "05", year: 2026, kai: 4, nichi: 6 }, // 4回東京6日
    { venueCode: "08", year: 2026, kai: 4, nichi: 6 }  // 4回京都6日
  ],
  "2026-10-18": [
    { venueCode: "04", year: 2026, kai: 4, nichi: 2 }, // 4回新潟2日
    { venueCode: "05", year: 2026, kai: 4, nichi: 7 }, // 4回東京7日
    { venueCode: "08", year: 2026, kai: 4, nichi: 7 }  // 4回京都7日
  ],
  "2026-10-24": [
    { venueCode: "04", year: 2026, kai: 4, nichi: 3 }, // 4回新潟3日
    { venueCode: "05", year: 2026, kai: 4, nichi: 8 }, // 4回東京8日
    { venueCode: "08", year: 2026, kai: 4, nichi: 8 }  // 4回京都8日
  ],
  "2026-10-25": [
    { venueCode: "04", year: 2026, kai: 4, nichi: 4 }, // 4回新潟4日
    { venueCode: "05", year: 2026, kai: 4, nichi: 9 }, // 4回東京9日
    { venueCode: "08", year: 2026, kai: 4, nichi: 9 }  // 4回京都9日
  ],
  "2026-10-31": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 10 }, // 4回東京10日
    { venueCode: "08", year: 2026, kai: 4, nichi: 10 }  // 4回京都10日
  ],

  // === 11月 ===
  "2026-11-01": [
    { venueCode: "05", year: 2026, kai: 4, nichi: 11 }, // 4回東京11日
    { venueCode: "08", year: 2026, kai: 4, nichi: 11 }  // 4回京都11日
  ],
  "2026-11-07": [
    { venueCode: "03", year: 2026, kai: 3, nichi: 1 }, // 3回福島1日
    { venueCode: "05", year: 2026, kai: 5, nichi: 1 }, // 5回東京1日
    { venueCode: "08", year: 2026, kai: 5, nichi: 1 }  // 5回京都1日
  ],
  "2026-11-08": [
    { venueCode: "03", year: 2026, kai: 3, nichi: 2 }, // 3回福島2日
    { venueCode: "05", year: 2026, kai: 5, nichi: 2 }, // 5回東京2日
    { venueCode: "08", year: 2026, kai: 5, nichi: 2 }  // 5回京都2日
  ],
  "2026-11-14": [
    { venueCode: "03", year: 2026, kai: 3, nichi: 3 }, // 3回福島3日
    { venueCode: "05", year: 2026, kai: 5, nichi: 3 }, // 5回東京3日
    { venueCode: "08", year: 2026, kai: 5, nichi: 3 }  // 5回京都3日
  ],
  "2026-11-15": [
    { venueCode: "03", year: 2026, kai: 3, nichi: 4 }, // 3回福島4日
    { venueCode: "05", year: 2026, kai: 5, nichi: 4 }, // 5回東京4日
    { venueCode: "08", year: 2026, kai: 5, nichi: 4 }  // 5回京都4日
  ],
  "2026-11-21": [
    { venueCode: "03", year: 2026, kai: 3, nichi: 5 }, // 3回福島5日
    { venueCode: "08", year: 2026, kai: 5, nichi: 5 }  // 5回京都5日
  ],
  "2026-11-22": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 5 }, // 5回東京5日
    { venueCode: "08", year: 2026, kai: 5, nichi: 6 }  // 5回京都6日
  ],
  "2026-11-23": [
    { venueCode: "03", year: 2026, kai: 3, nichi: 6 }, // 3回福島6日
    { venueCode: "05", year: 2026, kai: 5, nichi: 6 }  // 5回東京6日
  ],
  "2026-11-28": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 7 }, // 5回東京7日
    { venueCode: "08", year: 2026, kai: 5, nichi: 7 }  // 5回京都7日
  ],
  "2026-11-29": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 8 }, // 5回東京8日
    { venueCode: "08", year: 2026, kai: 5, nichi: 8 }  // 5回京都8日
  ],
  "2026-11-30": [
    { venueCode: "05", year: 2026, kai: 5, nichi: 9 }  // 5回東京9日
  ],

  // === 12月 ===
  "2026-12-05": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 1 }, // 5回中山1日
    { venueCode: "07", year: 2026, kai: 4, nichi: 1 }, // 4回中京1日
    { venueCode: "09", year: 2026, kai: 5, nichi: 1 }  // 5回阪神1日
  ],
  "2026-12-06": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 2 }, // 5回中山2日
    { venueCode: "07", year: 2026, kai: 4, nichi: 2 }, // 4回中京2日
    { venueCode: "09", year: 2026, kai: 5, nichi: 2 }  // 5回阪神2日
  ],
  "2026-12-12": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 3 }, // 5回中山3日
    { venueCode: "07", year: 2026, kai: 4, nichi: 3 }, // 4回中京3日
    { venueCode: "09", year: 2026, kai: 5, nichi: 3 }  // 5回阪神3日
  ],
  "2026-12-13": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 4 }, // 5回中山4日
    { venueCode: "07", year: 2026, kai: 4, nichi: 4 }, // 4回中京4日
    { venueCode: "09", year: 2026, kai: 5, nichi: 4 }  // 5回阪神4日
  ],
  "2026-12-19": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 5 }, // 5回中山5日
    { venueCode: "07", year: 2026, kai: 4, nichi: 5 }, // 4回中京5日
    { venueCode: "09", year: 2026, kai: 5, nichi: 5 }  // 5回阪神5日
  ],
  "2026-12-20": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 6 }, // 5回中山6日
    { venueCode: "07", year: 2026, kai: 4, nichi: 6 }, // 4回中京6日
    { venueCode: "09", year: 2026, kai: 5, nichi: 6 }  // 5回阪神6日
  ],
  "2026-12-26": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 7 }, // 5回中山7日
    { venueCode: "09", year: 2026, kai: 5, nichi: 7 }  // 5回阪神7日
  ],
  "2026-12-27": [
    { venueCode: "06", year: 2026, kai: 5, nichi: 8 }, // 5回中山8日
    { venueCode: "09", year: 2026, kai: 5, nichi: 8 }  // 5回阪神8日
  ]
};
