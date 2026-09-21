# jra-dify-pipeline

JRA の開催日ごとに公式レースページ URL を組み立て、Cloudflare Queues 経由で [Dify](https://dify.ai/) ワークフローを 1 レースずつ起動する Cloudflare Worker です。

予測ロジック自体はこのリポジトリにはありません。出馬表の取得や予想は `DIFY_API_URL` 先のワークフロー側で行います。

本番 URL: `https://jra-dify-pipeline.hdsk.workers.dev`

## 仕組み

```
Cron（金・土 17:00 JST） ─┐
GET|POST /run（認証必須） ─┴─→ KV の seed で URL 生成 → 各場1R検証 → jra-race-queue → Dify
GET|POST /kick（フォーム）─┘                         └─ エラーページならメール（/seed リンク）＋その場をスキップ

GET /            → 馬柱 URL の一覧のみ（キュー投入も予想もしない）
GET /kick        → 今週の開催から日付・場・レースを選んで投入する画面（Access 必須・スマホ向け）
GET /baba/latest → 最新の馬場状態のみ（認証なし・AI / HTTP ツール向け）
GET /verify      → 各場 1R の URL 検証のみ（認証必須・投入なし）
GET /seed        → 失敗した場の正しい 1R URL を入れて seed を更新し、Queue へ再投入（Access 必須）
```

| ハンドラ | 役割 |
| --- | --- |
| `scheduled` | Cloudflare Cron が呼ぶ。HTTP ではない。JST 翌日の開催を Queue へ投入する |
| `GET /` | 馬柱 URL の一覧。Queue にも Dify にも載せない。本文は `text/plain` で URL のみ（1 行 1 URL） |
| `GET /kick` または `POST /kick` | スマホ向けの予想キック画面。今週（月曜〜日曜＋週明け月曜の祝日開催）の日付・場・レースをセレクトで選んで投入する。場とレース番号は未指定ならその日の全候補。認証は `/run` と同じ。画面から馬場状態・シード補正へも移れる |
| `GET /run` または `POST /run` | 同じ開催を Queue へ投入する。投入前に各場 1R の URL を検証する。ブラウザは Cloudflare Access、CLI は `Authorization: Bearer <PREDICT_SECRET>`。ブラウザでクエリ無しの `GET /run` は `/kick` と同じフォーム。CLI や `?date=` 付き、`POST` は投入。本文は `text/plain`（ブラウザは HTML）で `Enqueued N races for YYYY-MM-DD` のあと `場コード:レース番号R URL` |
| `GET /verify` または `POST /verify` | 各場 1R だけを検証する（Queue に載せない）。認証は `/run` と同じ。`?notify=1` で失敗時にメールも送る |
| `GET /seed` または `POST /seed` | 1R がパラメータエラーだった場の正しい URL を入力する。認証は `/run` と同じ（Cloudflare Access または `PREDICT_SECRET`）。成功すると seed を KV に保存し、失敗していた場を Queue へ再投入する |
| `GET /baba/latest` | 各場の**最新計測だけ**を JSON で返す。認証なし。Dify の HTTP リクエストツールなど AI から読む用。履歴やパース生データは含まない |
| `GET /baba` | 馬場データの確認用ダンプ（全計測）。認証なし。キュー投入なし |
| `queue` | Queue consumer。1 件ずつ Dify へ blocking POST。失敗時は最大 3 回リトライ |

`GET /`・`/run`・`/verify` のクエリは同じです。`/kick` のフォームも同じ項目を POST します。`date=YYYY-MM-DD`（省略時は JST の今日）、`venue=06`（場コード 2 桁）、`race=1`（1〜12）。

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

データの出典は JRA の年度開催日割 PDF（[2026年](https://www.jra.go.jp/keiba/program/2026/pdf/nittei.pdf)、変更版 2026.9.6）です。2026 年は全年 110 開催日（札幌〜小倉。うち 2026-09-22 は 09-21 中山の代替）を収録しています。回次・日次が 1 つでもずれるとレース URL のチェックサムが崩れるため、更新時は PDF 巻末の「回 / 日」集計表と件数が一致するか確認してください。

Cron は金・土 17:00 JST（`0 8 * * FRI` / `0 8 * * SAT` UTC）です。Cloudflare の曜日番号は Unix と違い **1=日曜 … 7=土曜** なので、数字の `5`/`6` は木・金になります。曜日は `FRI` / `SAT` で指定してください。月曜開催（例: 2026-09-21 敬老の日・阪神のみ、10-12 スポーツの日、11-23 勤労感謝の日、11-30）や火曜代替（2026-09-22 中山）は自動では流れないので、`/kick` か認証付きの `/run` を使ってください。2026-12-28 は開催なしです。

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
| `npm run deploy` | 手元から Cloudflare へデプロイ（普段は `main` へのマージで自動） |
| `npm run tail` | 本番ログを購読 |
| `npm test` | 1R 検証とシード逆算のローカルテスト |
| `npm run cf-typegen` | Worker の型定義を生成 |

その他の Wrangler サブコマンド（login / queues / secret など）は `npx wrangler` で実行します。

## 環境変数

| 名前 | 必須 | 説明 |
| --- | --- | --- |
| `DIFY_API_KEY` | はい | Dify API キー（`Authorization: Bearer`） |
| `DIFY_API_URL` | はい | Workflow 実行エンドポイント。`https://api.dify.ai/v1/workflows/run` |
| `PREFIX_CODE` | いいえ | JRA CNAME の接頭辞。未設定時は `pw01dde01` |
| `PUBLIC_BASE_URL` | いいえ | 失敗メールに載せる Worker の origin。既定は `https://jra-dify-pipeline.hdsk.workers.dev` |
| `CF_ACCESS_TEAM_DOMAIN` | `/run`・`/kick`・`/seed` 用 | Zero Trust のチーム URL。例: `https://<team>.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | `/run`・`/kick`・`/seed` 用 | Access アプリケーションの Audience（AUD）タグ。パスごとにアプリが分かれる場合はカンマ区切り |
| `CF_ACCESS_ALLOWED_EMAIL` | いいえ | 許可するメール。未設定なら Access を通ったユーザーなら可。通知先のフォールバックにも使う |
| `PREDICT_SECRET` | `/run`・`/kick`・`/seed` 用（代替） | 自分で決めた共有秘密。Cloudflare からは発行されない。CLI では `Authorization: Bearer` に付ける |
| `NOTIFY_EMAIL` | 通知用 | 馬柱 URL エラーの通知先。**Email Routing で Verify 済みの Destination address**。`wrangler.jsonc` の `vars` に定義（ダッシュボードと同期） |
| `NOTIFY_FROM` | いいえ | 送信元。`koumeinowana.info` 上のアドレス。`wrangler.jsonc` の vars 既定は `noreply@koumeinowana.info` |

`/run`・`/kick`・`/verify`・`/seed` は `CF_ACCESS_*` か `PREDICT_SECRET` の少なくとも一方が無いと `503` です。インデックス `/` と `/baba`・`/baba/latest` は認証しません。

チェックサムの加算定数（seed）は Workers KV（バインディング `CHECKSUM_SEED`）に保持します。未設定時の初期値は `0x16` です。名前空間の表示名が違っていても、`wrangler.jsonc` の `binding` が `CHECKSUM_SEED` なら Worker から使えます。

メール送信は Cloudflare Email Service の `send_email` バインディング（`EMAIL`）を使います。Resend 等の外部 API キーは不要です。検証済み Destination 宛てのみ（自分宛通知）なので Workers Free でも利用できます。

## Dify に渡すパラメータ

`GET /v1/parameters` で確認したアプリの入力は次の 2 つです。Worker の `inputs` キーはこれに合わせています。

| 変数名 | Dify のラベル | 必須 | Worker が入れる値 |
| --- | --- | --- | --- |
| `url` | 馬柱URL | はい | JRA 公式のレースページ URL |
| `remarks` | 備考 | いいえ | `2026-09-12 場:06 1R` 形式。続けて対象場の馬場情報（クッション値・含水率など）を追記する。詳細は「馬場状態」参照 |

Dify 側の入力変数は従来どおり `url` / `remarks` の 2 つだけです（変数追加は不要）。馬場情報は `remarks` に文字列として差し込まれます。

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

チェックサムは 2026-09-06 / 09-12 / 09-13 の実 URL で検証済みです。月の項は 9 月サンプルのみなので、不足分は KV の seed に吸収します。1R がパラメータエラーになったら `/seed` で正しい 1R URL を入れ、seed を更新してください。

## 各場 1R の URL 検証とメール通知

Cron および `/run` はキュー投入の直前に、**各場の 1R だけ** JRA 公式ページを GET し、エラーページでないかを確認します。不正な CNAME でも HTTP は 200 のまま「パラメータエラー」ページになるため、ステータスではなく本文（`パラメータエラー` / `error.css` / `.error_code`、出馬表マーカー欠落）で判定します。

| 結果 | 動作 |
| --- | --- |
| 出馬表（OK） | その場の 1〜12R を通常どおり投入 |
| パラメータエラー等 | その場の全レースを投入スキップし、メール通知（設定時）。本文に `/seed` へのリンクを付ける。Access 通過後、失敗した場の正しい 1R URL を 1 本入れると seed を更新し、失敗していた場を Queue へ再投入する |
| 取得失敗（ネットワーク等） | メール通知（設定時）しつつ、その場は投入を続行。seed は変えない |

通知には [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)（検証済み Destination 宛て）を使います。外部のメール API キーは不要です。

前提（ダッシュボード）:

1. `koumeinowana.info` を Cloudflare に追加し、ネームサーバを向けて **Active**
2. Email Routing で自分のメールを Destination address に追加し **Verify**
3. （初回）Email Routing を有効化すると MX 等が自動追加される

Worker 側（`wrangler.jsonc` の `vars` に `NOTIFY_EMAIL` / `NOTIFY_FROM` を書いてデプロイ。ダッシュボードで変えたら config も合わせておく）:

```bash
npm run deploy
```

検証だけ試す（投入なし）:

```bash
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/verify?date=2026-09-12"
# 失敗時にメールも送る
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/verify?date=2026-09-12&notify=1"
```

成功時の例:

```
Verified 2 venue 1R URL(s) for 2026-09-12
06:1R ok 出馬表ページ https://jra.jp/...
09:1R ok 出馬表ページ https://jra.jp/...
```

エラー時は HTTP `422` と `error_page` 行が返ります。パラメータエラーの通知メールから `/seed` を開き、正しい 1R URL を入れると seed が KV に保存されます。

### シード補正 `GET|POST /seed`

URL 生成の加算定数（seed）は、正しい 1R URL から逆算できます。JRA 側の定数や未実装の月項が変わると 1R がエラーページになります。そのときだけ人手で更新し、次の失敗まで同じ seed を使います。

1. メールのリンク `https://jra-dify-pipeline.hdsk.workers.dev/seed` を開く（Cloudflare Access）
2. 失敗した場のうち、どれか 1 場の正しい 1R URL を貼る（PC の `jra.jp` でもスマホの `www.jra.go.jp` でも可）
3. Worker が JRA で出馬表か確認し、seed を KV に保存する
4. 失敗していた日付・場の URL を新しい seed で再生成し、Queue へ投入する

回次・日次が開催表と違う URL は拒否します（seed ではなく開催表の問題）。代替開催などで正しい 1R の日付が失敗記録と違う場合は、同じ場なら受け付けて失敗記録の日付を差し替えます。補正待ちの失敗が無いときは seed を更新できません。

CLI から試す場合:

```bash
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  "https://jra-dify-pipeline.hdsk.workers.dev/seed"
curl -H "Authorization: Bearer $PREDICT_SECRET" \
  -d "url=https://jra.jp/JRADB/accessD.html?CNAME=..." \
  "https://jra-dify-pipeline.hdsk.workers.dev/seed"
```

## 馬場状態（クッション値・含水率）

`/run` および Cron 投入時に、JRA 公式の馬場情報を取得して**対象場の分だけを `remarks`（備考欄）に追記**します。設定は不要（常時有効）で、予測ロジック自体は Dify 側なので、備考欄のテキストを読んで予想に反映してください。取得に失敗しても投入は止めず、その回だけ馬場情報なしで送ります。

`remarks` の例:

```
2026-09-13 場:06 1R ｜ 馬場[9月13日（日曜）7時00分] クッション値8.2 / 芝:重(含水率 ゴール前13.5 4角14.8) / ダート:重(含水率 ゴール前14.1 4角15.4) / 当日雨量1mm / 使用コース:Bコース（Aコースから3メートル外に内柵を設置） / 芝丈(cm) 芝野芝12から14 障害野芝12から14・洋芝12から16 / 芝の状態:3コーナーから4コーナーの内柵沿いに傷みがあります。
```

### 取り込むデータ

会場・計測ごとに次を取得します（`src/baba.ts`）。

| 項目 | 内容 |
| --- | --- |
| クッション値 | 数値（例 8.2） |
| 芝 含水率 | ゴール前・4 コーナーの 2 地点（%） |
| ダート 含水率 | ゴール前・4 コーナーの 2 地点（%） |
| 馬場状態区分 | 各含水率地点の色分け。`hard`=良 / `wet`=稍重 / `soft`=重 / `heavy`=不良（`baba2025.js` の定義に準拠） |
| 当日雨量 | 測定時刻までの雨量（mm）。注記がある計測のみ |
| 計測日時 | 例 `9月13日（日曜）7時00分` |
| 使用コース | 例「Bコース（Aコースから3メートル外に内柵を設置）」 |
| 芝丈 | 芝コース・障害コース × 野芝・洋芝（cm）。値のない項目・「なし」は省略 |
| 芝の状態 | 芝の傷み等のコメント |

ゴール前と 4 コーナーで区分が同じなら `芝:良(...)`、異なれば地点別に表記します。クッション値・含水率・当日雨量は計測ページ（フラグメント）から、使用コース・芝丈・芝の状態は各会場のインデックスページから取得します。

### クッション値が「取れない」問題について

馬場ページ（[index](https://www.jra.go.jp/keiba/baba/index.html) / [index2](https://www.jra.go.jp/keiba/baba/index2.html) / [index3](https://www.jra.go.jp/keiba/baba/index3.html)）は、クッション値が JS 描画のため単純な HTML 取得では見えません。ただし調査の結果、`baba2025.js` が相対パスの**静的 HTML フラグメントを ajax 読み込み**しているだけと判明しました。したがってヘッドレスブラウザは不要で、Worker から次を直接 GET すれば取得できます。

| URL | 内容 |
| --- | --- |
| `https://www.jra.go.jp/keiba/baba/_data_cushion.html` | クッション値（開催全場） |
| `https://www.jra.go.jp/keiba/baba/_data_moist.html` | 含水率（芝・ダート × ゴール前 / 4 コーナー、区分、当日雨量） |
| `index.html` / `index2.html` / `index3.html` | 使用コース・芝丈・芝の状態（同時開催の各場に 1 枚ずつ。会場は `<title>` で判別） |

これらは **Shift_JIS** なので `TextDecoder("shift_jis")` で復号します（Cloudflare Workers ランタイムでサポートを確認済み）。計測フラグメントは 1 ファイルに開催中の全場が入り、会場は `title`（会場名）で識別されるため、場コードへマッピングしています。インデックスページは会場ごとに分かれており、それぞれの `<title>馬場情報（〇〇競馬場）` から会場を判別します。

### 対象計測の選び方（タイミング）

Cron は前日 17:00 に翌日分を投入します。クッション値は開催当日の朝に計測・公開されるため、17:00 時点ではその日の実測はまだ存在しません。そこで**対象日と同月日の計測があればそれを、無ければその時点の最新（直近）計測**を付与します。つまり 17:00 投入時は「その時点で公開されている最新の馬場データ」が入ります。

### AI 向けエンドポイント `GET /baba/latest`

各場について **いま公開されている最新の計測 1 件だけ** を返します。認証なし・CORS 許可・キュー投入なし。Dify の HTTP リクエストツールやその他の AI から、開催当日朝に更新されたクッション値・含水率を読むための API です。過去の計測履歴は含めません。

| クエリ | 必須 | 説明 |
| --- | --- | --- |
| `venue` | いいえ | 場コード 2 桁（`06`）または会場名（`中山` / `中山競馬場`）。省略時は JRA が掲載している全場 |
| `format` | いいえ | `json`（既定）または `text`。`text` は `text` フィールドと同じ 1 行 1 場のプレーンテキスト |

JSON の主なフィールド:

| フィールド | 内容 |
| --- | --- |
| `fetchedAt` | この Worker が JRA を取りに行った時刻（ISO 8601） |
| `text` | AI がそのまま読める日本語サマリ（1 場 1 行）。`remarks` に入れる馬場文字列と同じ形式 |
| `venues[].venueCode` / `venueName` | 場コードと会場名 |
| `venues[].measuredAt` | 計測時刻の生文字列 |
| `venues[].cushion` | クッション値 |
| `venues[].turf` / `dirt` | `condition`（良 / 稍重 / 重 / 不良）、ゴール前・4 角の含水率 |
| `venues[].rainfallMm` | 当日雨量（mm）。注記が無い計測は `null` |
| `venues[].usedCourse` / `turfLength` / `turfCondition` | 使用コース・芝丈・芝の状態 |
| `venues[].summary` | その場の 1 行サマリ |

`Cache-Control: public, max-age=300` です。未知の `venue` は `400`、その場の掲載が無いときは `404`、JRA 取得失敗は `502` です。

```bash
# 全場の最新だけ（JSON）
curl "https://jra-dify-pipeline.hdsk.workers.dev/baba/latest"
# 中山だけ
curl "https://jra-dify-pipeline.hdsk.workers.dev/baba/latest?venue=06"
# プレーンテキスト（LLM に渡しやすい）
curl "https://jra-dify-pipeline.hdsk.workers.dev/baba/latest?format=text"
```

成功時の JSON 例:

```json
{
  "fetchedAt": "2026-09-18T12:00:00.000Z",
  "text": "中山(06) 馬場[9月18日（金曜）10時30分] クッション値9.6 / 芝:良(含水率 ゴール前13.1 4角14.1) / ダート:良(含水率 ゴール前7.3 4角7.4)",
  "venues": [
    {
      "venueCode": "06",
      "venueName": "中山",
      "measuredAt": "9月18日（金曜）10時30分",
      "cushion": 9.6,
      "turf": { "condition": "良", "goalCondition": "良", "corner4Condition": "良", "goal": 13.1, "corner4": 14.1 },
      "dirt": { "condition": "良", "goalCondition": "良", "corner4Condition": "良", "goal": 7.3, "corner4": 7.4 },
      "rainfallMm": null,
      "usedCourse": "Bコース（Aコースから3メートル外に内柵を設置）",
      "turfLength": "芝丈(cm) 芝野芝12から14 障害野芝12から14・洋芝12から16",
      "turfCondition": "3コーナーから4コーナーの内柵沿いに傷みがあります。",
      "summary": "馬場[9月18日（金曜）10時30分] クッション値9.6 / 芝:良(含水率 ゴール前13.1 4角14.1) / ダート:良(含水率 ゴール前7.3 4角7.4) / 使用コース:Bコース（Aコースから3メートル外に内柵を設置）"
    }
  ]
}
```

Cloudflare Access は `/run`・`/kick`・`/seed` だけに付けてください。`/baba/latest` まで保護すると AI から認証なしで読めなくなります。

### 確認用エンドポイント `GET /baba`

パースした馬場データの全計測を JSON で返します（認証なし・キュー投入なし・読み取り専用）。AI からは `/baba/latest` を使ってください。

```bash
# 全場の生データ（履歴を含む）
curl "https://jra-dify-pipeline.hdsk.workers.dev/baba"
# 対象日について各場で選ばれる計測（同日 or 直近）も含める
curl "https://jra-dify-pipeline.hdsk.workers.dev/baba?date=2026-09-13"
```

## Cloudflare へのデプロイ

GitHub の `main` にマージすると、Cloudflare が Worker を自動デプロイします（Workers Builds / Git 連携）。普段の反映は PR を `main` に入れるだけで十分です。`npm run deploy` は手元から出すときの手動手段です。シークレット（`wrangler secret put`）はデプロイでは上書きされないので、キーの追加・変更だけ別途必要です。

初回セットアップの手順は公式の [Queues 入門](https://developers.cloudflare.com/queues/get-started/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) に沿っています。`wrangler.jsonc` 側の producer / consumer / Cron 定義は済みです。

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

通常は GitHub の `main` へマージすれば Cloudflare に出ます。手元から出す場合は `npm run deploy` です。シークレットは `secret put` 側です。

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
| 1R URL 検証 | `console.log` / `console.error` | `1R verify YYYY-MM-DD 場:06 ok\|error_page\|fetch_failed ...` |
| メール通知 | `console.log` | `Notifying race URL failures for YYYY-MM-DD: N venue(s)` |
| キュー投入成功（Cron） | `console.log` | `Successfully enqueued N races for YYYY-MM-DD (seed=0x16)` |
| シード更新後の再投入 | `console.log` | `Seed 0x.. re-enqueue YYYY-MM-DD: N races, stillFailed=0` |
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

予想（キュー投入）は `/run`（とスマホ向けフォーム `/kick`）です。認証が無いと動きません。

### スマホからキックする（`/kick`）

外出先では `https://jra-dify-pipeline.hdsk.workers.dev/kick` を開きます（Cloudflare Access）。今週の開催日から日付を選び、場とレース番号は空（全ての場 / 全レース）のままでも実行できます。同じ画面から馬場状態とシード補正にも行けます。

ブラウザでクエリ無しの `/run` を開いても同じフォームになります。`?date=` を付けた `/run` や `curl` は従来どおりすぐ投入します。

| クエリ | 必須 | 説明 |
| --- | --- | --- |
| `date` | いいえ | `YYYY-MM-DD`。省略時は JST の今日 |
| `venue` | いいえ | 場コード 2 桁。省略時はその日の全場 |
| `race` | いいえ | 1〜12。省略時は 1〜12R 全部 |

年ファイルに無い日、その日に無い場は `404`。`/run` 成功時は `200` と投入件数、続けて `場:R URL` の一覧です。

### Cloudflare Access（ブラウザ・無料枠）

Zero Trust の **Free**（50 ユーザーまで）で、ホストの **パス `/run`・`/kick`・`/seed`** を保護できます。`workers.dev` も対象にできます。Worker 全体の Access は付けないでください。`/` や `/baba/latest` までログイン必須になります。

`/run` 用のアプリに加え、同じポリシーで **パス `kick`** と **パス `seed`** のセルフホストアプリを追加します（AUD が別になるため）。`/kick` をまだ足していない間は、ブラウザで `/run` を開けば同じフォームが出ます。

1. [Zero Trust](https://one.dash.cloudflare.com/) → Access → Applications → アプリケーションを追加
2. **セルフホストとプライベート** → **パブリックDNS**（プライベート宛先や Workers 全体保護は選ばない）
3. サブドメイン: `jra-dify-pipeline`、ドメイン: `hdsk.workers.dev`、パス: `run`（同様にパス `kick` と `seed`）
4. ポリシー: Action Allow、Include → **Emails** に自分のメール
5. App Launcher / Cloudflare One Client 認証 / クライアントレスアクセスはオフ
6. 発行された **Application Audience (AUD) Tag** と、Settings の **Team domain**（`https://<team>.cloudflareaccess.com`）を控える
7. シークレット:

```bash
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
npx wrangler secret put CF_ACCESS_AUD
# /run と /kick と /seed で AUD が違う場合はカンマ区切り: <run-aud>,<kick-aud>,<seed-aud>
npx wrangler secret put CF_ACCESS_ALLOWED_EMAIL
```

ブラウザで `https://jra-dify-pipeline.hdsk.workers.dev/kick`（またはクエリ無しの `/run`）を開くと Cloudflare のログイン画面になります。Worker は `Cf-Access-Jwt-Assertion` を検証します。

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
# 任意: 馬柱 URL エラー通知（本番は Cloudflare Email バインディング。宛先だけローカルでも可）
# NOTIFY_EMAIL=you@example.com
```

```bash
npm run dev
```

既定は `http://localhost:8787` です。Queue は Miniflare 上でシミュレートされます（[`wrangler dev --remote` は Queues 非対応](https://developers.cloudflare.com/queues/configuration/local-development/)）。

```bash
curl "http://localhost:8787/?date=2026-09-12&venue=06&race=1"
curl "http://localhost:8787/baba/latest"
curl "http://localhost:8787/baba/latest?venue=06&format=text"
curl -H "Authorization: Bearer local-dev-secret" \
  "http://localhost:8787/verify?date=2026-09-12"
curl -H "Authorization: Bearer local-dev-secret" \
  "http://localhost:8787/run?date=2026-09-12&venue=06&race=1"
curl -H "Authorization: Bearer local-dev-secret" -H "Accept: text/html" \
  "http://localhost:8787/kick"
curl -H "Authorization: Bearer local-dev-secret" \
  "http://localhost:8787/seed"
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
