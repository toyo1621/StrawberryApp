# Security

## 脆弱性の報告

公開Issueに秘密情報や再現用個人データを書かず、[GitHub Security Advisory](https://github.com/toyo1621/StrawberryApp/security/advisories/new) から非公開で報告してください。受領後3営業日以内の確認、重大度判定後の修正計画提示を目標とします。

## 保護対象と脅威

保護対象はランキングの完全性、D1の可用性、利用者が入力した名前、Cloudflare資格情報です。主な脅威は、改変クライアントからの異常得点、連続投稿、二重送信、不正Origin、巨大・不正形式の本文、依存パッケージの既知脆弱性、ログや設定への秘密情報混入です。

## 実装済みの対策

- ブラウザのPOST/DELETE/OPTIONSは許可Origin以外を拒否し、Originを持たないネイティブ通信は同じ入力・頻度検証を適用
- `application/json` と2 KiB本文上限を強制
- 名前の正規化、長さ・制御文字・危険なHTML文字の拒否
- モード、島地域、整数スコア、プレイ時間、成立可能な得点速度をWorkerで再検証
- 投稿IDを主キーにした冪等登録と競合検出
- D1の一意な分単位バケットをUPSERTする原子的な8件/分の連投制限
- IPアドレスとUser-Agentを秘密ソルト付きSHA-256にし、元データを保存せず、バケットを15分ごとのcronで削除
- 128-bitランダム端末トークンのBearer認可。D1にはSHA-256所有者ハッシュだけを保存し、履歴列挙と削除を所有者へ限定
- SQLはD1 prepared statementのbindだけで実行
- APIの `nosniff`、Referrer Policy、Permissions Policy、CORS、Cache-Control
- 5xxでは内部詳細を返さず、リクエストID付き構造化ログを記録
- npm監査、lint、型、テスト、E2Eを公開ゲートに設定
- GitHub Secret Scanning、Push Protection、Dependabot、必須PR品質チェックを有効化
- 秘密情報と生成エクスポートを `.gitignore` で除外

## 秘密情報

- `RATE_LIMIT_SALT` はWrangler secretへ16文字以上のランダム値として保存します。
- `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` はGitHub `production` EnvironmentのSecretsに保存します。
- Expoの `EXPO_PUBLIC_` 変数は公開情報です。秘密鍵を置いてはいけません。
- Cloudflare API tokenは対象Worker/D1の公開に必要な最小権限とし、不要時に失効します。

## 依存関係

通常の変更では `npm ci` を使い、lockfileを必ずレビューします。CIの `npm run audit:high` はhigh/criticalを公開前に拒否します。依存更新時は `npm audit`、単体テスト、E2E、本番相当ビルドを実行します。

## 既知の限界

- CORSはブラウザ境界であり、API認証ではありません。履歴と削除だけを端末Bearerトークンで認可します。
- 匿名ゲームなので、改変したクライアントによる人間らしい範囲の不正得点を完全には判定できません。
- 公開名は個人情報を書かない前提の自由入力です。メールアドレス等を入力しないようアプリ内で案内します。
- 端末トークンを失うと旧端末の所有記録を自己削除できません。所有者ハッシュ導入前の移行記録は問い合わせ対応です。
- CSPなどPages側のHTTPレスポンスヘッダーはGitHub Pagesでは細かく制御できません。アプリは外部国旗CDNを廃止し、実行時依存を減らしています。

認証、賞品、課金を追加する場合は、現在の匿名ランキングを流用せず、本人確認、サーバー権威のゲーム進行、不正検知、削除請求の設計を改めて行います。
