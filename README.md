# jra-dify-pipeline

JRA の開催日ごとに公式レースページ URL を組み立て、Cloudflare Queues 経由で [Dify](https://dify.ai/) ワークフローを 1 レースずつ起動する Cloudflare Worker です。

予測ロジック自体はこのリポジトリにはありません。出馬表の取得や予想は `DIFY_API_URL` 先のワークフロー側で行います。

## 仕組み

```
Cron（金・土 17:00 JST） ─┐
手動 HTTP（?date=）     ─┴─→ SCHEDULE_2026 → URL 生成 → jra-race-queue → Dify
```

| ハンドラ | 役割 |
| --- | --- |
| `scheduled` | 現在時刻 +33 時間（JST の翌日）の開催をキュー投入 |
| `fetch` | クエリ `date` で指定した開催日をキュー投入 |
| `queue` | 1 件ずつ Dify を blocking POST。失敗時は最大 3 回リトライ |

開催カレンダーは `src/index.ts` の `SCHEDULE_2026` に 2026-09-12〜2026-12-28 分が直書きされています。表にない日付は投入できません。

Cron は **金曜・土曜のみ** です。月曜開催（例: 2026-09-21, 10-12, 11-23, 12-28）は自動では流れないので、下の手動実行でキックしてください。

## 前提

- [Cloudflare アカウント](https://dash.cloudflare.com/sign-up)
- Node.js 18 以降（Wrangler 実行用）
- Dify の Workflow API（URL と API キー）
- Cloudflare Queues を使えること（[ダッシュボード](https://dash.cloudflare.com/) で Queues を有効化。Free プランは 1 日 10,000 operations まで。詳細は [Queues の料金](https://developers.cloudflare.com/queues/platform/pricing/)）

依存関係のインストール:

```bash
npm install
```

よく使うコマンド:

| npm script | 内容 |
| --- | --- |
| `npm run dev` | ローカル開発（`wrangler dev`） |
| `npm run deploy` | Cloudflare へデプロイ |
| `npm run tail` | 本番ログを購読 |
| `npm run cf-typegen` | Worker の型定義を生成 |

その他の Wrangler サブコマンド（login / queues / secret など）は `npx wrangler` で実行します。

## 環境変数

| 名前 | 必須 | 説明 |
| --- | --- | --- |
| `DIFY_API_KEY` | はい | Dify API キー（`Authorization: Bearer`） |
| `DIFY_API_URL` | はい | Dify の実行エンドポイント（例: `https://api.dify.ai/v1/workflows/run`） |
| `PREFIX_CODE` | いいえ | JRA CNAME の接頭辞。未設定時は `pw01dde01` |

Dify へ渡す入力:

- `race_url` — `https://jra.jp/JRADB/accessD.html?CNAME=...`
- `target_date` — `YYYY-MM-DD`
- `venue_code` — 場コード（`06` = 中山 など）
- `race_number` — 1〜12
- `response_mode` — `blocking`
- `user` — `cloudflare-queue-worker`

## Cloudflare へのデプロイ

手順は公式の [Queues 入門](https://developers.cloudflare.com/queues/get-started/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) に沿っています。`wrangler.jsonc` 側の producer / consumer / Cron 定義は済みです。

### 1. ログイン

```bash
npx wrangler login
```

ブラウザで Cloudflare アカウントを許可します。

### 2. Queue を作成

デプロイより先に、バインド先のキューを作っておきます。名前は `wrangler.jsonc` の `jra-race-queue` と一致させてください。

```bash
npx wrangler queues create jra-race-queue
```

同じ名前のキューが既にある場合はスキップして構いません。1 つのキューに付けられる Worker consumer は 1 つだけです。

### 3. シークレットを登録

```bash
npx wrangler secret put DIFY_API_KEY
npx wrangler secret put DIFY_API_URL
```

必要なら:

```bash
npx wrangler secret put PREFIX_CODE
```

`wrangler secret put` は値を対話入力し、Worker の新しいバージョンとして即デプロイされます。初回はまだ Worker がなくても登録できます。後からコードと一緒に上げる場合は [シークレットファイル付きデプロイ](https://developers.cloudflare.com/workers/configuration/secrets/) も使えます。

```bash
npx wrangler deploy --secrets-file .env.production
```

`.env.production` はコミットしないでください。

### 4. Worker をデプロイ

```bash
npm run deploy
```

成功すると `*.workers.dev` URL が表示されます。

```text
Published jra-dify-pipeline
  https://jra-dify-pipeline.<YOUR-SUBDOMAIN>.workers.dev
```

Cron（`0 8 * * 5` / `0 8 * * 6`、UTC。JST 17:00）もこのデプロイで有効になります。Cron の変更は反映まで数分かかることがあります。

### 5. 動作確認

別ターミナルでログを流し:

```bash
npm run tail
```

ブラウザまたは `curl` で手動キック（次節）し、Queue consumer が Dify を叩いていることを確認します。

ダッシュボードでも確認できます。

- Workers & Pages → `jra-dify-pipeline` → デプロイ・ログ
- Settings → Triggers → Cron Triggers
- Workers → Queues → `jra-race-queue`

## 手動実行

`fetch` ハンドラが開催日を受け取り、Cron と同じく Queue へ投入します。認証はありません。公開 URL を知っている人は誰でも任意日を流せるので、本番では Cloudflare Access などで保護することを推奨します。

日付形式は `YYYY-MM-DD`。`SCHEDULE_2026` に無い日は `404` です。`date` を省略すると `2026-09-12` になります。

成功時は `200` と投入件数（2 場なら 24、3 場なら 36）が返ります。

### デプロイ後

```bash
curl "https://jra-dify-pipeline.<YOUR-SUBDOMAIN>.workers.dev/?date=2026-09-12"
```

月曜開催の例:

```bash
curl "https://jra-dify-pipeline.<YOUR-SUBDOMAIN>.workers.dev/?date=2026-09-21"
```

### ローカル

プロジェクト直下に `.dev.vars` を置き（Git に含めない）:

```dotenv
DIFY_API_KEY=your-dify-api-key
DIFY_API_URL=https://api.dify.ai/v1/workflows/run
```

開発サーバーを起動します。Queue は Miniflare 上でシミュレートされます（[`wrangler dev --remote` は Queues 非対応](https://developers.cloudflare.com/queues/configuration/local-development/)）。

```bash
npm run dev
```

既定は `http://localhost:8787` です。

```bash
curl "http://localhost:8787/?date=2026-09-12"
```

ローカルで Cron 相当（`scheduled`）を試す場合は、公式の [ローカル Cron テスト](https://developers.cloudflare.com/workers/configuration/cron-triggers/#test-cron-triggers-locally) どおり次を叩きます。対象日は実行時刻の +33 時間（JST 翌日）です。

```bash
curl "http://localhost:8787/cdn-cgi/local/scheduled"
```

`wrangler dev` 実行中にターミナルで `s` を押しても scheduled を発火できます。

## キュー設定（参考）

`wrangler.jsonc` の consumer:

- `max_batch_size`: 1（1 メッセージずつ Dify へ）
- `max_batch_timeout`: 5 秒
- `max_retries`: 3
- `max_concurrency`: 2（Dify 側の負荷に合わせて調整）

Dead Letter Queue は未設定です。リトライ上限を超えたメッセージは破棄されます。

## 場コード

| コード | 競馬場 |
| --- | --- |
| 01 | 札幌 |
| 02 | 函館 |
| 03 | 福島 |
| 04 | 新潟 |
| 05 | 東京 |
| 06 | 中山 |
| 07 | 中京 |
| 08 | 京都 |
| 09 | 阪神 |
| 10 | 小倉 |

2026 年秋冬の埋め込みカレンダーでは札幌・函館・小倉は使いません。
