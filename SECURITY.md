# Security

## 脆弱性の報告

公開Issueに秘密情報や再現用個人データを書かず、[GitHub Security Advisory](https://github.com/toyo1621/StrawberryApp/security/advisories/new) から非公開で報告してください。受領後3営業日以内の確認、重大度判定後の修正計画提示を目標とします。

## 保護対象と脅威

保護対象はランキングの完全性、本人履歴・削除権限、D1の可用性、利用者が入力した名前、Cloudflare資格情報です。主な脅威は、改変クライアントからの異常得点、ゲーム未実行の直接投稿、セッション再利用、連続投稿、二重送信、不正Origin、巨大・不正形式の本文、依存・CIサプライチェーン、ログや設定への秘密情報混入です。

## 実装済みの対策

- ブラウザのPOST/DELETE/OPTIONSは許可Origin以外を拒否し、Originを持たないネイティブ通信は同じ入力・頻度検証を適用
- `application/json` と2 KiB本文上限を強制
- 名前の正規化、長さ・制御文字・危険なHTML文字の拒否
- 開始前にBearer所有者・モード・島地域へ結び付けた15分有効のUUIDゲームセッションをWorkerで発行
- モード、島地域、整数スコア、プレイ時間、成立可能な得点速度、サーバー観測経過時間をWorkerで再検証
- ゲームセッション消費とスコア挿入をD1 batchで確定し、1セッション1投稿を強制
- 投稿IDを主キーにした冪等登録と内容・所有者競合の検出
- D1の一意な分単位バケットをUPSERTする原子的な8セッション/分の連投制限
- IPアドレスとUser-Agentを秘密ソルト付きSHA-256にし、元データを保存せず、バケットを15分ごとのcronで削除
- 128-bitランダム端末トークンのBearer認可。ネイティブではSecureStoreだけへ保存し、未送信Async Storageキューへ複製しない。D1にはSHA-256所有者ハッシュだけを保存して公開順位、履歴列挙、削除を所有者へ限定
- SQLはD1 prepared statementのbindだけで実行
- APIの `nosniff`、Referrer Policy、Permissions Policy、CORS、Cache-Control
- 5xxでは内部詳細を返さず、リクエストID付き構造化ログを記録
- 本番・開発依存を含むnpm監査、最低カバレッジ、実Worker/D1統合、E2Eを公開ゲートに設定
- すべてのGitHub Actionsを公式タグの不変40桁コミットSHAへ固定し、検査スクリプトでタグ参照への後退を拒否
- GitHub Secret Scanning、Push Protection、Dependabot、必須PR品質チェックを有効化
- 秘密情報と生成エクスポートを `.gitignore` で除外

## 秘密情報

- `RATE_LIMIT_SALT` はWrangler secretへ16文字以上のランダム値として保存します。
- `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` はGitHub `production` EnvironmentのSecretsに保存します。
- Expoの `EXPO_PUBLIC_` 変数は公開情報です。秘密鍵を置いてはいけません。
- Cloudflare API tokenは対象Worker/D1の公開に必要な最小権限とし、不要時に失効します。

## 依存関係

通常の変更では `npm ci` を使い、lockfileを必ずレビューします。CIの `npm run audit:high` は本番・開発依存のhigh/criticalを公開前に拒否します。脆弱な推移依存をoverrideする場合は修正版を固定し、単体、実D1統合、E2E、本番相当ビルド、Wrangler dry-runを全て実行します。

## 既知の限界

- CORSはブラウザ境界であり、API認証ではありません。ゲームセッション、投稿、履歴、削除は端末Bearerトークンで認可します。
- 匿名ゲームなので、使い切りセッションと時間・得点上限の範囲内で改変クライアントが作る不正得点を完全には判定できません。
- WebのBearerトークンはブラウザのローカルストレージにあり、同一Originで任意JavaScriptが実行された場合は保護できません。外部実行時依存を持たず、入力をReact textとして描画してXSS面を縮小しています。
- 公開名は個人情報を書かない前提の自由入力です。メールアドレス等を入力しないようアプリ内で案内します。
- 端末トークンを失うと旧端末の所有記録を自己削除できません。所有者ハッシュ導入前の移行記録は問い合わせ対応です。
- GitHub PagesではHTTPレスポンスヘッダーを細かく制御できないため、生成HTMLへCSPと`no-referrer`を注入し、スクリプトを同一オリジン、API通信を本番Workerへ限定します。`frame-ancestors`などヘッダーでのみ完全に強制できる防御はPagesの制約として残ります。
- 島SVGは国土地理院「地理院地図」を参照し、toyo1621が独自に編集・制作したデータです。出典、加工主体、利用条件へのリンク、データ指紋を `DATA_SOURCES.md` に記録します。

認証、賞品、課金を追加する場合は、現在の匿名ランキングを流用せず、本人確認、サーバー権威のゲーム進行、不正検知、削除請求の設計を改めて行います。
