# いちごつめ！

30秒間に2択を解き続ける、Expo製の日本語ミニゲームです。いちご、島、国旗、色の4モードと、全体・日別・週別・月別のオンラインランキングを提供します。

- Web: https://toyo1621.github.io/StrawberryApp/
- Rankings API: https://strawberry-rankings-api.toyo1621.workers.dev/health

## 主な機能

- 4種類のゲームモードとモード別ランキング
- JST基準の全体・日別・週別・月別集計
- プレイヤーごとの全モードスコア履歴
- 通信失敗時のローカル保存と、次回起動時の自動同期
- ダークモード、振動設定、動きを減らすOS設定への対応
- スクリーンリーダー向けラベル、状態通知、色名・HEX・マンセル値の併記
- ローカルアセットだけで表示できる国旗と島画像

ゲームの共通ルールは30秒、正解1点、不正解で3秒減少です。モードごとに異なる時間回復があり、いちごと島には追加得点の特別問題があります。いちごモードの終了後には記憶チャレンジがあります。詳細はアプリ内の「ルール」と [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## 技術構成

- Expo 54 / React 19 / React Native 0.81 / React Native Web
- TypeScript 5.9
- Cloudflare Workers / D1
- React Native Async Storage
- Node test runner / Playwright / axe-core / ESLint 9
- GitHub Actions / GitHub Pages / EAS Build

## セットアップ

Node.js 22を使用します。

```bash
npm ci
cp .env.example .env
npm run web
```

`.env` の `EXPO_PUBLIC_RANKINGS_API_URL` を省略した場合もプレイでき、ランキングは端末内だけに保存されます。

```bash
npm start       # Expo開発サーバー
npm run ios     # iOSシミュレーター
npm run android # Androidエミュレーター
```

## 品質チェック

```bash
npm run check            # lint、型、単体/Workerテスト、設定、依存監査
npm run test:e2e         # Desktop Chrome + Pixel 7、axe WCAG A/AAを含む
npm run build:web
npm run check:web-build  # JS 900 KiB、全体5 MiBの予算と外部国旗CDN不使用
```

CIは同じ検査を通した後だけPagesへ公開し、公開後にWebとD1接続を含むAPIヘルスチェックを実行します。本番は毎時のスモーク監視も行います。

## ディレクトリ

```text
src/
  components/       画面と共通UI
  domain/           純粋なゲーム・ランキングロジック
  services/         端末保存とランキングAPIクライアント
  gameConfig.ts     4モード共通設定
  gameRules.ts      4モードの得点・時間ルール
worker/
  src/              Worker API、入力検証、テスト
  migrations/       D1マイグレーション
  schema.sql         新規D1用スキーマ
e2e/                Playwright操作・アクセシビリティテスト
scripts/            検証、スモーク、移行補助
```

## 文書

- [ARCHITECTURE.md](./ARCHITECTURE.md): 構成、データフロー、業務ルール
- [SECURITY.md](./SECURITY.md): 脅威モデル、入力防御、秘密情報、報告方法
- [OPERATIONS.md](./OPERATIONS.md): 監視、障害対応、バックアップ、復旧
- [DEPLOYMENT.md](./DEPLOYMENT.md): Worker、D1、Pages、EASの公開手順
- [CONTRIBUTING.md](./CONTRIBUTING.md): 開発・テスト・リリース手順

## データについて

公開ランキングには入力したプレイヤー名、スコア、モード、登録日時が表示されます。投稿の短時間連打を抑えるため、IPアドレスとUser-Agentから秘密ソルト付きハッシュを生成し、元データを保存せず15分以内に削除します。詳細はアプリ内のプライバシーポリシーと [SECURITY.md](./SECURITY.md) に記載しています。
