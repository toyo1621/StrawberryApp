# Rankings API v5

Base URL: `https://strawberry-rankings-api.toyo1621.workers.dev`

本文を持つ応答はJSONで、CORS preflightの成功だけは本文のない `204` です。JSON応答には `x-api-version: 5`、実行中WorkerのGitタグまたはCloudflare version IDを示す `x-release-id`、追跡用 `x-request-id` が付きます。全応答にCSP、HSTS、`nosniff`、frame拒否、Referrer Policy、Permissions Policyを設定します。内部例外、Bearerトークン、接続元の生情報は応答・構造化ログへ出しません。ランキング応答では `x-rankings-cache`、`x-d1-region`、`x-d1-primary` もCORS経由で参照できます。

## 認可

クライアントは初回利用時にUUID v4を生成し、次のBearerヘッダーをゲームセッション発行、投稿、本人履歴、削除に使用します。

```http
Authorization: Bearer <player-token>
```

iOS/AndroidではExpo SecureStore、Webではブラウザのローカルストレージへ保存します。D1には `SHA-256("player:" + token)` だけを保存します。このトークンはアカウント認証ではなく、その端末が作成したゲームセッションと履歴・削除権限を結び付けるランダムな資格情報です。

## Endpoints

### `GET /health`

D1へ `SELECT 1` を実行します。キャッシュは禁止です。

```json
{
  "ok": true,
  "service": "strawberry-rankings-api",
  "version": 5,
  "release": "<release-id>",
  "monitor": {
    "status": "healthy",
    "checkedAt": "2026-07-23T00:00:00.000Z",
    "latencyMs": 120
  }
}
```

`monitor` はCloudflare Cron自身が15分ごとに検証してD1 `service_heartbeats` へ記録したD1・Web・`release.json` の心拍です。初回migration直後は `pending`、まだ記録がない環境では `null` です。内部障害内容は公開しません。

### `POST /game-sessions`

ランキング対象ゲームの開始前にBearer付きで呼び出します。本文は2 KiB以下のJSONです。

```json
{ "gameType": "island_rush", "islandRegion": "shikoku" }
```

`201`でUUID、対象モード・地域、開始・失効日時を返します。セッションは15分で失効し、1件の投稿にだけ使用できます。島以外の `islandRegion` は `all` だけです。接続元ごとの発行上限は8件/分です。

### `POST /scores`

Bearerと、同じ所有者・モード・地域で発行した未使用セッションが必須です。

```json
{
  "submissionId": "5bfec55d-73a6-42d4-ae19-71d377736ab8",
  "gameSessionId": "6f81f492-1d86-45c3-8735-947634d80aad",
  "playerName": "プレイヤー",
  "score": 12,
  "gameType": "island_rush",
  "islandRegion": "shikoku",
  "durationMs": 30000
}
```

WorkerはUnicodeコードポイント数で12文字以内の名前を検証し、制御文字、不可視文字、双方向制御、HTML境界文字を拒否します。さらに整数得点、1秒から5分の経過時間、モード別の理論得点速度、サーバーが観測したセッション開始からの時間を検証します。セッション消費とランキング登録は1つのD1 batchで実行します。初回は `201`、同じID・内容・所有者の再送は `200` です。ID競合または使用済みセッションは `409` です。

セッションを取得できずオフラインで開始したゲームは端末履歴だけに保存し、公開ランキングへは送りません。開始後の通信断はセッションの有効期限内だけ同じIDで再送します。

### `GET /rankings`

| Name | Values | Default |
| --- | --- | --- |
| `gameType` | `strawberry_rush`, `island_rush`, `flag_rush`, `color_rush` | `strawberry_rush` |
| `islandRegion` | `all`, `hokkaido_tohoku`, `kanto`, `chubu_kinki`, `chugoku`, `shikoku`, `kyushu_north`, `kyushu_south`, `okinawa`; 互換読込用 `kyushu` | `all` |
| `period` | `all`, `daily`, `weekly`, `monthly` | `all` |
| `limit` | 1から100 | 30 |

JSTの日・月境界、月曜日開始の週境界で集計します。同じモード・島地域でBearer所有者ごとに最高点1件を返し、同点は記録日時の早い順です。同名でも所有者が異なれば別順位です。所有者ハッシュ導入前の行だけは、後方互換のため正規化した同名ごとに重複排除します。

任意のBearerを付けると、返却範囲に本人の最高記録がある場合だけ、その1件へ `"isCurrentPlayer": true` を付けます。このフラグは本人向け表示用で、匿名応答と公開エッジキャッシュには保存しません。その他の行ではフィールド自体を省略します。

`kyushu_north` は福岡・佐賀・長崎の90島、`kyushu_south` は熊本・大分・宮崎・鹿児島の59島です。分割前の149島で記録したスコアは条件が異なるため新2部門へ移動・複製せず、旧クライアントと本人履歴の互換用 `kyushu` に保全します。

匿名で既定 `limit=30`・`no-cache` / `no-store` 指定なしの要求は拠点単位の公開スナップショットを内部キャッシュします。30秒以内は `hit`、初回は `miss`、再検証中または順位集計の不調時に5分以内の保存値を再利用する場合は `stale` です。応答前にprimaryで削除・運営制限・NG名を再確認し、確認不能時は未検査の名前を返しません。HTTP応答は `no-store` とします。

Bearer付き順位は本人ブロックをSQLの全体順位計算後・LIMIT前に適用し、常にprimaryから読み、共有キャッシュを迂回します。`publicRank` は非表示適用前の公開順位なので、相手をブロックしても全体順位は繰り上がりません。`x-rankings-cache: bypass`、`private, no-store`、`Vary: Authorization` を返します。所有者ハッシュやブロック対象キーを返しません。`x-d1-primary` と `x-d1-region` は順位本体の読込先です。取得済み画面やオフライン端末を遠隔で消すことまでは保証しません。

### 本人用Endpoints

- `GET /players/me/history?gameType=<type>&limit=<1-100>`: Bearer所有者の新しい順の履歴。島は地域付きです。
- `GET /players/me/best?gameType=<type>`: Bearer所有者の自己最高点。
- `DELETE /players/me/scores`: Bearer所有者の全公開スコア・本人の通報・ブロックを同じbatchで削除し、削除スコア件数 `{ "deleted": 4 }` を返します。運営制限は解除しません。

本人用応答はキャッシュ禁止です。プレイヤー名をURLや認可条件に使いません。

### モデレーション（本ブランチの追加）

| Endpoint | 本文・応答 |
| --- | --- |
| `POST /ranking-reports` | 本人Bearer、`{rankingId, reason}`。reasonは `offensive`, `personal_information`, `impersonation`, `other`。`{id, status: "received"}` |
| `GET /players/me/blocks` | 本人専用の `{id, rankingId, playerName, createdAt}[]` |
| `POST /players/me/blocks` | 本人Bearer、`{rankingId}`。更新後の本人ブロック一覧 |
| `DELETE /players/me/blocks` | 本人Bearer、`{blockId}`。解除後の本人ブロック一覧 |
| `GET /moderation/reports?status=open` | 運営専用。open/hidden/dismissed/restoredの受付日時順100件 |
| `POST /moderation/reports` | 運営専用。`{reportId, decision: "hide"/"dismiss"/"restore"}`。保持期限後の解除は `{enforcementId, decision: "restore"}` |
| `GET /moderation/restrictions` | 運営専用の制限受付番号・日時一覧 |
| `GET/POST/DELETE /moderation/name-rules` | 運営専用。追加は `{term, matchType: "exact"/"contains"}`、削除は `{ruleId}`、応答はルール一覧 |

運営APIは `MODERATION_ADMIN_TOKEN` のBearer必須、Origin付き要求とpreflightは拒否します。すべての追加応答はno-storeです。利用者の通報とブロックは2 KiB本文・許可Origin・本人資格情報を検証します。自分自身の通報・ブロックはできません。通報は20件/24時間、通報・ブロック書込は接続元単位8件/分、ブロック最大200、NG最大100です。詳細と保持期間は [MODERATION.md](./MODERATION.md) を参照してください。

NG名の400は `code: "NAME_NOT_ALLOWED"`、運営制限の403は `code: "PLAYER_RESTRICTED"` を返します。ゲーム開始のJSONに任意 `playerName` を指定すると開始前にも照合します。未指定の旧クライアントとの互換を維持し、投稿時の照合は常に行います。端末だけのプレイは停止しません。

## Browser And Native

ブラウザの書込とpreflightは `ALLOWED_ORIGINS` の完全一致を要求します。許可メソッドは `GET, POST, DELETE, OPTIONS`、許可ヘッダーは `Authorization, Content-Type` です。Originを持たないReact Native通信にも同じBearer、入力、セッション、頻度検証を適用します。CORSは認証ではありません。

## Errors And Limits

| Status | Meaning |
| --- | --- |
| `400` | JSON、入力、得点、時間、セッションの不整合 |
| `401` | Bearerなし、または不正 |
| `403` | 不許可Origin、または別所有者・別スコープのセッション |
| `404` / `405` | 未定義経路 / 定義済み経路への不許可メソッド。`405` は `Allow` 付き |
| `409` | 投稿ID競合、使用済み・失効セッション |
| `413` / `415` | 2 KiB超過 / JSON以外 |
| `429` | 接続元ごとの8セッション/分を超過 |
| `500` / `503` | 内部障害、D1障害、必須secret不備 |

`429` は `Retry-After: 60`、一時的な `503` は `Retry-After: 5` を返します。クライアントは `408`、`429`、`5xx`、通信失敗だけを最大2回まで指数バックオフと短いjitter付きで再試行します。ゲーム開始セッションは開始時刻の意味を変えないよう自動再試行しません。

連投識別子はIPとUser-Agentを秘密ソルト付きSHA-256へ変換し、元データを保存しません。分単位バケットと失効ゲームセッションの削除、本番Web/D1心拍の更新は15分ごとのCloudflare Cronで実行します。
