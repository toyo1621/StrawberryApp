# Deployment

本番はGitHub Pages、Cloudflare Worker、Cloudflare D1で構成します。互換性を保つため、リリース順序は **D1 Time Travel復元点、D1マイグレーション、Worker、API v4確認、Pages** とします。Pages workflowはAPI v4が利用可能になるまで待機します。

## 事前条件

- Node.js 22
- `npm ci` と `npm run check` が成功すること
- Wranglerで対象Cloudflareアカウントへログイン済みであること
- GitHub PagesのSourceが `GitHub Actions` であること

```bash
npx wrangler whoami
```

## Cloudflare D1

新規環境ではD1を作成し、表示されたIDを `worker/wrangler.toml` に設定します。

```bash
npx wrangler d1 create strawberry-rankings
npm run d1:apply-schema
```

既存環境ではWranglerの履歴テーブルを使い、未適用マイグレーションだけを番号順に適用します。

```bash
npm run d1:migrate
```

- `0004` は所有者ハッシュと履歴用インデックスを追加します。既存行は `NULL` のまま公開順位を維持します。
- `0005` は短期保持の連投イベントを原子的な分単位バケットへ置き換えます。
- `0006` は5分のゲーム契約に合わせてスコア制約を拡張し、全ランキング行とインデックスを引き継ぎます。適用前バックアップが必須です。
- `0007` は島ランキングの地域列と地域別インデックスを追加し、既存の島ランキングをすべて日本全国へ引き継ぎます。適用前後で総件数と `island_region = 'all'` の件数を照合します。
- `0008` は地域分割前に日本全国へ引き継いだ島ランキングだけを関東へ再分類します。適用前後で島ランキング総件数が一致し、`all` から `kanto` へ件数が移ったことを照合します。
- `0009` は所有者・モード・島地域へ結び付いた使い切りゲームセッション表を追加します。ランキング行は変更しません。

## Cloudflare Worker

`RATE_LIMIT_SALT` は必須です。16文字以上のランダム値を設定し、リポジトリやログへ出力しません。

```bash
npx wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.toml
npx wrangler deploy --dry-run --config worker/wrangler.toml
npm run worker:deploy -- --tag "$(git rev-parse HEAD)" --message "manual release"
EXPO_PUBLIC_RANKINGS_API_URL=https://strawberry-rankings-api.toyo1621.workers.dev npm run smoke:rankings-api
```

WorkerはブラウザOrigin、Bearer所有者、JSON Content-Type、2 KiB上限、使い切りゲームセッション、名前、モード、島地域、整数スコア、5分上限、サーバー観測時間、成立可能な得点速度を検証します。投稿IDの冪等化、セッション消費と挿入のD1 batch、原子的な連投制限、D1接続を確認する `/health` を備えます。`x-release-id` はCloudflare version metadataのGit tagまたはversion IDです。

GitHub Actionsから公開する場合は、`production` Environmentに次を登録します。

- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `CLOUDFLARE_ACCOUNT_ID`
- Worker secret: `RATE_LIMIT_SALT`（Wranglerで登録）

`Deploy Rankings Worker` workflowは検証、D1 Time Travel bookmark取得、migration、Git SHA tag付きWorker公開、本番のセッション発行・登録・履歴・削除スモーク、release ID照合を順番に実施します。失敗時もStep Summaryに復元コマンドを残します。

## GitHub Pages

Repository Variable `EXPO_PUBLIC_RANKINGS_API_URL` に本番Worker URLを登録します。`main` へのpushで `Deploy GitHub Pages` workflowが次を実行します。

1. lint、型検査、単体・Workerテスト、空D1への全移行、設定検査、依存監査
2. Desktop、Pixel 7、320px小型画面E2E、全主要画面のaxe WCAG A/AA、44px操作領域、性能検査
3. 本番Webビルドと950 KiB/JS・12 MiB/島SVG・14 MiB/全体の容量予算検査
4. Pages公開
5. 公開URLとランキングAPIのスモーク検査

公開URL:

```text
https://toyo1621.github.io/StrawberryApp/
```

## 手動リリース順序

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
EXPO_PUBLIC_RANKINGS_API_URL=https://strawberry-rankings-api.toyo1621.workers.dev npm run build:web
npm run check:web-build
```

1. D1 Time Travel bookmarkとモード・地域別件数を記録します。必要なら暗号化SQL exportも取得します。
2. `npm run d1:migrate`、`npm run worker:deploy`、APIスモークの順で実行します。
3. 変更をPRで `main` へマージし、Pages workflowの成功を確認します。
4. WebとAPIのスモーク、D1件数、Workerバージョンを再確認します。

```bash
WEB_URL=https://toyo1621.github.io/StrawberryApp npm run smoke:web
EXPO_PUBLIC_RANKINGS_API_URL=https://strawberry-rankings-api.toyo1621.workers.dev npm run smoke:rankings-api
```

## Supabaseからの初回移行

秘密情報をコミットせずにエクスポートし、D1用SQLを生成します。

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_ANON_KEY=your-key \
npm run export:supabase
npm run write:d1-import
npm run d1:import
```

`rankings-export.json` と生成した `rankings-import.sql` はGit管理対象外です。インポート前後にモード別件数を照合し、既存ランキングのバックアップを取得します。

## Expo / App Store / Play Store

`app.config.js` にiOS bundle identifier、Android package、ビルド番号、1024px不透明アイコン、iOS Privacy Manifestを定義しています。EAS資格情報を設定後、次でストア用成果物を作成・提出できます。

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile production
```

公開前には実機で全4モード、振動、ダークモード、VoiceOver/TalkBack、オフライン復帰を確認し、各ストアのプライバシー回答とアプリ内ポリシーを一致させます。

## ロールバック

- Pages: GitHub Actionsの直前の成功コミットをrevertして再公開します。
- Worker: 直前のGitコミットから `npm run worker:deploy` を実行します。
- D1: migration前のTime Travel bookmarkへ復元し、地域別件数とAPI smokeを確認します。保持期間を超える復旧には事前SQL exportを使います。

判断基準と障害対応は [OPERATIONS.md](./OPERATIONS.md) を参照してください。
