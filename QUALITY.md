# Quality Gates

## Pull Request Gate

`.github/workflows/quality.yml` はPull RequestごとにNode.js 22で次を実行します。

1. `npm ci` とhigh/critical依存監査
2. ESLint、アプリ/Workerのstrict TypeScript
3. アプリ純粋ロジック、通信・保存、Worker境界の単体テスト
4. 空のローカルD1への全migration適用とスキーマ照合
5. Expo Doctor 18項目、iOS/Android本番Metroバンドル
6. Desktop ChromeとPixel 7相当のPlaywright E2E
7. axe WCAG A/AA、ライト/ダーク、見出し、ARIA状態、live region、44px操作領域
8. Web本番ビルド、800 KiB/JS・2 MiB/全体の静的予算、Worker dry-run

失敗時のPlaywright trace、スクリーンショット、HTML reportは7日間だけCI artifactへ保存します。

## Release Gate

`main` のPages workflowは品質チェック後にだけartifactを公開し、WebとAPIの本番スモークを行います。Worker workflowはD1 migration、Worker公開、API v2の登録・履歴・削除スモークを直列化します。

毎時監視は次を外形確認します。

- Web HTML、言語、ファビコン、応答時間
- API/D1 health、バージョン、security/cache headers
- 全4モードのランキング応答形
- 許可/拒否CORS preflight
- 専用トークンによるテスト投稿、非公開履歴、削除
- 失敗Issueの作成・追記、復旧時の自動クローズ

## Deterministic Contracts

- ゲーム残時間は100ms間隔の単純減算ではなく、絶対締切から算出します。
- 回答ロック300ms、最大5分、1回答の最大点からWorkerの得点上限を横断テストします。
- 投稿IDは再送しても同じD1主キーを使います。
- オフラインキューは50件、上限超過を利用者へ通知し、次回起動時に3件ずつ同期します。
- 起動処理と4モード取得は部分成功し、remote/cache/localと失敗を画面で区別します。

## Manual Evidence

ストア提出前は物理iOS/Android端末でVoiceOver/TalkBack、振動、低速・切断復帰、バックグラウンド復帰、320px相当表示を確認します。Apple/Googleの署名資格情報、ストア審査、実機支援技術の結果はリポジトリだけでは証明できないため、リリース記録へ端末・OS・結果を残します。

## Definition Of Done

変更は関連する自動テスト、D1 migration、API/プライバシー文書、ロールバック手順を同じPRに含めます。必要チェックが成功し、本番スモーク、D1件数、公開コミットを照合して完了です。
