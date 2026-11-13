#!/usr/bin/env node
/**
 * scheduled は金・土 16:45 JST の発火で、JST 翌日の開催を Queue に入れる。
 * Usage: node --experimental-strip-types scripts/test-scheduled.mjs
 */

import { readFileSync } from "node:fs";
import worker, { jstDateKey } from "../src/index.ts";
import { getSchedulesForDate } from "../src/schedules/index.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const cronsBody = wrangler.match(/"crons"\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const crons = [...cronsBody.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
assert(
  crons.length === 2 && crons[0] === "45 7 * * FRI" && crons[1] === "45 7 * * SAT",
  `crons are Fri/Sat 16:45 JST, got ${crons.join(" | ") || "(none)"}`
);

// 16:45 JST = 07:45 UTC。日付の境界は JST。
assert(
  jstDateKey(new Date("2026-11-13T07:44:00.000Z"), 1) === "2026-11-14",
  "Friday 16:44 JST still targets Saturday"
);
assert(
  jstDateKey(new Date("2026-11-13T07:45:00.000Z"), 1) === "2026-11-14",
  "Friday 16:45 JST targets Saturday"
);
assert(
  jstDateKey(new Date("2026-11-13T14:59:00.000Z"), 1) === "2026-11-14",
  "Friday 23:59 JST still targets Saturday"
);
assert(
  jstDateKey(new Date("2026-11-13T15:00:00.000Z"), 1) === "2026-11-15",
  "Saturday 00:00 JST targets Sunday (not UTC tomorrow)"
);
assert(
  jstDateKey(new Date("2026-11-14T07:45:00.000Z"), 1) === "2026-11-15",
  "Saturday 16:45 JST targets Sunday"
);

function installFetch(errorVenues = []) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    const venue = url.match(/CNAME=pw01dde01(\d{2})/)?.[1];
    if (venue && errorVenues.includes(venue)) {
      return new Response('<html><link rel="stylesheet" href="error.css"></html>', { status: 200 });
    }
    if (url.includes("accessD.html")) {
      return new Response('<html><div class="race_title"></div></html>', { status: 200 });
    }
    return new Response("<html></html>", { status: 200 });
  };
  return () => {
    globalThis.fetch = original;
  };
}

function queueEnv() {
  const batches = [];
  return {
    env: {
      RACE_QUEUE: {
        async sendBatch(messages) {
          batches.push(messages);
        },
      },
    },
    messages() {
      return batches.flat();
    },
  };
}

async function withFrozenNow(iso, fn) {
  const RealDate = Date;
  const fixed = new RealDate(iso).getTime();
  globalThis.Date = class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  };
  try {
    await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

function assertCard(messages, date, label, skippedVenues = []) {
  const schedules = getSchedulesForDate(date) ?? [];
  const venues = schedules.map((s) => s.venueCode).filter((code) => !skippedVenues.includes(code));
  assert(schedules.length > 0, `${label}: ${date} is a meeting day`);
  assert(
    messages.length === venues.length * 12,
    `${label}: enqueued ${messages.length}, expected ${venues.length * 12}`
  );
  assert(
    messages.every((m) => m.body.targetDate === date),
    `${label}: every message is ${date}`
  );
  const compact = date.replaceAll("-", "");
  for (const venue of venues) {
    const races = messages
      .filter((m) => m.body.venueCode === venue)
      .map((m) => m.body.raceNo)
      .sort((a, b) => a - b);
    assert(
      races.join(",") === "1,2,3,4,5,6,7,8,9,10,11,12",
      `${label}: ${venue} races ${races.join(",")}`
    );
    assert(
      messages
        .filter((m) => m.body.venueCode === venue)
        .every((m) => m.body.raceUrl.includes(compact)),
      `${label}: ${venue} URLs include ${compact}`
    );
  }
  for (const venue of skippedVenues) {
    assert(
      messages.every((m) => m.body.venueCode !== venue),
      `${label}: error-page venue ${venue} is not enqueued`
    );
  }
}

async function fire(iso, cron, errorVenues = []) {
  const restoreFetch = installFetch(errorVenues);
  const queue = queueEnv();
  try {
    await withFrozenNow(iso, () =>
      worker.scheduled(
        { cron, scheduledTime: Date.parse(iso), type: "scheduled" },
        queue.env,
        {}
      )
    );
  } finally {
    restoreFetch();
  }
  return queue.messages();
}

const friday = await fire("2026-11-13T07:45:00.000Z", "45 7 * * FRI");
assertCard(friday, "2026-11-14", "Friday 16:45 JST");

const saturday = await fire("2026-11-14T07:45:00.000Z", "45 7 * * SAT");
assertCard(saturday, "2026-11-15", "Saturday 16:45 JST");

const afterMidnightJst = await fire("2026-11-13T15:00:00.000Z", "45 7 * * FRI");
assertCard(afterMidnightJst, "2026-11-15", "JST midnight uses JST tomorrow");

const noMeeting = await fire("2026-11-15T07:45:00.000Z", "45 7 * * SAT");
assert(getSchedulesForDate("2026-11-16") == null, "2026-11-16 has no meeting");
assert(noMeeting.length === 0, `no enqueue when tomorrow has no races, got ${noMeeting.length}`);

const schedules = getSchedulesForDate("2026-11-14") ?? [];
const skipped = schedules[0]?.venueCode;
assert(Boolean(skipped), "fixture venue to mark as an error page");
const partial = await fire("2026-11-13T07:45:00.000Z", "45 7 * * FRI", [skipped]);
assertCard(partial, "2026-11-14", "error page venue skipped", [skipped]);

if (failed > 0) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("scheduled tests passed");
