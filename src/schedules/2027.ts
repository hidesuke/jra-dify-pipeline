import type { YearSchedule } from "./types.ts";

// 2027年 JRA 開催日割
// 出典: https://www.jra.go.jp/keiba/program/2027/pdf/nittei.pdf (2026.9.24)
// セルの数字は回次。日次は同じ回の中で日付順に 1 から振った。
// 巻末集計: 札幌2回14日 函館2回14日 福島3回20日 新潟3回24日 中山5回44日
//           東京5回47日 中京3回24日 京都5回46日 阪神5回45日 小倉3回20日 計36回298日
export const SCHEDULE_2027: YearSchedule = {
  // === 1月 ===
  "2027-01-04": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 1 }, // 1回中山1日
    { venueCode: "08", year: 2027, kai: 1, nichi: 1 }  // 1回京都1日
  ],
  "2027-01-05": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 2 }, // 1回中山2日
    { venueCode: "08", year: 2027, kai: 1, nichi: 2 }  // 1回京都2日
  ],
  "2027-01-09": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 3 }, // 1回中山3日
    { venueCode: "08", year: 2027, kai: 1, nichi: 3 }  // 1回京都3日
  ],
  "2027-01-10": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 4 }, // 1回中山4日
    { venueCode: "08", year: 2027, kai: 1, nichi: 4 }  // 1回京都4日
  ],
  "2027-01-11": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 5 }, // 1回中山5日
    { venueCode: "08", year: 2027, kai: 1, nichi: 5 }  // 1回京都5日
  ],
  "2027-01-16": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 6 }, // 1回中山6日
    { venueCode: "08", year: 2027, kai: 1, nichi: 6 }  // 1回京都6日
  ],
  "2027-01-17": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 7 }, // 1回中山7日
    { venueCode: "08", year: 2027, kai: 1, nichi: 7 }  // 1回京都7日
  ],
  "2027-01-23": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 8 }, // 1回中山8日
    { venueCode: "08", year: 2027, kai: 1, nichi: 8 }, // 1回京都8日
    { venueCode: "10", year: 2027, kai: 1, nichi: 1 }  // 1回小倉1日
  ],
  "2027-01-24": [
    { venueCode: "06", year: 2027, kai: 1, nichi: 9 }, // 1回中山9日
    { venueCode: "08", year: 2027, kai: 1, nichi: 9 }, // 1回京都9日
    { venueCode: "10", year: 2027, kai: 1, nichi: 2 }  // 1回小倉2日
  ],
  "2027-01-30": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 1 }, // 1回東京1日
    { venueCode: "08", year: 2027, kai: 2, nichi: 1 }, // 2回京都1日
    { venueCode: "10", year: 2027, kai: 1, nichi: 3 }  // 1回小倉3日
  ],
  "2027-01-31": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 2 }, // 1回東京2日
    { venueCode: "08", year: 2027, kai: 2, nichi: 2 }, // 2回京都2日
    { venueCode: "10", year: 2027, kai: 1, nichi: 4 }  // 1回小倉4日
  ],

  // === 2月 ===
  "2027-02-06": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 3 }, // 1回東京3日
    { venueCode: "08", year: 2027, kai: 2, nichi: 3 }, // 2回京都3日
    { venueCode: "10", year: 2027, kai: 1, nichi: 5 }  // 1回小倉5日
  ],
  "2027-02-07": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 4 }, // 1回東京4日
    { venueCode: "08", year: 2027, kai: 2, nichi: 4 }, // 2回京都4日
    { venueCode: "10", year: 2027, kai: 1, nichi: 6 }  // 1回小倉6日
  ],
  "2027-02-13": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 5 }, // 1回東京5日
    { venueCode: "08", year: 2027, kai: 2, nichi: 5 }, // 2回京都5日
    { venueCode: "10", year: 2027, kai: 2, nichi: 1 }  // 2回小倉1日
  ],
  "2027-02-14": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 6 }, // 1回東京6日
    { venueCode: "08", year: 2027, kai: 2, nichi: 6 }, // 2回京都6日
    { venueCode: "10", year: 2027, kai: 2, nichi: 2 }  // 2回小倉2日
  ],
  "2027-02-20": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 7 }, // 1回東京7日
    { venueCode: "09", year: 2027, kai: 1, nichi: 1 }, // 1回阪神1日
    { venueCode: "10", year: 2027, kai: 2, nichi: 3 }  // 2回小倉3日
  ],
  "2027-02-21": [
    { venueCode: "05", year: 2027, kai: 1, nichi: 8 }, // 1回東京8日
    { venueCode: "09", year: 2027, kai: 1, nichi: 2 }, // 1回阪神2日
    { venueCode: "10", year: 2027, kai: 2, nichi: 4 }  // 2回小倉4日
  ],
  "2027-02-27": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 1 }, // 2回中山1日
    { venueCode: "09", year: 2027, kai: 1, nichi: 3 }, // 1回阪神3日
    { venueCode: "10", year: 2027, kai: 2, nichi: 5 }  // 2回小倉5日
  ],
  "2027-02-28": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 2 }, // 2回中山2日
    { venueCode: "09", year: 2027, kai: 1, nichi: 4 }, // 1回阪神4日
    { venueCode: "10", year: 2027, kai: 2, nichi: 6 }  // 2回小倉6日
  ],

  // === 3月 ===
  "2027-03-06": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 3 }, // 2回中山3日
    { venueCode: "09", year: 2027, kai: 1, nichi: 5 }  // 1回阪神5日
  ],
  "2027-03-07": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 4 }, // 2回中山4日
    { venueCode: "09", year: 2027, kai: 1, nichi: 6 }  // 1回阪神6日
  ],
  "2027-03-08": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 5 }, // 2回中山5日
    { venueCode: "09", year: 2027, kai: 1, nichi: 7 }  // 1回阪神7日
  ],
  "2027-03-13": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 6 }, // 2回中山6日
    { venueCode: "07", year: 2027, kai: 1, nichi: 1 }, // 1回中京1日
    { venueCode: "09", year: 2027, kai: 1, nichi: 8 }  // 1回阪神8日
  ],
  "2027-03-14": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 7 }, // 2回中山7日
    { venueCode: "07", year: 2027, kai: 1, nichi: 2 }, // 1回中京2日
    { venueCode: "09", year: 2027, kai: 1, nichi: 9 }  // 1回阪神9日
  ],
  "2027-03-20": [
    { venueCode: "07", year: 2027, kai: 1, nichi: 3 }, // 1回中京3日
    { venueCode: "09", year: 2027, kai: 1, nichi: 10 }  // 1回阪神10日
  ],
  "2027-03-21": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 8 }, // 2回中山8日
    { venueCode: "09", year: 2027, kai: 1, nichi: 11 }  // 1回阪神11日
  ],
  "2027-03-22": [
    { venueCode: "06", year: 2027, kai: 2, nichi: 9 }, // 2回中山9日
    { venueCode: "07", year: 2027, kai: 1, nichi: 4 }  // 1回中京4日
  ],
  "2027-03-27": [
    { venueCode: "06", year: 2027, kai: 3, nichi: 1 }, // 3回中山1日
    { venueCode: "07", year: 2027, kai: 1, nichi: 5 }, // 1回中京5日
    { venueCode: "09", year: 2027, kai: 2, nichi: 1 }  // 2回阪神1日
  ],
  "2027-03-28": [
    { venueCode: "06", year: 2027, kai: 3, nichi: 2 }, // 3回中山2日
    { venueCode: "07", year: 2027, kai: 1, nichi: 6 }, // 1回中京6日
    { venueCode: "09", year: 2027, kai: 2, nichi: 2 }  // 2回阪神2日
  ],

  // === 4月 ===
  "2027-04-03": [
    { venueCode: "06", year: 2027, kai: 3, nichi: 3 }, // 3回中山3日
    { venueCode: "09", year: 2027, kai: 2, nichi: 3 }  // 2回阪神3日
  ],
  "2027-04-04": [
    { venueCode: "06", year: 2027, kai: 3, nichi: 4 }, // 3回中山4日
    { venueCode: "09", year: 2027, kai: 2, nichi: 4 }  // 2回阪神4日
  ],
  "2027-04-10": [
    { venueCode: "03", year: 2027, kai: 1, nichi: 1 }, // 1回福島1日
    { venueCode: "06", year: 2027, kai: 3, nichi: 5 }, // 3回中山5日
    { venueCode: "09", year: 2027, kai: 2, nichi: 5 }  // 2回阪神5日
  ],
  "2027-04-11": [
    { venueCode: "03", year: 2027, kai: 1, nichi: 2 }, // 1回福島2日
    { venueCode: "06", year: 2027, kai: 3, nichi: 6 }, // 3回中山6日
    { venueCode: "09", year: 2027, kai: 2, nichi: 6 }  // 2回阪神6日
  ],
  "2027-04-17": [
    { venueCode: "03", year: 2027, kai: 1, nichi: 3 }, // 1回福島3日
    { venueCode: "06", year: 2027, kai: 3, nichi: 7 }, // 3回中山7日
    { venueCode: "09", year: 2027, kai: 2, nichi: 7 }  // 2回阪神7日
  ],
  "2027-04-18": [
    { venueCode: "03", year: 2027, kai: 1, nichi: 4 }, // 1回福島4日
    { venueCode: "06", year: 2027, kai: 3, nichi: 8 }, // 3回中山8日
    { venueCode: "09", year: 2027, kai: 2, nichi: 8 }  // 2回阪神8日
  ],
  "2027-04-24": [
    { venueCode: "03", year: 2027, kai: 1, nichi: 5 }, // 1回福島5日
    { venueCode: "05", year: 2027, kai: 2, nichi: 1 }, // 2回東京1日
    { venueCode: "09", year: 2027, kai: 2, nichi: 9 }  // 2回阪神9日
  ],
  "2027-04-25": [
    { venueCode: "03", year: 2027, kai: 1, nichi: 6 }, // 1回福島6日
    { venueCode: "05", year: 2027, kai: 2, nichi: 2 }, // 2回東京2日
    { venueCode: "09", year: 2027, kai: 2, nichi: 10 }  // 2回阪神10日
  ],

  // === 5月 ===
  "2027-05-01": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 1 }, // 1回新潟1日
    { venueCode: "05", year: 2027, kai: 2, nichi: 3 }, // 2回東京3日
    { venueCode: "08", year: 2027, kai: 3, nichi: 1 }  // 3回京都1日
  ],
  "2027-05-02": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 2 }, // 1回新潟2日
    { venueCode: "05", year: 2027, kai: 2, nichi: 4 }, // 2回東京4日
    { venueCode: "08", year: 2027, kai: 3, nichi: 2 }  // 3回京都2日
  ],
  "2027-05-08": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 3 }, // 1回新潟3日
    { venueCode: "05", year: 2027, kai: 2, nichi: 5 }, // 2回東京5日
    { venueCode: "08", year: 2027, kai: 3, nichi: 3 }  // 3回京都3日
  ],
  "2027-05-09": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 4 }, // 1回新潟4日
    { venueCode: "05", year: 2027, kai: 2, nichi: 6 }, // 2回東京6日
    { venueCode: "08", year: 2027, kai: 3, nichi: 4 }  // 3回京都4日
  ],
  "2027-05-15": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 5 }, // 1回新潟5日
    { venueCode: "05", year: 2027, kai: 2, nichi: 7 }, // 2回東京7日
    { venueCode: "08", year: 2027, kai: 3, nichi: 5 }  // 3回京都5日
  ],
  "2027-05-16": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 6 }, // 1回新潟6日
    { venueCode: "05", year: 2027, kai: 2, nichi: 8 }, // 2回東京8日
    { venueCode: "08", year: 2027, kai: 3, nichi: 6 }  // 3回京都6日
  ],
  "2027-05-22": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 7 }, // 1回新潟7日
    { venueCode: "05", year: 2027, kai: 2, nichi: 9 }, // 2回東京9日
    { venueCode: "08", year: 2027, kai: 3, nichi: 7 }  // 3回京都7日
  ],
  "2027-05-23": [
    { venueCode: "04", year: 2027, kai: 1, nichi: 8 }, // 1回新潟8日
    { venueCode: "05", year: 2027, kai: 2, nichi: 10 }, // 2回東京10日
    { venueCode: "08", year: 2027, kai: 3, nichi: 8 }  // 3回京都8日
  ],
  "2027-05-29": [
    { venueCode: "05", year: 2027, kai: 2, nichi: 11 }, // 2回東京11日
    { venueCode: "08", year: 2027, kai: 3, nichi: 9 }  // 3回京都9日
  ],
  "2027-05-30": [
    { venueCode: "05", year: 2027, kai: 2, nichi: 12 }, // 2回東京12日
    { venueCode: "08", year: 2027, kai: 3, nichi: 10 }  // 3回京都10日
  ],

  // === 6月 ===
  "2027-06-05": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 1 }, // 1回函館1日
    { venueCode: "05", year: 2027, kai: 3, nichi: 1 }, // 3回東京1日
    { venueCode: "09", year: 2027, kai: 3, nichi: 1 }  // 3回阪神1日
  ],
  "2027-06-06": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 2 }, // 1回函館2日
    { venueCode: "05", year: 2027, kai: 3, nichi: 2 }, // 3回東京2日
    { venueCode: "09", year: 2027, kai: 3, nichi: 2 }  // 3回阪神2日
  ],
  "2027-06-12": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 3 }, // 1回函館3日
    { venueCode: "05", year: 2027, kai: 3, nichi: 3 }, // 3回東京3日
    { venueCode: "09", year: 2027, kai: 3, nichi: 3 }  // 3回阪神3日
  ],
  "2027-06-13": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 4 }, // 1回函館4日
    { venueCode: "05", year: 2027, kai: 3, nichi: 4 }, // 3回東京4日
    { venueCode: "09", year: 2027, kai: 3, nichi: 4 }  // 3回阪神4日
  ],
  "2027-06-19": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 5 }, // 1回函館5日
    { venueCode: "05", year: 2027, kai: 3, nichi: 5 }, // 3回東京5日
    { venueCode: "09", year: 2027, kai: 3, nichi: 5 }  // 3回阪神5日
  ],
  "2027-06-20": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 6 }, // 1回函館6日
    { venueCode: "05", year: 2027, kai: 3, nichi: 6 }, // 3回東京6日
    { venueCode: "09", year: 2027, kai: 3, nichi: 6 }  // 3回阪神6日
  ],
  "2027-06-26": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 7 }, // 1回函館7日
    { venueCode: "03", year: 2027, kai: 2, nichi: 1 }, // 2回福島1日
    { venueCode: "10", year: 2027, kai: 3, nichi: 1 }  // 3回小倉1日
  ],
  "2027-06-27": [
    { venueCode: "02", year: 2027, kai: 1, nichi: 8 }, // 1回函館8日
    { venueCode: "03", year: 2027, kai: 2, nichi: 2 }, // 2回福島2日
    { venueCode: "10", year: 2027, kai: 3, nichi: 2 }  // 3回小倉2日
  ],

  // === 7月 ===
  "2027-07-03": [
    { venueCode: "01", year: 2027, kai: 1, nichi: 1 }, // 1回札幌1日
    { venueCode: "03", year: 2027, kai: 2, nichi: 3 }, // 2回福島3日
    { venueCode: "10", year: 2027, kai: 3, nichi: 3 }  // 3回小倉3日
  ],
  "2027-07-04": [
    { venueCode: "01", year: 2027, kai: 1, nichi: 2 }, // 1回札幌2日
    { venueCode: "03", year: 2027, kai: 2, nichi: 4 }, // 2回福島4日
    { venueCode: "10", year: 2027, kai: 3, nichi: 4 }  // 3回小倉4日
  ],
  "2027-07-10": [
    { venueCode: "01", year: 2027, kai: 1, nichi: 3 }, // 1回札幌3日
    { venueCode: "03", year: 2027, kai: 2, nichi: 5 }, // 2回福島5日
    { venueCode: "10", year: 2027, kai: 3, nichi: 5 }  // 3回小倉5日
  ],
  "2027-07-11": [
    { venueCode: "01", year: 2027, kai: 1, nichi: 4 }, // 1回札幌4日
    { venueCode: "03", year: 2027, kai: 2, nichi: 6 }, // 2回福島6日
    { venueCode: "10", year: 2027, kai: 3, nichi: 6 }  // 3回小倉6日
  ],
  "2027-07-17": [
    { venueCode: "01", year: 2027, kai: 1, nichi: 5 }, // 1回札幌5日
    { venueCode: "03", year: 2027, kai: 2, nichi: 7 }, // 2回福島7日
    { venueCode: "10", year: 2027, kai: 3, nichi: 7 }  // 3回小倉7日
  ],
  "2027-07-18": [
    { venueCode: "01", year: 2027, kai: 1, nichi: 6 }, // 1回札幌6日
    { venueCode: "03", year: 2027, kai: 2, nichi: 8 }, // 2回福島8日
    { venueCode: "10", year: 2027, kai: 3, nichi: 8 }  // 3回小倉8日
  ],
  "2027-07-24": [
    { venueCode: "02", year: 2027, kai: 2, nichi: 1 }, // 2回函館1日
    { venueCode: "04", year: 2027, kai: 2, nichi: 1 }, // 2回新潟1日
    { venueCode: "07", year: 2027, kai: 2, nichi: 1 }  // 2回中京1日
  ],
  "2027-07-25": [
    { venueCode: "02", year: 2027, kai: 2, nichi: 2 }, // 2回函館2日
    { venueCode: "04", year: 2027, kai: 2, nichi: 2 }, // 2回新潟2日
    { venueCode: "07", year: 2027, kai: 2, nichi: 2 }  // 2回中京2日
  ],
  "2027-07-31": [
    { venueCode: "02", year: 2027, kai: 2, nichi: 3 }, // 2回函館3日
    { venueCode: "04", year: 2027, kai: 2, nichi: 3 }, // 2回新潟3日
    { venueCode: "07", year: 2027, kai: 2, nichi: 3 }  // 2回中京3日
  ],

  // === 8月 ===
  "2027-08-01": [
    { venueCode: "02", year: 2027, kai: 2, nichi: 4 }, // 2回函館4日
    { venueCode: "04", year: 2027, kai: 2, nichi: 4 }, // 2回新潟4日
    { venueCode: "07", year: 2027, kai: 2, nichi: 4 }  // 2回中京4日
  ],
  "2027-08-07": [
    { venueCode: "02", year: 2027, kai: 2, nichi: 5 }, // 2回函館5日
    { venueCode: "04", year: 2027, kai: 2, nichi: 5 }, // 2回新潟5日
    { venueCode: "07", year: 2027, kai: 2, nichi: 5 }  // 2回中京5日
  ],
  "2027-08-08": [
    { venueCode: "02", year: 2027, kai: 2, nichi: 6 }, // 2回函館6日
    { venueCode: "04", year: 2027, kai: 2, nichi: 6 }, // 2回新潟6日
    { venueCode: "07", year: 2027, kai: 2, nichi: 6 }  // 2回中京6日
  ],
  "2027-08-14": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 1 }, // 2回札幌1日
    { venueCode: "04", year: 2027, kai: 2, nichi: 7 }, // 2回新潟7日
    { venueCode: "07", year: 2027, kai: 2, nichi: 7 }  // 2回中京7日
  ],
  "2027-08-15": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 2 }, // 2回札幌2日
    { venueCode: "04", year: 2027, kai: 2, nichi: 8 }, // 2回新潟8日
    { venueCode: "07", year: 2027, kai: 2, nichi: 8 }  // 2回中京8日
  ],
  "2027-08-21": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 3 }, // 2回札幌3日
    { venueCode: "04", year: 2027, kai: 2, nichi: 9 }, // 2回新潟9日
    { venueCode: "07", year: 2027, kai: 2, nichi: 9 }  // 2回中京9日
  ],
  "2027-08-22": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 4 }, // 2回札幌4日
    { venueCode: "04", year: 2027, kai: 2, nichi: 10 }, // 2回新潟10日
    { venueCode: "07", year: 2027, kai: 2, nichi: 10 }  // 2回中京10日
  ],
  "2027-08-28": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 5 }, // 2回札幌5日
    { venueCode: "04", year: 2027, kai: 2, nichi: 11 }, // 2回新潟11日
    { venueCode: "07", year: 2027, kai: 2, nichi: 11 }  // 2回中京11日
  ],
  "2027-08-29": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 6 }, // 2回札幌6日
    { venueCode: "04", year: 2027, kai: 2, nichi: 12 }, // 2回新潟12日
    { venueCode: "07", year: 2027, kai: 2, nichi: 12 }  // 2回中京12日
  ],

  // === 9月 ===
  "2027-09-04": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 7 }, // 2回札幌7日
    { venueCode: "06", year: 2027, kai: 4, nichi: 1 }, // 4回中山1日
    { venueCode: "09", year: 2027, kai: 4, nichi: 1 }  // 4回阪神1日
  ],
  "2027-09-05": [
    { venueCode: "01", year: 2027, kai: 2, nichi: 8 }, // 2回札幌8日
    { venueCode: "06", year: 2027, kai: 4, nichi: 2 }, // 4回中山2日
    { venueCode: "09", year: 2027, kai: 4, nichi: 2 }  // 4回阪神2日
  ],
  "2027-09-11": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 3 }, // 4回中山3日
    { venueCode: "09", year: 2027, kai: 4, nichi: 3 }  // 4回阪神3日
  ],
  "2027-09-12": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 4 }, // 4回中山4日
    { venueCode: "09", year: 2027, kai: 4, nichi: 4 }  // 4回阪神4日
  ],
  "2027-09-18": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 5 }, // 4回中山5日
    { venueCode: "09", year: 2027, kai: 4, nichi: 5 }  // 4回阪神5日
  ],
  "2027-09-19": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 6 }, // 4回中山6日
    { venueCode: "09", year: 2027, kai: 4, nichi: 6 }  // 4回阪神6日
  ],
  "2027-09-20": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 7 }, // 4回中山7日
    { venueCode: "09", year: 2027, kai: 4, nichi: 7 }  // 4回阪神7日
  ],
  "2027-09-25": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 8 }, // 4回中山8日
    { venueCode: "09", year: 2027, kai: 4, nichi: 8 }  // 4回阪神8日
  ],
  "2027-09-26": [
    { venueCode: "06", year: 2027, kai: 4, nichi: 9 }, // 4回中山9日
    { venueCode: "09", year: 2027, kai: 4, nichi: 9 }  // 4回阪神9日
  ],

  // === 10月 ===
  "2027-10-02": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 1 }, // 4回東京1日
    { venueCode: "08", year: 2027, kai: 4, nichi: 1 }  // 4回京都1日
  ],
  "2027-10-03": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 2 }, // 4回東京2日
    { venueCode: "08", year: 2027, kai: 4, nichi: 2 }  // 4回京都2日
  ],
  "2027-10-09": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 3 }, // 4回東京3日
    { venueCode: "08", year: 2027, kai: 4, nichi: 3 }  // 4回京都3日
  ],
  "2027-10-10": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 4 }, // 4回東京4日
    { venueCode: "08", year: 2027, kai: 4, nichi: 4 }  // 4回京都4日
  ],
  "2027-10-11": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 5 }, // 4回東京5日
    { venueCode: "08", year: 2027, kai: 4, nichi: 5 }  // 4回京都5日
  ],
  "2027-10-16": [
    { venueCode: "04", year: 2027, kai: 3, nichi: 1 }, // 3回新潟1日
    { venueCode: "05", year: 2027, kai: 4, nichi: 6 }, // 4回東京6日
    { venueCode: "08", year: 2027, kai: 4, nichi: 6 }  // 4回京都6日
  ],
  "2027-10-17": [
    { venueCode: "04", year: 2027, kai: 3, nichi: 2 }, // 3回新潟2日
    { venueCode: "05", year: 2027, kai: 4, nichi: 7 }, // 4回東京7日
    { venueCode: "08", year: 2027, kai: 4, nichi: 7 }  // 4回京都7日
  ],
  "2027-10-23": [
    { venueCode: "04", year: 2027, kai: 3, nichi: 3 }, // 3回新潟3日
    { venueCode: "05", year: 2027, kai: 4, nichi: 8 }, // 4回東京8日
    { venueCode: "08", year: 2027, kai: 4, nichi: 8 }  // 4回京都8日
  ],
  "2027-10-24": [
    { venueCode: "04", year: 2027, kai: 3, nichi: 4 }, // 3回新潟4日
    { venueCode: "05", year: 2027, kai: 4, nichi: 9 }, // 4回東京9日
    { venueCode: "08", year: 2027, kai: 4, nichi: 9 }  // 4回京都9日
  ],
  "2027-10-30": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 10 }, // 4回東京10日
    { venueCode: "08", year: 2027, kai: 4, nichi: 10 }  // 4回京都10日
  ],
  "2027-10-31": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 11 }, // 4回東京11日
    { venueCode: "08", year: 2027, kai: 4, nichi: 11 }  // 4回京都11日
  ],

  // === 11月 ===
  "2027-11-01": [
    { venueCode: "05", year: 2027, kai: 4, nichi: 12 }, // 4回東京12日
    { venueCode: "08", year: 2027, kai: 4, nichi: 12 }  // 4回京都12日
  ],
  "2027-11-06": [
    { venueCode: "03", year: 2027, kai: 3, nichi: 1 }, // 3回福島1日
    { venueCode: "05", year: 2027, kai: 5, nichi: 1 }, // 5回東京1日
    { venueCode: "08", year: 2027, kai: 5, nichi: 1 }  // 5回京都1日
  ],
  "2027-11-07": [
    { venueCode: "03", year: 2027, kai: 3, nichi: 2 }, // 3回福島2日
    { venueCode: "05", year: 2027, kai: 5, nichi: 2 }, // 5回東京2日
    { venueCode: "08", year: 2027, kai: 5, nichi: 2 }  // 5回京都2日
  ],
  "2027-11-13": [
    { venueCode: "03", year: 2027, kai: 3, nichi: 3 }, // 3回福島3日
    { venueCode: "05", year: 2027, kai: 5, nichi: 3 }, // 5回東京3日
    { venueCode: "08", year: 2027, kai: 5, nichi: 3 }  // 5回京都3日
  ],
  "2027-11-14": [
    { venueCode: "03", year: 2027, kai: 3, nichi: 4 }, // 3回福島4日
    { venueCode: "05", year: 2027, kai: 5, nichi: 4 }, // 5回東京4日
    { venueCode: "08", year: 2027, kai: 5, nichi: 4 }  // 5回京都4日
  ],
  "2027-11-20": [
    { venueCode: "03", year: 2027, kai: 3, nichi: 5 }, // 3回福島5日
    { venueCode: "05", year: 2027, kai: 5, nichi: 5 }, // 5回東京5日
    { venueCode: "08", year: 2027, kai: 5, nichi: 5 }  // 5回京都5日
  ],
  "2027-11-21": [
    { venueCode: "03", year: 2027, kai: 3, nichi: 6 }, // 3回福島6日
    { venueCode: "05", year: 2027, kai: 5, nichi: 6 }, // 5回東京6日
    { venueCode: "08", year: 2027, kai: 5, nichi: 6 }  // 5回京都6日
  ],
  "2027-11-27": [
    { venueCode: "05", year: 2027, kai: 5, nichi: 7 }, // 5回東京7日
    { venueCode: "08", year: 2027, kai: 5, nichi: 7 }  // 5回京都7日
  ],
  "2027-11-28": [
    { venueCode: "05", year: 2027, kai: 5, nichi: 8 }, // 5回東京8日
    { venueCode: "08", year: 2027, kai: 5, nichi: 8 }  // 5回京都8日
  ],
  "2027-11-29": [
    { venueCode: "05", year: 2027, kai: 5, nichi: 9 }, // 5回東京9日
    { venueCode: "08", year: 2027, kai: 5, nichi: 9 }  // 5回京都9日
  ],

  // === 12月 ===
  "2027-12-04": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 1 }, // 5回中山1日
    { venueCode: "07", year: 2027, kai: 3, nichi: 1 }, // 3回中京1日
    { venueCode: "09", year: 2027, kai: 5, nichi: 1 }  // 5回阪神1日
  ],
  "2027-12-05": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 2 }, // 5回中山2日
    { venueCode: "07", year: 2027, kai: 3, nichi: 2 }, // 3回中京2日
    { venueCode: "09", year: 2027, kai: 5, nichi: 2 }  // 5回阪神2日
  ],
  "2027-12-11": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 3 }, // 5回中山3日
    { venueCode: "07", year: 2027, kai: 3, nichi: 3 }, // 3回中京3日
    { venueCode: "09", year: 2027, kai: 5, nichi: 3 }  // 5回阪神3日
  ],
  "2027-12-12": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 4 }, // 5回中山4日
    { venueCode: "07", year: 2027, kai: 3, nichi: 4 }, // 3回中京4日
    { venueCode: "09", year: 2027, kai: 5, nichi: 4 }  // 5回阪神4日
  ],
  "2027-12-18": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 5 }, // 5回中山5日
    { venueCode: "07", year: 2027, kai: 3, nichi: 5 }, // 3回中京5日
    { venueCode: "09", year: 2027, kai: 5, nichi: 5 }  // 5回阪神5日
  ],
  "2027-12-19": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 6 }, // 5回中山6日
    { venueCode: "07", year: 2027, kai: 3, nichi: 6 }, // 3回中京6日
    { venueCode: "09", year: 2027, kai: 5, nichi: 6 }  // 5回阪神6日
  ],
  "2027-12-25": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 7 }, // 5回中山7日
    { venueCode: "09", year: 2027, kai: 5, nichi: 7 }  // 5回阪神7日
  ],
  "2027-12-26": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 8 }, // 5回中山8日
    { venueCode: "09", year: 2027, kai: 5, nichi: 8 }  // 5回阪神8日
  ],
  "2027-12-28": [
    { venueCode: "06", year: 2027, kai: 5, nichi: 9 }, // 5回中山9日
    { venueCode: "09", year: 2027, kai: 5, nichi: 9 }  // 5回阪神9日
  ]
};
