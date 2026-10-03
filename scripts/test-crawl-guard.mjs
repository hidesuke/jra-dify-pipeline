#!/usr/bin/env node
/**
 * クローリング対策（robots.txt / X-Robots-Tag / HTML meta）。
 * Usage: node --experimental-strip-types scripts/test-crawl-guard.mjs
 */

import {
  X_ROBOTS_TAG,
  robotsTxtBody,
  robotsTxtResponse,
  withNoindex,
} from "../src/crawlGuard.ts";
import { htmlPage } from "../src/html.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

const body = robotsTxtBody();
assert(body.includes("User-agent: *"), "robots has wildcard UA");
assert(body.includes("Disallow: /"), "robots disallows all");
assert(body.includes("User-agent: GPTBot"), "robots mentions GPTBot");
assert(body.includes("User-agent: ClaudeBot"), "robots mentions ClaudeBot");
assert(body.includes("User-agent: Bytespider"), "robots mentions Bytespider");

const robotsRes = robotsTxtResponse();
assert(robotsRes.status === 200, "robots response 200");
assert(robotsRes.headers.get("Content-Type")?.includes("text/plain"), "robots content-type");
assert(robotsRes.headers.get("X-Robots-Tag") === X_ROBOTS_TAG, "robots has X-Robots-Tag");

const plain = new Response("ok\n", { headers: { "Content-Type": "text/plain" } });
const guarded = withNoindex(plain);
assert(guarded.headers.get("X-Robots-Tag") === X_ROBOTS_TAG, "withNoindex adds tag");
assert((await guarded.text()) === "ok\n", "withNoindex keeps body");

const already = withNoindex(
  new Response("x", { headers: { "X-Robots-Tag": "noindex" } })
);
assert(already.headers.get("X-Robots-Tag") === "noindex", "withNoindex respects existing tag");

const page = htmlPage("t", "<p>hi</p>");
const html = await page.text();
assert(html.includes('name="robots" content="noindex, nofollow, noarchive"'), "HTML meta robots");
assert(page.headers.get("X-Robots-Tag") === X_ROBOTS_TAG, "HTML response has X-Robots-Tag");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll crawl-guard tests passed");
