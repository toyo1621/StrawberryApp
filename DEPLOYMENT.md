# Deployment

本番はGitHub Pages、Cloudflare Worker、Cloudflare D1で構成します。互換性を保つため、リリース順序は **Pages、D1マイグレーション、Worker** とします。

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

`0002_minimize_rate_limit_data.sql` が削除・再作成するのは15分だけ使う連投制限テーブルです。ランキング本体の `rankings` テーブルは変更しません。

## Cloudflare Worker

`RATE_LIMIT_SALT` は必須です。16文字以上のランダム値を設定し、リポジトリやログへ出力しません。

```bash
npx wrangler secret put RATE_LIMIT_SALT --config worker/wrangler.toml
npx wrangler deploy --dry-run --config worker/wrangler.toml
npm run worker:deploy
EXPO_PUBLIC_RANKINGS_API_URL=https://strawberry-rankings-api.toyo1621.workers.dev npm run smoke:rankings-api
```

Workerは許可Origin、JSON Content-Type、2 KiB上限、名前、モード、整数スコア、プレイ時間、モード別の成立可能な得点速度を検証します。投稿IDによる冪等化、クライアント単位の連投制限、D1接続を確認する `/health` を備えます。Worker Observabilityと15分ごとの一時ハッシュ削除は `worker/wrangler.toml` で有効化されています。

GitHub Actionsから公開する場合は、`production` Environmentに次を登録します。

- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `CLOUDFLARE_ACCOUNT_ID`
- Worker secret: `RATE_LIMIT_SALT`（Wranglerで登録）

`Deploy Rankings Worker` workflowは検証、D1一時テーブル移行、Worker公開、本番スモークを順番に実施します。

## GitHub Pages

Repository Variable `EXPO_PUBLIC_RANKINGS_API_URL` に本番Worker URLを登録します。`main` へのpushで `Deploy GitHub Pages` workflowが次を実行します。

1. lint、型検査、単体・Workerテスト、設定検査、依存監査
2. Desktop/Mobile E2Eとaxe WCAG A/AA検査
3. 本番Webビルドと容量予算検査
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

1. 上記変更を `main` へpushし、Pages workflowの成功を確認します。
2. `npm run d1:migrate` を実行します。
3. `npm run worker:deploy` を実行します。
4. WebとAPIのスモーク検査を実行します。

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
- D1: ランキングテーブルを変更するマイグレーション前にSQLエクスポートを取得し、復元手順を先に検証します。

判断基準と障害対応は [OPERATIONS.md](./OPERATIONS.md) を参照してください。
