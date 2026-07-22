# いちごつめ！

30秒間に2択を解き続ける、Expo製の日本語ミニゲームです。いちご、島、国旗、色の4モードと、全体・日別・週別・月別のオンラインランキングを提供します。

- Web: https://toyo1621.github.io/StrawberryApp/
- Rankings API: https://strawberry-rankings-api.toyo1621.workers.dev/health

## 主な機能

- 4種類のゲームモードと、島の8出題エリアを含むスコープ別ランキング
- JST基準の全体・日別・週別・月別集計
- 端末の秘密トークンで保護した全モードのスコア履歴と自己削除
- 通信失敗時のローカル保存と、次回起動時の自動同期
- ダークモード、振動設定、動きを減らすOS設定への対応
- スクリーンリーダー向けラベル、見出し階層、選択状態、誤答通知、44px操作領域
- ローカルアセットだけで表示できる国旗と、415の有人離島画像
- 島モードの日本全国、北海道・東北、関東、中部・近畿、中国、四国、九州、沖縄の出題エリア
- 島モードの全国・地方別ランキングと地域付きスコア履歴

ゲームの共通ルールは30秒、正解1点、不正解で3秒減少、時間回復を含む最長セッションは5分です。タイマーは締切時刻から再計算するため、画面が一時停止しても経過時間がずれません。詳細はアプリ内の「ルール」と [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## 技術構成

- Expo 54 / React 19 / React Native 0.81 / React Native Web
- TypeScript 5.9
- Cloudflare Workers / D1
- React Native Async Storage / Expo Crypto
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
npm run check            # lint、型、27+21件以上の単体/Workerテスト、D1移行、設定、依存監査
npm run test:e2e         # Desktop Chrome + Pixel 7、axe、操作領域、性能を含む15検査
npm run build:native-bundles # iOS/AndroidのMetro本番バンドル
npm run build:web
npm run check:web-build  # JS 950 KiB、島SVG 12 MiB、全体14 MiBの予算と415件完全性
```

Pull Requestの `Quality` workflowとPages公開ゲートが同じ検査を実行します。毎時監視はWeb、ファビコン、全4ランキング、CORS、D1、テストスコアの登録・非公開履歴・削除まで確認し、失敗時はGitHub Issueを自動作成します。

## ディレクトリ

```text
src/
  assets/islands/   415件の有人離島SVG
  components/       画面と共通UI
  data/islands.ts   有人離島名・都道府県・自治体・地域の一覧
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
- [API.md](./API.md): API v3のリクエスト、認可、応答、エラー
- [QUALITY.md](./QUALITY.md): 自動品質ゲート、性能予算、手動確認範囲
- [SECURITY.md](./SECURITY.md): 脅威モデル、入力防御、秘密情報、報告方法
- [OPERATIONS.md](./OPERATIONS.md): 監視、障害対応、バックアップ、復旧
- [DEPLOYMENT.md](./DEPLOYMENT.md): Worker、D1、Pages、EASの公開手順
- [CONTRIBUTING.md](./CONTRIBUTING.md): 開発・テスト・リリース手順
- [CHANGELOG.md](./CHANGELOG.md): リリースごとの利用者・運用変更

## データについて

公開ランキングには入力したプレイヤー名、スコア、モード、島の出題地域、登録日時が表示されます。全履歴と削除は端末で生成した秘密トークンで認可し、サーバーにはSHA-256所有者ハッシュだけを保存します。連投対策の接続元ハッシュと回数は15分以内に削除します。詳細はアプリ内のプライバシーポリシーと [SECURITY.md](./SECURITY.md) に記載しています。
