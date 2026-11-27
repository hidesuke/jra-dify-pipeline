#!/usr/bin/env node
/**
 * wrangler の custom build。main の Workers Builds では、本体をアップロードする前に
 * 馬場取得 Worker をデプロイする。
 *
 * main 以外では何もしない。PR のビルドは `npx wrangler versions upload` で、
 * 未作成の Service Binding のため失敗する。承認前に本番へは出さない。
 * ローカルの wrangler dev / deploy でも何もしない。手元は `npm run deploy`。
 *
 * Workers Builds は WRANGLER_CI_OVERRIDE_NAME で Worker 名を本体に強制する。
 * fetcher を出す子プロセスではその上書きを外し、wrangler.baba.jsonc の名前を使う。
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const CI_NAME_OVERRIDE_VARS = [
  "WRANGLER_CI_OVERRIDE_NAME",
  "WRANGLER_CI_MATCH_TAG",
  "WRANGLER_CI_GENERATE_PREVIEW_ALIAS",
];

export function shouldDeployFetcher({ workersCi, branch }) {
  return workersCi === "1" && branch === "main";
}

export function envForFetcherDeploy(env) {
  const next = { ...env };
  for (const key of CI_NAME_OVERRIDE_VARS) delete next[key];
  return next;
}

function deployFetcher() {
  const result = spawnSync("npx", ["wrangler", "deploy", "-c", "wrangler.baba.jsonc"], {
    stdio: "inherit",
    env: envForFetcherDeploy(process.env),
  });
  process.exit(result.status ?? 1);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const branch = process.env.WORKERS_CI_BRANCH ?? "";
  if (shouldDeployFetcher({ workersCi: process.env.WORKERS_CI, branch })) {
    deployFetcher();
  } else if (process.env.WORKERS_CI === "1") {
    console.log(
      "Skipping jra-baba-fetcher deploy: branch is not main. Non-main builds do not change production."
    );
  }
}
