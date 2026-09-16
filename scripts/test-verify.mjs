#!/usr/bin/env node
/**
 * ローカル検証スクリプト（ネットワーク＋純関数）。
 * Usage: node scripts/test-verify.mjs
 */

function extractHtmlTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}
function isJraErrorPage(html) {
  const title = extractHtmlTitle(html) ?? "";
  if (title.includes("パラメータエラー")) return true;
  if (/error\.css/i.test(html) || /class="error_code"/i.test(html)) return true;
  if (html.includes("ご指定のページが見つかりませんでした")) return true;
  return false;
}
function looksLikeShutsubaPage(html) {
  const title = extractHtmlTitle(html) ?? "";
  if (title.includes("出馬表")) return true;
  return /class="race_title"/i.test(html);
}
function classifyRaceHtml(html) {
  const title = extractHtmlTitle(html);
  if (isJraErrorPage(html)) {
    return {
      kind: "error_page",
      title,
      reason: title?.includes("パラメータエラー")
        ? "パラメータエラーページ"
        : "エラーページマーカーを検出",
    };
  }
  if (looksLikeShutsubaPage(html)) {
    return { kind: "ok", title, reason: "出馬表ページ" };
  }
  return {
    kind: "error_page",
    title,
    reason: "出馬表マーカーがなく、想定外のページ",
  };
}

function formatRaceUrlFailureEmail({ date, failures }) {
  const venues = failures.map((f) => f.venueCode).join(",");
  const subject = `[jra-dify-pipeline] 馬柱URLエラー ${date} 場:${venues}`;
  const lines = [
    `対象日: ${date}`,
    `各場の 1R URL 検証でエラーを検出しました。`,
    ``,
    ...failures.flatMap((f) => [
      `--- 場 ${f.venueCode} ${f.raceNo}R (${f.kind}) ---`,
      `URL: ${f.url}`,
      `title: ${f.title ?? "(なし)"}`,
      `理由: ${f.reason ?? "(なし)"}`,
      ``,
    ]),
    `該当場のレースはキュー投入をスキップしています。`,
    `開催表（src/schedules）の回次・日次や PREFIX_CODE を確認してください。`,
  ];
  return { subject, text: lines.join("\n") };
}

async function fetchSjis(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buf);
}

const OK_URL =
  "https://jra.jp/JRADB/accessD.html?CNAME=pw01dde0106202604030120260912/4B";
const BAD_URL =
  "https://jra.jp/JRADB/accessD.html?CNAME=pw01dde0106202604030120260912/00";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

const okHtml = await fetchSjis(OK_URL);
const badHtml = await fetchSjis(BAD_URL);
const ok = classifyRaceHtml(okHtml);
const bad = classifyRaceHtml(badHtml);

assert(ok.kind === "ok", `valid URL classified ok (got ${ok.kind}: ${ok.reason})`);
assert(bad.kind === "error_page", `bad URL classified error_page (got ${bad.kind})`);
assert(
  bad.reason?.includes("パラメータ"),
  `bad reason mentions パラメータ (got ${bad.reason})`
);

const mail = formatRaceUrlFailureEmail({
  date: "2026-09-12",
  failures: [
    {
      venueCode: "06",
      raceNo: 1,
      url: BAD_URL,
      kind: "error_page",
      ok: false,
      title: bad.title,
      reason: bad.reason,
    },
  ],
});
assert(
  mail.subject.includes("2026-09-12") && mail.subject.includes("06"),
  `email subject has date/venue: ${mail.subject}`
);
assert(mail.text.includes(BAD_URL), "email body includes bad URL");
assert(mail.text.includes("スキップ"), "email body mentions skip");

// mock Cloudflare EMAIL.send
{
  const sent = [];
  const env = {
    EMAIL: {
      async send(msg) {
        sent.push(msg);
      },
    },
    NOTIFY_EMAIL: "user@example.com",
    NOTIFY_FROM: "noreply@koumeinowana.info",
  };
  await env.EMAIL.send({
    to: env.NOTIFY_EMAIL,
    from: env.NOTIFY_FROM,
    subject: mail.subject,
    text: mail.text,
  });
  assert(sent.length === 1, "EMAIL.send called once");
  assert(sent[0].to === "user@example.com", "to is notify email");
  assert(sent[0].from === "noreply@koumeinowana.info", "from is domain address");
  assert(sent[0].subject === mail.subject, "subject matches");
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll assertions passed");
