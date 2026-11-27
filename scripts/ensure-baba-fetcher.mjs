#!/usr/bin/env node
/**
 * wrangler の custom build。本体をアップロードする前に馬場取得 Worker を用意する。
 *
 * Workers Builds の既定は `npx wrangler deploy` で、ダッシュボードの Deploy command を
 * 変えていなくても、この command は本体のアップロード前に走る。
 * WORKERS_CI=1 のときだけ動く。ローカルの wrangler dev / deploy では何もしない。
 *
 * main では毎回デプロイする。それ以外のブランチは、未作成のときだけ作る。
 * PR のたびに本番の fetcher を上書きしない。
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function shouldDeployFetcher({ workersCi, branch, fetcherExists }) {
  if (workersCi !== "1") return false;
  if (branch === "main") return true;
  return !fetcherExists;
}

function wrangler(args, { inherit }) {
  return spawnSync("npx", ["wrangler", ...args], {
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
  });
}

function fetcherIsDeployed() {
  const result = wrangler(
    ["deployments", "status", "-c", "wrangler.baba.jsonc", "--json"],
    { inherit: false }
  );
  return result.status === 0;
}

function deployFetcher() {
  const result = wrangler(["deploy", "-c", "wrangler.baba.jsonc"], { inherit: true });
  process.exit(result.status ?? 1);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const branch = process.env.WORKERS_CI_BRANCH ?? "";
  const fetcherExists = process.env.WORKERS_CI === "1" && branch !== "main" ? fetcherIsDeployed() : false;
  if (
    shouldDeployFetcher({
      workersCi: process.env.WORKERS_CI,
      branch,
      fetcherExists,
    })
  ) {
    deployFetcher();
  }
}
