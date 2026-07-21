# Contributing

## 開発環境

- Node.js 22
- npm lockfileを使用
- Expo対応のiOS Simulator / Android Emulator、またはWebブラウザ

```bash
npm ci
cp .env.example .env
npm run web
```

## 変更の原則

- モード共通値は `src/gameConfig.ts`、純粋ロジックは `src/domain/` に置きます。
- API入力はクライアントを信用せず、`worker/src/rankingValidation.ts` で検証します。
- 新しい外部通信、端末保存項目、ログ項目はプライバシーポリシーと `SECURITY.md` を同時に更新します。
- UIはライト/ダーク、320px幅、キーボード、スクリーンリーダー、動きを減らす設定を確認します。
- MVPに不要な状態管理、ルーター、分析SDKは追加しません。

## 必須チェック

```bash
npm run check
npm run test:e2e
EXPO_PUBLIC_RANKINGS_API_URL=https://strawberry-rankings-api.toyo1621.workers.dev npm run build:web
npm run check:web-build
npx wrangler deploy --dry-run --config worker/wrangler.toml
```

テストの責務:

| 種別 | 対象 |
| --- | --- |
| `tests/` | シャッフル、色分類、締切タイマー、ゲーム/Worker得点契約、ランキング、キャッシュ/キュー |
| `worker/src/*.test.ts` | 入力拒否、Bearer所有権、ネイティブ通信、CORS、冪等性、原子的連投、JST、削除 |
| `test:db` | 空のローカルD1へ全migrationを適用し、所有者インデックスと制限テーブルを照合 |
| `e2e/` | 全モード、ダーク、Desktop/Mobile、axe、ARIA状態、誤答通知、44px、削除、性能 |

バグ修正には再現テストを追加します。ゲームルールを変える場合は純粋ロジック、Workerの成立性検証、アプリ内ルール、`ARCHITECTURE.md` を同じ変更に含めます。

## レビュー観点

- 既存ランキングとの後方互換性
- オフライン時と再接続時の挙動
- 二重投稿、競合、タイムアウト
- 320pxとデスクトップの表示、44px以上の主要タップ領域
- ラベル、選択状態、live region、コントラスト
- D1マイグレーションのデータ影響と復旧方法
- lockfile差分と依存監査

## リリース

1. バージョン、iOS buildNumber、Android versionCodeを更新します。
2. 必須チェックと実機確認を完了します。
3. D1変更前にバックアップを取得し、番号付きmigrationを追加します。
4. D1 migration、Worker、Pagesの順に公開します。
5. Web/API smoke、全4モードのランキング、オフライン復帰を確認します。
6. 問題時に戻すコミットとバックアップを記録します。

詳しい公開・復旧手順は [DEPLOYMENT.md](./DEPLOYMENT.md) と [OPERATIONS.md](./OPERATIONS.md) にあります。
