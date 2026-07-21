# Rankings API v2

Base URL: `https://strawberry-rankings-api.toyo1621.workers.dev`

成功・エラー応答はJSONです。v2応答には `x-api-version: 2` と `x-request-id` が付きます。内部エラーの詳細や秘密トークンは応答・構造化ログへ出しません。

## 認可

初回スコア保存時にクライアントが128-bitのUUID v4を生成し、Async Storageへ保存します。投稿、履歴、削除では次のヘッダーを使います。

```http
Authorization: Bearer <player-token>
```

D1には `SHA-256("player:" + token)` だけを保存します。トークンはアカウント認証ではなく、この端末から登録した履歴の読取・削除権限です。互換期間中はBearerなしの投稿も受理しますが、その記録は非公開履歴と自己削除へ紐付きません。

## Endpoints

### `GET /health`

D1へ `SELECT 1` を実行します。`200` は `{ "ok": true, "service": "strawberry-rankings-api", "version": 2 }`、キャッシュは禁止です。

### `GET /rankings`

Query:

| Name | Values | Default |
| --- | --- | --- |
| `gameType` | `strawberry_rush`, `island_rush`, `flag_rush`, `color_rush` | `strawberry_rush` |
| `period` | `all`, `daily`, `weekly`, `monthly` | `all` |
| `limit` | 1から100 | 30 |

JSTの日・月境界、月曜日開始の週境界で集計し、正規化した同名ごとに最高点1件を返します。同点は記録日時の早い順です。

### `POST /scores`

`Content-Type: application/json`、本文は2 KiB以下です。Bearerを付けると所有者ハッシュへ紐付きます。

```json
{
  "submissionId": "5bfec55d-73a6-42d4-ae19-71d377736ab8",
  "playerName": "プレイヤー",
  "score": 12,
  "gameType": "strawberry_rush",
  "durationMs": 30000
}
```

初回は `201`、同じID・内容の再送は `200` です。同じIDの内容または所有者が異なる場合は `409` です。ゲームは1秒以上5分以下で、モード別の理論得点速度・最大点を検証します。

### `GET /players/me/history`

Bearer必須です。`gameType` と `limit` を受け取り、その所有者の新しい順の記録だけを返します。プレイヤー名はURLに含めません。

### `GET /players/me/best`

Bearer必須です。`gameType` ごとの自己最高点を `{ "score": 12 }` で返します。

### `DELETE /players/me/scores`

Bearer必須です。その所有者ハッシュに紐づく全モードの記録を削除し、`{ "deleted": 4 }` を返します。

## Browser And Native

ブラウザの書込とpreflightは `ALLOWED_ORIGINS` の完全一致を要求します。許可メソッドは `GET, POST, DELETE, OPTIONS`、許可ヘッダーは `Authorization, Content-Type` です。React Nativeのように `Origin` がない通信も受理しますが、入力、Bearer、得点、投稿頻度の検証は同じです。CORSは認証ではありません。

## Errors And Limits

| Status | Meaning |
| --- | --- |
| `400` | 入力、ゲーム種別、得点、時間、資格情報の不整合 |
| `401` | 履歴・削除のBearerなし、または不正 |
| `403` | 許可されていないブラウザOrigin |
| `409` | 投稿ID競合 |
| `413` / `415` | 本文超過 / JSON以外 |
| `429` | 接続元ごとの8投稿/分を超過 |
| `500` / `503` | 内部障害、D1障害、必須secret不備 |

レート制限は秘密ソルト付き接続元ハッシュと分単位のD1一意キーを原子的にUPSERTします。バケットは最大15分で削除します。
