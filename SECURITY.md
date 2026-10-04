# Security

## 脆弱性の報告

公開Issueに秘密情報や再現用個人データを書かず、[GitHub Security Advisory](https://github.com/toyo1621/StrawberryApp/security/advisories/new) から非公開で報告してください。受領後3営業日以内の確認、重大度判定後の修正計画提示を目標とします。

## 保護対象と脅威

保護対象はランキングの完全性、本人履歴・削除権限、D1の可用性、利用者が入力した名前、Cloudflare資格情報です。主な脅威は、改変クライアントからの異常得点、ゲーム未実行の直接投稿、セッション再利用、連続投稿、二重送信、不正Origin、巨大・不正形式の本文、依存・CIサプライチェーン、ログや設定への秘密情報混入です。

## 実装済みの対策

- ブラウザのPOST/DELETE/OPTIONSは許可Origin以外を拒否し、Originを持たないネイティブ通信は同じ入力・頻度検証を適用
- `application/json` と2 KiB本文上限を強制
- 名前のNFC正規化、Unicodeコードポイント数の上限、C0/C1制御・不可視・双方向制御・危険なHTML文字のクライアント/Worker両方での拒否
- 開始前にBearer所有者・モード・島地域へ結び付けた15分有効のUUIDゲームセッションをWorkerで発行
- モード、島地域、整数スコア、プレイ時間、成立可能な得点速度、サーバー観測経過時間をWorkerで再検証
- ゲームセッション消費とスコア挿入をD1 batchで確定し、1セッション1投稿を強制
- 投稿IDを主キーにした冪等登録と内容・所有者競合の検出
- D1の一意な分単位バケットをUPSERTする原子的な8セッション/分の連投制限
- IPアドレスとUser-Agentを秘密ソルト付きSHA-256にし、元データを保存せず、バケットを15分ごとのcronで削除
- 128-bitランダム端末トークンのBearer認可。ネイティブではSecureStoreだけへ保存し、未送信Async Storageキューへ複製しない。D1にはSHA-256所有者ハッシュだけを保存して公開順位、履歴列挙、削除を所有者へ限定
- SQLはD1 prepared statementのbindだけで実行
- APIのCSP、HSTS、`nosniff`、frame拒否、Referrer Policy、Permissions Policy、CORS、Cache-Control
- 外部入力のリクエストIDを96文字以内の安全な文字種に制限し、不正値はサーバー生成UUIDへ置換
- 5xxでは内部詳細を返さず、リクエストID付き構造化ログを記録
- 本人マーカーはBearer所有者をprimaryで照合したprivate応答にだけ合成し、匿名応答と公開キャッシュへ保存しない
- 本番・開発依存を含むnpm監査、CodeQLのJavaScript/TypeScript解析、最低カバレッジ、実Worker/D1統合、E2Eを公開ゲートに設定
- API種別・期間・地域を正本JSONから生成し、クライアント・Worker・DB制約の不一致をCIで拒否
- 収集データ・目的・保持・処理者を `store/privacy-declarations.json` へ機械可読で固定し、追跡・広告SDKの混入とアプリ内ポリシー不一致をCIで拒否
- すべてのGitHub Actionsを公式タグの不変40桁コミットSHAへ固定し、検査スクリプトでタグ参照への後退を拒否
- Dependabotの週次更新、CODEOWNERS、必須PR品質workflowをリポジトリ内で定義。GitHub Secret Scanning、Push Protection、branch protectionはリポジトリ設定でも有効化して定期監査
- 秘密情報と生成エクスポートを `.gitignore` で除外

## 秘密情報

- `RATE_LIMIT_SALT` はWrangler secretへ16文字以上のランダム値として保存します。
- WorkerとGitHub監視の任意 `MONITOR_ALERT_WEBHOOK_URL` はそれぞれCloudflare secretとGitHub `production` Environment secretへ保存し、HTTPSだけを許可します。
- `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` はGitHub `production` EnvironmentのSecretsに保存します。
- Expoの `EXPO_PUBLIC_` 変数は公開情報です。秘密鍵を置いてはいけません。
- Cloudflare API tokenは対象Worker/D1の公開に必要な最小権限とし、不要時に失効します。

## 依存関係

通常の変更では `npm ci` を使い、lockfileを必ずレビューします。CIの `npm run audit:high` は本番・開発依存のhigh/criticalを公開前に拒否します。脆弱な推移依存をoverrideする場合は修正版を固定し、単体、実D1統合、E2E、本番相当ビルド、Wrangler dry-runを全て実行します。

## 既知の限界

### PR #58の依存監査と暫定修正（2026-10-04確認）

- [braces / GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): 3.0.3が対象。Expo/Metro、Jest、patch-packageからの推移依存で、深くネストしたパターンの処理によるプロセス停止が問題です。確認したMetroの通常マッチング経路はmicromatch経由のpicomatchであり、アプリ入力から脆弱なbraces APIへの到達経路は確認していません。
- [node-forge / GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): 1.4.0が対象。Expo CLIとコード署名証明書ツールに含まれ、RSA署名検証が問題です。現在のアプリには独自のExpo更新署名設定がなく、Workerの認証はWeb CryptoのSHA-256を使います。公開ランキング入力から当該RSA検証への到達経路は確認していません。

これらは開発・ビルドツール側で確認した依存です。ただし依存ツリー上の`dev: false`だけでは本番バンドルへの混入や到達可能性を判断できず、本番で絶対に影響しないという証明ではありません。確認時点で両アドバイザリに修正版はなく、監査のhigh 23件は依存元への伝播を含む件数です。Expo 54を維持し、強制ダウングレードや監査除外は行いません。リスク受容は未承認であり、監査と集約`quality`は引き続き公開を拒否します。修正版公開時には実際の依存経路を再確認して最小更新し、全品質検証を再実行します。

リポジトリには次のローカル暫定パッチを保存しています。これは公式修正版の公開や監査の合格を意味しません。`npm ci`のpostinstallで適用し、適用失敗はインストールを失敗させます。`npm run test:security`はlockfile内の対象パッケージの全インストール箇所を検査し、バージョン変更時には再レビューを要求します。

- `patches/braces+3.0.3.patch`: [上流報告 #70](https://github.com/micromatch/braces/issues/70)の深さ制限案に基づくローカル実装。文字列の波括弧・丸括弧を合わせたネストを100段までに制限し、直接渡されたASTにもcompile/expand/stringifyの再帰上限を設けます。超過時はスタック枯渇前にSyntaxErrorを返します。呼び出し側で例外を処理する必要は既存の入力長制限と同様に残ります。展開の組合せ爆発を全面解決するパッチではありません。
- `patches/node-forge+1.4.0.patch`: [上流PR #1152](https://github.com/digitalbazaar/forge/pull/1152)のhead `ceba34402e329f0365134f23fe19898756527d65`から、nested DigestAlgorithmの要素数を検査する3行の修正を取り込みました。このPRは確認時点で未マージです。OIDと任意のNULL以外の余分な要素を拒否します。

回帰テストは深いパターン、未閉鎖パターン、直接AST、正常なglob・範囲・引用文字列、RSAの不正な内側/外側要素、NULLあり/なしの正常署名、自己署名証明書を対象とします。公式修正版が公開されたら、暫定パッチを削除して同じテストと全品質CIを通し、npm監査も成功することを公開条件にします。本番への反映は別途行います。

### アプリと運用の限界

- CORSはブラウザ境界であり、API認証ではありません。ゲームセッション、投稿、履歴、削除は端末Bearerトークンで認可します。
- 匿名ゲームなので、使い切りセッションと時間・得点上限の範囲内で改変クライアントが作る不正得点を完全には判定できません。
- WebのBearerトークンはブラウザのローカルストレージにあり、同一Originで任意JavaScriptが実行された場合は保護できません。外部実行時依存を持たず、入力をReact textとして描画してXSS面を縮小しています。
- 公開名は個人情報を書かない前提の自由入力です。メールアドレス等を入力しないようアプリ内で案内します。
- 端末トークンを失うと旧端末の所有記録を自己削除できません。所有者ハッシュ導入前の移行記録は問い合わせ対応です。
- 公開ランキングはCloudflareのエッジとD1 read replicaで処理されます。別拠点のキャッシュにより、削除反映は通常最大30秒、D1障害時は最大5分遅れる可能性があります。
- GitHub PagesではHTTPレスポンスヘッダーを細かく制御できないため、生成HTMLへCSPと`no-referrer`を注入し、スクリプトを同一オリジン、API通信を本番Workerへ限定します。`frame-ancestors`などヘッダーでのみ完全に強制できる防御はPagesの制約として残ります。
- 島SVGは国土地理院「地理院地図」を参照し、toyo1621が独自に編集・制作したデータです。出典、加工主体、利用条件へのリンク、データ指紋を `DATA_SOURCES.md` に記録します。

認証、賞品、課金を追加する場合は、現在の匿名ランキングを流用せず、本人確認、サーバー権威のゲーム進行、不正検知、削除請求の設計を改めて行います。
