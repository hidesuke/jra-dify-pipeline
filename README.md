# jra-dify-pipeline

JRA の開催日ごとに公式レースページ URL を組み立て、Cloudflare Queues 経由で [Dify](https://dify.ai/) ワークフローを 1 レースずつ起動する Cloudflare Worker です。

予測ロジック自体はこのリポジトリにはありません。出馬表の取得や予想は `DIFY_API_URL` 先のワークフロー側で行います。

本番 URL: `https://jra-dify-pipeline.hdsk.workers.dev`

## 仕組み

```
Cron（金・土 17:00 JST） ─┐
手動 HTTP（?date=&venue=&race=）─┴─→ 年別開催表 → URL 生成 → jra-race-queue → Dify
```

| ハンドラ | 役割 |
| --- | --- |
| `scheduled` | 現在時刻 +33 時間（JST の翌日）の開催をキュー投入 |
| `fetch` | クエリで指定した開催をキュー投入。`venue` / `race` で絞り込み可 |
| `queue` | 1 件ずつ Dify を blocking POST。失敗時は最大 3 回リトライ |

開催カレンダーは `src/schedules/` に年ごとのファイル（例: `2026.ts`）として置きます。新しい年は同ディレクトリに `YYYY.ts` を追加し、`src/schedules/index.ts` に登録します。表にない日付は投入できません。

データの出典は JRA の年度開催日割 PDF（[2026年](https://www.jra.go.jp/keiba/program/2026/pdf/nittei.pdf)、変更版 2026.9.6）です。2026 年は全年 109 開催日（札幌〜小倉）を収録しています。回次・日次が 1 つでもずれるとレース URL のチェックサムが崩れるため、更新時は PDF 巻末の「回 / 日」集計表と件数が一致するか確認してください。

Cron は金・土 17:00 JST（`0 8 * * 5` / `0 8 * * 6` UTC）です。月曜開催（例: 2026-09-21 敬老の日、10-12 スポーツの日、11-23 勤労感謝の日、11-30）は自動では流れないので、手動キックを使ってください。2026-12-28 は開催なしです。

止めるときは `wrangler.jsonc` の `crons` を `[]` にして `npm run deploy` します。`crons` キーを消すだけだと、既存のトリガーが残ります。

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
| `DIFY_API_URL` | はい | Workflow 実行エンドポイント。`https://api.dify.ai/v1/workflows/run` |
| `PREFIX_CODE` | いいえ | JRA CNAME の接頭辞。未設定時は `pw01dde01` |

## Dify に渡すパラメータ

`GET /v1/parameters` で確認したアプリの入力は次の 2 つです。Worker の `inputs` キーはこれに合わせています。

| 変数名 | Dify のラベル | 必須 | Worker が入れる値 |
| --- | --- | --- | --- |
| `url` | 馬柱URL | はい | JRA 公式のレースページ URL |
| `remarks` | 備考 | いいえ | `2026-09-12 場:06 1R` 形式（開催日・場コード・レース番号） |

Queue consumer が `DIFY_API_URL` へ `POST` する JSON:

```json
{
  "inputs": {
    "url": "https://jra.jp/JRADB/accessD.html?CNAME=pw01dde0106202604030120260912/4B",
    "remarks": "2026-09-12 場:06 1R"
  },
  "query": "2026-09-12 場:06 1R",
  "response_mode": "blocking",
  "user": "cloudflare-queue-worker"
}
```

| キー | 型 | 意味 |
| --- | --- | --- |
| `inputs.url` | 文字列 | 馬柱（出馬表）の JRA URL |
| `inputs.remarks` | 文字列 | 任意の備考。日付・場・R をテキストで付与 |
| `query` | 文字列 | Workflow API の必須項目ではない。チャットアプリ向けに同じ文を付けている |
| `response_mode` | 文字列 | `blocking`。完了まで HTTP を待つ（Dify 側は約 100 秒で切れることがある） |
| `user` | 文字列 | Dify API 必須の実行ユーザー識別子 |

1 開催日 × 1 場につき 12 通（1R〜12R）送ります。Worker は Dify の応答本文を保存せず、HTTP ステータスが 2xx なら ack、それ以外はリトライします。

チェックサムは 2026-09-06 / 09-12 / 09-13 の実 URL で検証済みです。月の項は 9 月サンプルのみなので、10 月以降は別途確認してください。

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

コード・Cron・Queue バインドの反映は `npm run deploy` です。シークレットは `secret put` 側です。

```bash
npm run deploy
```

成功すると `*.workers.dev` URL が表示されます。デプロイログに `schedule: 0 8 * * 5` / `0 8 * * 6` が出ていれば Cron は有効です。Cron の変更は反映まで数分かかることがあります。

### 5. 動作確認

別ターミナルでログを流してから（次節）、手動キックします。

ダッシュボードの設定確認:

- Workers & Pages → `jra-dify-pipeline`
- Settings → Triggers → Cron Triggers
- Workers → Queues → `jra-race-queue`

## ログの見方

この Worker が出す主なメッセージ:

| タイミング | レベル | 内容 |
| --- | --- | --- |
| Cron で開催なし | `console.log` | `No race scheduled for tomorrow: YYYY-MM-DD` |
| キュー投入成功（Cron） | `console.log` | `Successfully enqueued N races for YYYY-MM-DD` |
| Dify 呼び出し直前 | `console.log` | `Executing Dify API: YYYY-MM-DD 場:06 1R <url>` |
| Dify 失敗 | `console.error` | `Failed to process ...` とエラー |

HTTP の `fetch`（手動キック）は投入した URL 一覧を本文で返します。Dify の成否は **Queue consumer のログ** 側です。

### リアルタイム（ターミナル）

```bash
npm run tail
```

流したまま別ターミナルで `curl` します。`Executing Dify API` が出れば consumer が動いています。`Failed to process` なら Dify の URL・キー・開始変数名を疑います。

```bash
npx wrangler tail --status error
```

### ダッシュボード

1. [Workers & Pages](https://dash.cloudflare.com/) → `jra-dify-pipeline`
2. **Logs** → **Live** でリアルタイム
3. **Observability** で過去ログの検索（アカウントによって、`wrangler.jsonc` に `"observability": { "enabled": true }` を足して再デプロイが必要なことがあります）

Cron の実行履歴は Worker の **Settings → Triggers** 付近の Cron Events（直近 100 件程度）でも見られます。

## 手動実行

`fetch` ハンドラが開催を受け取り Queue へ投入します。認証はありません。公開 URL を知っている人は誰でも任意日を流せるので、本番では Cloudflare Access などで保護することを推奨します。

| クエリ | 必須 | 説明 |
| --- | --- | --- |
| `date` | いいえ | `YYYY-MM-DD`。省略時は `2026-09-12` |
| `venue` | いいえ | 場コード 2 桁。省略時はその日の全場 |
| `race` | いいえ | 1〜12。省略時は 1〜12R 全部 |

年ファイルに無い日、その日に無い場は `404`。成功時は `200` と投入件数、続けて `場:R URL` の一覧です。

### デプロイ後

1 レースだけ（推奨テスト）:

```bash
curl "https://jra-dify-pipeline.hdsk.workers.dev/?date=2026-09-12&venue=06&race=1"
```

その日の全レース（2 場なら 24、3 場なら 36）:

```bash
curl "https://jra-dify-pipeline.hdsk.workers.dev/?date=2026-09-12"
```

月曜開催の例:

```bash
curl "https://jra-dify-pipeline.hdsk.workers.dev/?date=2026-09-21"
```

### ローカル

プロジェクト直下に `.dev.vars` を置き（Git に含めない）:

```dotenv
DIFY_API_KEY=your-dify-api-key
DIFY_API_URL=https://api.dify.ai/v1/workflows/run
```

```bash
npm run dev
```

既定は `http://localhost:8787` です。Queue は Miniflare 上でシミュレートされます（[`wrangler dev --remote` は Queues 非対応](https://developers.cloudflare.com/queues/configuration/local-development/)）。

```bash
curl "http://localhost:8787/?date=2026-09-12&venue=06&race=1"
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
