#!/usr/bin/env node
/**
 * 馬場パースと GET /baba/latest 用の最新-only 整形。
 * Usage: node --experimental-strip-types scripts/test-baba.mjs
 */

import {
  parseCushionHtml,
  parseMoistHtml,
  mergeBaba,
  buildLatestBaba,
  resolveVenueKey,
  formatMoistureForApi,
  formatBabaSummary,
} from "../src/baba.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

const cushionHtml = `
<div id="cushion_data_list">
<div id="rcA" title="中山">
<div class="unit">
<div class="time">9月18日（金曜）10時30分</div>
<div class="cushion">9.6</div>
</div>
<div class="unit">
<div class="time">9月13日（日曜）7時00分</div>
<div class="cushion">8.2</div>
</div>
</div>
<div id="rcB" title="阪神">
<div class="unit">
<div class="time">9月18日（金曜）10時00分</div>
<div class="cushion">8.3</div>
</div>
</div>
</div>
`;

const moistHtml = `
<div id="moist_data_list">
<div id="rcA" title="中山">
<div class="unit">
<div class="time">9月18日（金曜）10時30分</div>
<div class="turf">
<span class="mg" data-condition="hard">13.1</span>
<span class="m4c" data-condition="hard">14.1</span>
</div>
<div class="dirt">
<span class="mg" data-condition="hard">7.3</span>
<span class="m4c" data-condition="hard">7.4</span>
</div>
<ul class="note_list narrow mt10 moist_caution">
<li>注記：特になし</li>
</ul>
</div>
<div class="unit">
<div class="time">9月13日（日曜）6時00分</div>
<div class="turf">
<span class="mg" data-condition="soft">13.5</span>
<span class="m4c" data-condition="soft">14.8</span>
</div>
<div class="dirt">
<span class="mg" data-condition="soft">14.1</span>
<span class="m4c" data-condition="soft">15.4</span>
</div>
<ul class="note_list narrow mt10 moist_caution">
<li>注記：測定時刻までの当日雨量は1.0ミリメートルでした</li>
</ul>
</div>
</div>
<div id="rcB" title="阪神">
<div class="unit">
<div class="time">9月18日（金曜）10時00分</div>
<div class="turf">
<span class="mg" data-condition="wet">14.0</span>
<span class="m4c" data-condition="hard">12.0</span>
</div>
<div class="dirt">
<span class="mg" data-condition="heavy">16.0</span>
<span class="m4c" data-condition="heavy">16.2</span>
</div>
</div>
</div>
</div>
`;

const venues = mergeBaba(parseCushionHtml(cushionHtml), parseMoistHtml(moistHtml));
assert(venues.length === 2, `two venues parsed (got ${venues.length})`);

const nakayama = venues.find((v) => v.venueCode === "06");
assert(nakayama?.measurements.length === 2, "中山 has two measurements (history kept in debug dump)");
assert(nakayama?.measurements[0].cushion === 9.6, "中山 latest cushion is 9.6 not 8.2");
assert(nakayama?.measurements[0].turf?.goal === 13.1, "中山 latest turf goal moisture is 13.1");
assert(nakayama?.measurements[1].rainfallMm === 1, "older 中山 measurement still has rainfall");

assert(resolveVenueKey("06")?.venueCode === "06", "resolve 06");
assert(resolveVenueKey("中山")?.venueCode === "06", "resolve 中山");
assert(resolveVenueKey("中山競馬場")?.venueCode === "06", "resolve 中山競馬場");
assert(resolveVenueKey("unknown") === null, "unknown venue is null");

const courseByVenue = new Map([
  [
    "06",
    {
      venueName: "中山",
      venueCode: "06",
      turfLength: { shibaNoshiba: "12から14", shibaYoshiba: null, shogaiNoshiba: "12から14", shogaiYoshiba: "12から16" },
      usedCourse: "Bコース（Aコースから3メートル外に内柵を設置）",
      turfCondition: "3コーナーから4コーナーの内柵沿いに傷みがあります。",
    },
  ],
]);

const latest = buildLatestBaba(venues, courseByVenue, { fetchedAt: "2026-09-18T12:00:00.000Z" });
assert(latest.venues.length === 2, `latest returns one row per venue (got ${latest.venues.length})`);
assert(
  latest.venues.every((v) => !("measurements" in v)),
  "latest payload has no measurements history"
);
assert(latest.venues[0].venueCode === "06", "first venue is 中山");
assert(latest.venues[0].cushion === 9.6, "latest 中山 cushion");
assert(latest.venues[0].turf?.condition === "良", `中山 turf condition 良 (got ${latest.venues[0].turf?.condition})`);
assert(latest.venues[0].dirt?.goal === 7.3, "中山 latest dirt, not Sunday 14.1");
assert(latest.venues[0].rainfallMm == null, "latest 中山 has no rainfall note");
assert(latest.venues[0].usedCourse?.includes("Bコース"), "course info attached");
assert(latest.venues[0].summary.includes("クッション値9.6"), `summary uses latest: ${latest.venues[0].summary}`);
assert(!latest.venues[0].summary.includes("8.2"), "summary does not include older cushion");
assert(latest.text.includes("中山(06)"), `text names 中山: ${latest.text}`);
assert(latest.text.includes("阪神(09)"), "text names 阪神");
assert(!latest.text.includes("9月13日"), "text omits older measurement");

const hanshin = latest.venues.find((v) => v.venueCode === "09");
assert(hanshin?.turf?.condition === "稍重" || hanshin?.turf?.goalCondition === "稍重", "阪神 turf mixed conditions");
assert(hanshin?.dirt?.condition === "不良", `阪神 dirt 不良 (got ${hanshin?.dirt?.condition})`);

const onlyNakayama = buildLatestBaba(venues, courseByVenue, { venueFilter: "06" });
assert(onlyNakayama.venues.length === 1 && onlyNakayama.venues[0].venueCode === "06", "venue=06 filters");
const byName = buildLatestBaba(venues, courseByVenue, { venueFilter: "阪神" });
assert(byName.venues.length === 1 && byName.venues[0].venueCode === "09", "venue=阪神 filters");
const unknown = buildLatestBaba(venues, courseByVenue, { venueFilter: "大井" });
assert(unknown.venues.length === 0 && unknown.text === "", "unknown venue yields empty latest payload");

const mixed = formatMoistureForApi({
  goal: 14,
  corner4: 12,
  goalCondition: "wet",
  corner4Condition: "hard",
});
assert(mixed?.goalCondition === "稍重" && mixed?.corner4Condition === "良", "mixed moisture keeps both JP labels");

const summary = formatBabaSummary(nakayama.measurements[0], courseByVenue.get("06"));
assert(summary.startsWith("馬場[9月18日（金曜）10時30分]"), `summary time ${summary}`);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll assertions passed");
