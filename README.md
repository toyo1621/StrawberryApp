# いちごつめ！

30秒間に2択を解き続ける、Expo製の日本語ミニゲームです。いちご、島、国旗、色の4モードと、全体・日別・週別・月別のオンラインランキングを提供します。

- Web: https://toyo1621.github.io/StrawberryApp/
- Rankings API: https://strawberry-rankings-api.toyo1621.workers.dev/health

## 主な機能

- 4種類のゲームモードと、島の8出題エリアを含むスコープ別ランキング
- JST基準の全体・日別・週別・月別集計
- サーバー発行の使い切りゲームセッションで検証したランキング投稿
- 端末所有者単位の公開順位と、秘密トークンで保護した全モードのスコア履歴・自己削除
- 通信失敗時のローカル保存と、起動・アプリ復帰時の期限内自動同期
- オンラインランキングへの今後の送信を停止し、スコアを端末履歴だけに保存できる設定
- 公開ランキングのD1 read replication、30秒エッジキャッシュ、5分以内の障害時表示継続
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
- React Native Async Storage / Expo SecureStore / Expo Crypto
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
npm run check            # lint、型、カバレッジ付き単体/Workerテスト、D1移行・統合、全依存監査
npm run doctor           # 固定バージョンのExpo設定・依存整合性検査
npm run test:e2e         # Chromium/Firefox/WebKit、Pixel 7、320px、axe、操作領域、性能
npm run build:native-bundles # iOS/AndroidのMetro本番バンドル
npm run check:native-build   # Hermes 2.5 MiB、各export 16 MiB、415島の予算
npm run build:web
npm run check:web-build  # JS 700 KiB、島SVG 12 MiB、全体14 MiBの予算と415件完全性
```

Pull Requestの `Quality` workflowとPages公開ゲートが同じ検査を実行します。循環依存・層境界・主要ファイル行数、40並列cache miss、32並列の実Worker/D1読込も自動検査します。15分監視はWeb、ファビコン、全4ランキング、CORS、D1、ランキングcache hit、テストスコアの登録・非公開履歴・削除後の不在に加え、WebとAPIが同一Git SHAから公開されていることまで確認します。失敗時はGitHub Issueと設定済みの外部Webhookへ通知します。

## ディレクトリ

```text
src/
  assets/islands/   415件の有人離島SVG
  components/       画面と共通UI
  data/islands.ts   有人離島名・都道府県・自治体・地域の一覧
  domain/           純粋なゲーム・ランキングロジック
  hooks/            起動・復帰時のデータ調整
  services/         API、端末保存、キャッシュ、排他制御付き送信キュー
  gameConfig.ts     4モード共通設定
  gameRules.ts      4モードの得点・時間ルール
worker/
  src/              API経路、ランキング、投稿、本人データ、入力検証、テスト
  migrations/       D1マイグレーション
  schema.sql         新規D1用スキーマ
e2e/                Playwright操作・アクセシビリティテスト
scripts/            検証、スモーク、移行補助
```

## 文書

- [ARCHITECTURE.md](./ARCHITECTURE.md): 構成、データフロー、業務ルール
- [API.md](./API.md): API v4のセッション、認可、応答、エラー
- [QUALITY.md](./QUALITY.md): 自動品質ゲート、性能予算、手動確認範囲
- [SECURITY.md](./SECURITY.md): 脅威モデル、入力防御、秘密情報、報告方法
- [OPERATIONS.md](./OPERATIONS.md): 監視、障害対応、バックアップ、復旧
- [DEPLOYMENT.md](./DEPLOYMENT.md): Worker、D1、Pages、EASの公開手順
- [CONTRIBUTING.md](./CONTRIBUTING.md): 開発・テスト・リリース手順
- [CHANGELOG.md](./CHANGELOG.md): リリースごとの利用者・運用変更
- [DATA_SOURCES.md](./DATA_SOURCES.md): 島データの出典、制作、変換、完全性検証

## データについて

公開ランキングには入力したプレイヤー名、スコア、モード、島の出題地域、登録日時が表示されます。順位の重複排除、全履歴、削除は端末で生成した秘密トークンの所有者単位で扱い、サーバーにはSHA-256所有者ハッシュだけを保存します。ネイティブのトークンはSecureStore、Webではローカルストレージだけに保存し、Async Storageの未送信キューには複製しません。オンラインランキングをオフにすると今後の書込と保存待ち送信を停止し、保存待ちキューを端末から削除します。既存の公開スコアはマイページから削除できます。詳細はアプリ内のプライバシーポリシーと [SECURITY.md](./SECURITY.md) に記載しています。

415件の島形状SVGは、[国土地理院「地理院地図」](https://maps.gsi.go.jp/)を参照し、toyo1621がゲーム表示向けに独自制作した編集・加工物です。詳細は [DATA_SOURCES.md](./DATA_SOURCES.md) に記録しています。
