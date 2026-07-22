# Rankings API v4

Base URL: `https://strawberry-rankings-api.toyo1621.workers.dev`

本文を持つ応答はJSONで、CORS preflightの成功だけは本文のない `204` です。JSON応答には `x-api-version: 4`、実行中WorkerのGitタグまたはCloudflare version IDを示す `x-release-id`、追跡用 `x-request-id` が付きます。全応答にCSP、HSTS、`nosniff`、frame拒否、Referrer Policy、Permissions Policyを設定します。内部例外、Bearerトークン、接続元の生情報は応答・構造化ログへ出しません。ランキング応答では `x-rankings-cache`、`x-d1-region`、`x-d1-primary` もCORS経由で参照できます。

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
{ "ok": true, "service": "strawberry-rankings-api", "version": 4, "release": "<release-id>" }
```

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
| `islandRegion` | `all`, `hokkaido_tohoku`, `kanto`, `chubu_kinki`, `chugoku`, `shikoku`, `kyushu`, `okinawa` | `all` |
| `period` | `all`, `daily`, `weekly`, `monthly` | `all` |
| `limit` | 1から100 | 30 |

JSTの日・月境界、月曜日開始の週境界で集計します。同じモード・島地域でBearer所有者ごとに最高点1件を返し、同点は記録日時の早い順です。同名でも所有者が異なれば別順位です。所有者ハッシュ導入前の行だけは、後方互換のため正規化した同名ごとに重複排除します。

Bearerなし・既定 `limit=30`・`no-cache` 指定なしの要求は実行拠点単位でキャッシュします。30秒以内は `hit`、初回は `miss`、再検証中またはD1障害時に5分以内の保存済み値を返す場合は `stale` です。それ以外は `bypass` です。投稿成功直後にクライアントが行うBearer付き要求はブラウザとエッジのキャッシュを迂回し、`first-primary` で確定済みの順位を返します。この応答は `private, no-store`、全公開順位応答は `Vary: Authorization` とし、ゲーム開始前の匿名応答が保存直後の認証付き要求へ再利用されないようにします。投稿後は同じ拠点の対象モード・地域4期間を失効しますが、通常のBearerなし読込は別拠点で最大30秒古い結果を返す可能性があります。

通常の公開順位はD1 read replicationを許可し、Bearer付き公開順位、本人履歴、自己ベストはprimaryから読みます。応答の `x-d1-primary` は実際の読込先、`x-d1-region` はD1メタデータが返した地域です。削除後も別拠点のキャッシュで通常最大30秒、D1障害中のstale fallbackで最大5分、削除済みの公開行が表示される可能性があります。

### 本人用Endpoints

- `GET /players/me/history?gameType=<type>&limit=<1-100>`: Bearer所有者の新しい順の履歴。島は地域付きです。
- `GET /players/me/best?gameType=<type>`: Bearer所有者の自己最高点。
- `DELETE /players/me/scores`: Bearer所有者の全公開スコアを削除し、`{ "deleted": 4 }` を返します。

本人用応答はキャッシュ禁止です。プレイヤー名をURLや認可条件に使いません。

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

連投識別子はIPとUser-Agentを秘密ソルト付きSHA-256へ変換し、元データを保存しません。分単位バケットは15分以内、失効ゲームセッションは15分ごとのcronで削除します。
