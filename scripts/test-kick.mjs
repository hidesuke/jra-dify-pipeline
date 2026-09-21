#!/usr/bin/env node
/**
 * 予想キック画面の開催週・フォーム HTML。
 * Usage: node --experimental-strip-types scripts/test-kick.mjs
 */

import {
  dateKeysInJstWeek,
  getKickMeetings,
  pickDefaultMeetingDate,
  weekdayJp,
} from "../src/schedules/index.ts";
import {
  acceptsHtml,
  kickFormHtml,
  renderKickForm,
  renderKickResult,
  wantsKickForm,
} from "../src/kickForm.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

const weekSun = dateKeysInJstWeek("2026-09-20");
assert(weekSun[0] === "2026-09-14", `week from Sunday starts Monday, got ${weekSun[0]}`);
assert(weekSun[weekSun.length - 1] === "2026-09-22", `week includes next Tuesday (substitute), got ${weekSun.at(-1)}`);
assert(weekSun.includes("2026-09-19") && weekSun.includes("2026-09-20"), "weekend dates are in this week");

const weekFri = dateKeysInJstWeek("2026-09-18");
assert(weekFri[0] === "2026-09-14" && weekFri.at(-1) === "2026-09-22", "Friday uses the same racing week");

assert(weekdayJp("2026-09-21") === "月", "2026-09-21 is Monday");
assert(weekdayJp("2026-09-22") === "火", "2026-09-22 is Tuesday");

const meetings = getKickMeetings("2026-09-20");
const dates = meetings.map((m) => m.date);
assert(
  dates.includes("2026-09-19") &&
    dates.includes("2026-09-20") &&
    dates.includes("2026-09-21") &&
    dates.includes("2026-09-22"),
  `this week meetings: ${dates.join(",")}`
);
assert(!dates.includes("2026-09-26"), "next weekend is not this week");

const sep21 = meetings.find((m) => m.date === "2026-09-21");
assert(!sep21?.venues.some((v) => v.venueCode === "06"), "Keiro no hi Nakayama moved off 09-21");
assert(sep21?.venues.some((v) => v.venueCode === "09" && v.venueName === "阪神"), "Keiro no hi still includes Hanshin");
assert(sep21?.label.includes("月") && sep21?.label.includes("阪神"), `label is JP: ${sep21?.label}`);

const sep22 = meetings.find((m) => m.date === "2026-09-22");
assert(sep22?.venues.some((v) => v.venueCode === "06" && v.venueName === "中山" && v.nichi === 7), "substitute Tue is Nakayama 4回7日");
assert(sep22?.label.includes("火") && sep22?.label.includes("中山"), `substitute label: ${sep22?.label}`);

assert(pickDefaultMeetingDate(meetings, "2026-09-20") === "2026-09-20", "today is selected when it has races");
assert(pickDefaultMeetingDate(getKickMeetings("2026-09-18"), "2026-09-18") === "2026-09-19", "Friday defaults to Saturday");

const monMeetings = getKickMeetings("2026-09-21");
assert(monMeetings[0].date === "2026-09-21", `Monday week starts at holiday meeting, got ${monMeetings[0].date}`);
assert(monMeetings.some((m) => m.date === "2026-09-22"), "Monday week includes Tuesday substitute");
assert(monMeetings.some((m) => m.date === "2026-09-26"), "Monday week still includes next weekend");

const tueMeetings = getKickMeetings("2026-09-22");
assert(tueMeetings.some((m) => m.date === "2026-09-22"), "Tuesday kick lists substitute Nakayama");
assert(pickDefaultMeetingDate(tueMeetings, "2026-09-22") === "2026-09-22", "substitute day is default on that day");

const yearEnd = getKickMeetings("2026-12-28");
assert(
  yearEnd.some((m) => m.date === "2026-12-26") && yearEnd.some((m) => m.date === "2026-12-27"),
  `empty week falls back to nearby meetings: ${yearEnd.map((m) => m.date).join(",")}`
);

const html = kickFormHtml({ todayKey: "2026-09-20" });
assert(html.includes("<select id=\"date\""), "date select");
assert(html.includes("<select id=\"venue\""), "venue select");
assert(html.includes("<select id=\"race\""), "race select");
assert(html.includes("全ての場"), "venue optional = all venues");
assert(html.includes("全レース（1〜12R）"), "race optional = all races");
assert(html.includes('value="1">1R') && html.includes('value="12">12R'), "races 1-12");
assert(html.includes("/baba/latest?format=text"), "link to baba");
assert(html.includes('href="/seed"'), "link to seed form");
assert(html.includes("中山") && html.includes("阪神"), "this week venues in the form");
assert(html.includes("9月21日"), "holiday Monday is selectable");
assert(html.includes("9月22日"), "Tuesday substitute is selectable");
assert(html.includes('method="post"'), "form posts to current URL");

const page = renderKickForm({ todayKey: "2026-09-20" });
assert(page.headers.get("Content-Type")?.includes("text/html"), "form is HTML");
assert(page.status === 200, "form status 200");

const errPage = renderKickForm({ todayKey: "2026-09-20", error: "No venue 05 on 2026-09-20" }, 404);
assert(errPage.status === 404, "form can return 404 with error");
const errHtml = await errPage.text();
assert(errHtml.includes("No venue 05"), "error is shown");

const resultPage = renderKickResult({
  ok: true,
  text: "Enqueued 1 races for 2026-09-21\n06:1R https://example.test\n",
});
const resultHtml = await resultPage.text();
assert(resultHtml.includes("キューに投入しました"), "success heading");
assert(resultHtml.includes("/baba/latest") && resultHtml.includes("/seed"), "result has other links");
assert(resultHtml.includes('href="/kick"'), "back to form");

const failPage = renderKickResult({
  ok: false,
  status: 422,
  text: "No races enqueued\n",
  error: "1R URL の検証に失敗したため投入しませんでした。",
});
assert(failPage.status === 422, "failure keeps 422");

const htmlReq = new Request("https://example.test/run", {
  headers: { Accept: "text/html,application/xhtml+xml" },
});
assert(acceptsHtml(htmlReq) && wantsKickForm(htmlReq), "browser GET /run shows form");

const dated = new Request("https://example.test/run?date=2026-09-21", {
  headers: { Accept: "text/html" },
});
assert(!wantsKickForm(dated), "browser GET /run?date= still executes");

const curlReq = new Request("https://example.test/run", {
  headers: { Accept: "*/*" },
});
assert(!wantsKickForm(curlReq), "curl GET /run still executes");

const postReq = new Request("https://example.test/kick", {
  method: "POST",
  headers: { Accept: "text/html" },
});
assert(!wantsKickForm(postReq), "POST is not the form GET");

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll kick form assertions passed");
