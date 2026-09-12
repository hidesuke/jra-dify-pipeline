# jra-dify-pipeline

JRA の開催日ごとに公式レースページ URL を組み立て、Cloudflare Queues 経由で [Dify](https://dify.ai/) ワークフローを 1 レースずつ起動する Cloudflare Worker です。

予測ロジック自体はこのリポジトリにはありません。出馬表の取得や予想は `DIFY_API_URL` 先のワークフロー側で行います。

本番 URL: `https://jra-dify-pipeline.hdsk.workers.dev`

## 仕組み

```
Cron（金・土 17:00 JST） ─┐
GET /run（認証必須）      ─┴─→ 年別開催表 → URL 生成 → jra-race-queue → Dify

GET /  → 馬柱 URL の一覧のみ（キュー投入も予想もしない）
```

| ハンドラ | 役割 |
| --- | --- |
| `scheduled` | Cloudflare Cron が呼ぶ。HTTP ではない。JST 翌日の開催を Queue へ投入する |
| `GET /` | 馬柱 URL の一覧。Queue にも Dify にも載せない。本文は `text/plain` で URL のみ（1 行 1 URL） |
| `GET /run` または `POST /run` | 同じ開催を Queue へ投入する。ブラウザは Cloudflare Access、CLI は `Authorization: Bearer <PREDICT_SECRET>`。本文は `text/plain` で `Enqueued N races for YYYY-MM-DD` のあと `場コード:レース番号R URL` |
| `queue` | Queue consumer。1 件ずつ Dify へ blocking POST。失敗時は最大 3 回リトライ |

`GET /` と `/run` のクエリは同じです。`date=YYYY-MM-DD`（省略時は JST の今日）、`venue=06`（場コード 2 桁）、`race=1`（1〜12）。

成功時の本文例:

`GET /?date=2026-09-12&venue=06&race=1`

```
https://jra.jp/JRADB/accessD.html?CNAME=pw01dde0106202604030120260912/4B
```

`GET /run?date=2026-09-12&venue=06&race=1`（認証後）

```
Enqueued 1 races for 2026-09-12
06:1R https://jra.jp/JRADB/accessD.html?CNAME=pw01dde0106202604030120260912/4B
```

開催カレンダーは `src/schedules/` に年ごとのファイル（例: `2026.ts`）として置きます。新しい年は同ディレクトリに `YYYY.ts` を追加し、`src/schedules/index.ts` に登録します。表にない日付は投入できません。

データの出典は JRA の年度開催日割 PDF（[2026年](https://www.jra.go.jp/keiba/program/2026/pdf/nittei.pdf)、変更版 2026.9.6）です。2026 年は全年 109 開催日（札幌〜小倉）を収録しています。回次・日次が 1 つでもずれるとレース URL のチェックサムが崩れるため、更新時は PDF 巻末の「回 / 日」集計表と件数が一致するか確認してください。

Cron は金・土 17:00 JST（`0 8 * * FRI` / `0 8 * * SAT` UTC）です。Cloudflare の曜日番号は Unix と違い **1=日曜 … 7=土曜** なので、数字の `5`/`6` は木・金になります。曜日は `FRI` / `SAT` で指定してください。月曜開催（例: 2026-09-21 敬老の日、10-12 スポーツの日、11-23 勤労感謝の日、11-30）は自動では流れないので、認証付きの `/run` を使ってください。2026-12-28 は開催なしです。

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
| `CF_ACCESS_TEAM_DOMAIN` | `/run` 用 | Zero Trust のチーム URL。例: `https://<team>.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | `/run` 用 | Access アプリケーションの Audience（AUD）タグ |
| `CF_ACCESS_ALLOWED_EMAIL` | いいえ | 許可するメール。未設定なら Access を通ったユーザーなら可 |
| `PREDICT_SECRET` | `/run` 用（代替） | 自分で決めた共有秘密。Cloudflare からは発行されない。CLI では `Authorization: Bearer` に付ける |

`/run` は `CF_ACCESS_*` か `PREDICT_SECRET` の少なくとも一方が無いと `503` です。インデックス `/` は認証しません。

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

成功すると `*.workers.dev` URL が表示されます。デプロイログに `schedule: 0 8 * * FRI` / `0 8 * * SAT` が出ていれば Cron は有効です。Cron の変更は反映まで数分かかることがあります。

### 5. 動作確認

別ターミナルでログを流してから確認します。一覧は `GET /`、キュー投入は認証付きの `/run` です。

ダッシュボードの設定確認:

- Workers & Pages → `jra-dify-pipeline`
- Settings → Triggers → Cron Triggers
- Workers → Queues → `jra-race-queue`

## ログの見方

この Worker が出す主なメッセージ:

| タイミング | レベル | 内容 |
| --- | --- | --- |
| Cron 発火 | `console.log` | `Cron 0 8 * * FRI target=YYYY-MM-DD`（式と JST 翌日） |
| Cron で開催なし | `console.log` | `No race scheduled for tomorrow: YYYY-MM-DD` |
| キュー投入成功（Cron） | `console.log` | `Successfully enqueued N races for YYYY-MM-DD` |
| Dify 呼び出し直前 | `console.log` | `Executing Dify API: YYYY-MM-DD 場:06 1R <url>` |
| Dify 失敗 | `console.error` | `Failed to process ...` とエラー |

`GET /` は馬柱 URL を 1 行ずつ返すプレーンテキストです。日付や場コードは本文に含みません。Queue にも載せません。

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

`GET /` は馬柱 URL を 1 行ずつ返すプレーンテキストです。Queue にも載せません。

予想（キュー投入）は `/run` だけです。認証が無いと動きません。

| クエリ | 必須 | 説明 |
| --- | --- | --- |
| `date` | いいえ | `YYYY-MM-DD`。省略時は JST の今日 |
| `venue` | いいえ | 場コード 2 桁。省略時はその日の全場 |
| `race` | いいえ | 1〜12。省略時は 1〜12R 全部 |

年ファイルに無い日、その日に無い場は `404`。`/run` 成功時は `200` と投入件数、続けて `場:R URL` の一覧です。

### Cloudflare Access（ブラウザ・無料枠）

Worker 全体の Access は付けないでください。`/` までログイン必須になります。

Zero Trust の **Free**（50 ユーザーまで）で、ホストの **パス `/run` だけ** を保護できます。`workers.dev` も対象にできます。

1. [Zero Trust](https://one.dash.cloudflare.com/) → Access → Applications → アプリケーションを追加
2. **セルフホストとプライベート** → **パブリックDNS**（プライベート宛先や Workers 全体保護は選ばない）
3. サブドメイン: `jra-dify-pipeline`、ドメイン: `hdsk.workers.dev`、パス: `run`
4. ポリシー: Action Allow、Include → **Emails** に自分のメール
5. App Launcher / Cloudflare One Client 認証 / クライアントレスアクセスはオフ
6. 発行された **Application Audience (AUD) Tag** と、Settings の **Team domain**（`https://<team>.cloudflareaccess.com`）を控える
7. シークレット:

```bash
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
npx wrangler secret put CF_ACCESS_AUD
npx wrangler secret put CF_ACCESS_ALLOWED_EMAIL
```

ブラウザで `https://jra-dify-pipeline.hdsk.workers.dev/run?date=2026-09-13` を開くと Cloudflare のログイン画面になります。Worker は `Cf-Access-Jwt-Assertion` を検証します。

Access を通したあとの `curl` には [Service Token](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/) か、下の `PREDICT_SECRET` を使います。

### PREDICT_SECRET（CLI・Access の代替）

ダッシュボードや Access から払い出される値ではありません。自分で文字列を作り、Worker のシークレットとして登録します。Access をまだ組まないとき、または `curl` からの自動化用です。

1. 十分長いランダム文字列を用意する（例）:

```bash
openssl rand -hex 32
```

2. 表示された値を手元に控え、Worker へ登録する。プロンプトにその文字列を貼る:

```bash
npx wrangler secret put PREDICT_SECRET
```

ダッシュボードなら Workers & Pages → `jra-dify-pipeline` → Settings → Variables and Secrets → Add secret。名前は `PREDICT_SECRET`、値は今作った文字列です。

登録後に Cloudflare から元の値を読むことはできません。忘れたら新しい文字列を `secret put` し直します。古い値は無効になります。

3. 使うときはヘッダに載せる:

```bash
export PREDICT_SECRET='手順1で控えた値'
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/run?date=2026-09-12&venue=06&race=1"
```

### デプロイ後（一覧）

```bash
curl "https://jra-dify-pipeline.hdsk.workers.dev/?date=2026-09-12"
```

1 レースだけキュー投入（推奨テスト）:

```bash
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/run?date=2026-09-12&venue=06&race=1"
```

その日の全レース（2 場なら 24、3 場なら 36）:

```bash
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/run?date=2026-09-12"
```

月曜開催の例:

```bash
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/run?date=2026-09-21"
```

### ローカル

プロジェクト直下に `.dev.vars` を置き（Git に含めない）:

```dotenv
DIFY_API_KEY=your-dify-api-key
DIFY_API_URL=https://api.dify.ai/v1/workflows/run
PREDICT_SECRET=local-dev-secret
```

```bash
npm run dev
```

既定は `http://localhost:8787` です。Queue は Miniflare 上でシミュレートされます（[`wrangler dev --remote` は Queues 非対応](https://developers.cloudflare.com/queues/configuration/local-development/)）。

```bash
curl "http://localhost:8787/?date=2026-09-12&venue=06&race=1"
curl -H "Authorization: Bearer local-dev-secret" \
  "http://localhost:8787/run?date=2026-09-12&venue=06&race=1"
```

ローカルで Cron 相当（`scheduled`）を試す場合は、公式の [ローカル Cron テスト](https://developers.cloudflare.com/workers/configuration/cron-triggers/#test-cron-triggers-locally) どおり次を叩きます。対象日は JST の翌日です。

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

投入済みをまとめて捨てる場合は、先に配信を止めてから purge します。1 件ずつの取り消しはできません。処理中のメッセージは残り得ます。

```bash
npx wrangler queues pause-delivery jra-race-queue
npx wrangler queues purge jra-race-queue
npx wrangler queues resume-delivery jra-race-queue
```

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
