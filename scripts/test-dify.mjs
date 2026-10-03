#!/usr/bin/env node
/**
 * Dify streaming 判定の単体テスト。
 * Usage: node --experimental-strip-types scripts/test-dify.mjs
 */

import {
  classifyHttpFailure,
  classifySseEvent,
  consumeDifySseStream,
  formatErrorEventDetail,
  isFinalQueueAttempt,
  isTimeoutErrorPayload,
  isWorkflowFinishedSuccess,
  parseSseBlocks,
  shouldRetryOutcome,
  workflowFinishedFailureDetail,
} from "../src/dify.ts";
import { formatDifyFailureEmail } from "../src/notify.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

// --- timeout payload ---
assert(
  isTimeoutErrorPayload({
    status: 500,
    message: "Provider timeout / Request timed out",
    code: "provider_error",
  }),
  "provider timeout message is timeout"
);
assert(
  isTimeoutErrorPayload({ message: "Request timed out" }),
  "timed out alone is timeout"
);
assert(
  !isTimeoutErrorPayload({ status: 500, message: "LLM rate limit", code: "provider_error" }),
  "non-timeout provider_error is not timeout"
);

// --- workflow_finished ---
assert(
  isWorkflowFinishedSuccess({
    event: "workflow_finished",
    data: { status: "succeeded", id: "run-1" },
  }),
  "succeeded is success"
);
assert(
  !isWorkflowFinishedSuccess({
    event: "workflow_finished",
    data: { status: "failed", error: "boom" },
  }),
  "failed is not success"
);
assert(
  workflowFinishedFailureDetail({ data: { status: "failed", error: "boom" } }).includes("boom"),
  "failure detail includes error"
);

// --- SSE parse ---
const blocks = parseSseBlocks(`event: ping

data: {"event":"workflow_started","workflow_run_id":"abc"}

event: error
data: {"status":500,"message":"Provider timeout / Request timed out","code":"provider_error"}

data: {"event":"workflow_finished","data":{"status":"succeeded","id":"abc"}}

`);
assert(blocks.length === 3, `parsed 3 data blocks, got ${blocks.length}`);
assert(blocks[0].eventType === "workflow_started", "started event type");
assert(blocks[1].eventType === "error", "SSE event: error");
assert(blocks[2].eventType === "workflow_finished", "finished from data.event");

assert(classifySseEvent("error", blocks[1].data).kind === "timeout", "error event classified timeout");
assert(
  classifySseEvent(null, { event: "error", message: "something else", code: "x" }).kind === "retryable",
  "other error is retryable"
);
assert(classifySseEvent(null, blocks[2].data).kind === "success", "finished succeeded");
assert(classifySseEvent("ping", null).kind === "ignore", "ping ignored");

// --- stream consume ---
function streamFrom(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

const ok = await consumeDifySseStream(
  streamFrom(`data: {"event":"workflow_started","workflow_run_id":"r1"}

data: {"event":"workflow_finished","workflow_run_id":"r1","data":{"status":"succeeded","id":"r1"}}

`)
);
assert(ok.kind === "success" && ok.workflowRunId === "r1", `success stream: ${JSON.stringify(ok)}`);

const timedOut = await consumeDifySseStream(
  streamFrom(`event: error
data: {"status": 500, "message": "Provider timeout / Request timed out", "code": "provider_error"}

`)
);
assert(timedOut.kind === "timeout", `timeout stream: ${timedOut.kind}`);
assert(!shouldRetryOutcome(timedOut), "timeout should not retry");

const failedWf = await consumeDifySseStream(
  streamFrom(`data: {"event":"workflow_finished","data":{"status":"failed","error":"llm exploded"}}

`)
);
assert(failedWf.kind === "retryable", `failed workflow retryable: ${failedWf.kind}`);
assert(shouldRetryOutcome(failedWf), "failed workflow should retry");

const disconnected = await consumeDifySseStream(
  streamFrom(`data: {"event":"workflow_started","workflow_run_id":"r2"}

`)
);
assert(disconnected.kind === "disconnect", `early end is disconnect: ${disconnected.kind}`);
assert(!shouldRetryOutcome(disconnected), "disconnect should not retry");

assert(classifyHttpFailure(504, "timeout").kind === "timeout", "HTTP 504 is timeout");
assert(classifyHttpFailure(429, "slow down").kind === "retryable", "HTTP 429 is retryable");
assert(classifyHttpFailure(500, "err").kind === "retryable", "HTTP 500 is retryable");

assert(!isFinalQueueAttempt(1), "attempt 1 not final");
assert(!isFinalQueueAttempt(3), "attempt 3 not final");
assert(isFinalQueueAttempt(4), "attempt 4 is final with max_retries=3");

const mail = formatDifyFailureEmail({
  targetDate: "2026-09-12",
  venueCode: "06",
  raceNo: 1,
  raceUrl: "https://example.test",
  attempts: 4,
  detail: "error event: boom",
});
assert(mail.subject.includes("Dify失敗") && mail.subject.includes("06"), "dify failure subject");
assert(mail.text.includes("error event: boom") && mail.text.includes("試行回数: 4"), "dify failure body");

assert(formatErrorEventDetail({ status: 500, code: "provider_error", message: "x" }).includes("provider_error"), "format error detail");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll dify tests passed");
