# Quality Gates

## Pull Request Gate

`.github/workflows/quality.yml` はPull RequestごとにNode.js 22で動作し、`.github/workflows/codeql.yml` と合わせて次を実行します。

1. `npm ci` と本番・開発依存を含むhigh/critical監査、CodeQL解析、Action SHA固定検査
2. ESLint（複雑度20、関数300行、実装450行上限）、アプリ/Workerのstrict TypeScript、循環依存・層境界・主要ファイル行数の保守性検査
3. APIゲーム種別・期間・島地域の正本JSONと全生成物・DB制約、機械可読プライバシー宣言の整合検査
4. アプリ純粋ロジック、通信・保存、Worker全モジュールの単体テストと最低カバレッジ
5. 空のローカルD1への全migration適用、3つの部分インデックスを使うクエリ計画、実Worker/D1のHTTP統合試験
6. Expo Doctor、iOS/Android本番Hermesバンドルと2.5 MiB/bytecode・16 MiB/export予算
7. Desktop Chromium/Firefox/WebKit、Pixel 7 Chromium、320 x 568小型画面のPlaywright E2E
8. 全4ゲーム・主要情報画面のaxe WCAG A/AA、ライト/ダーク、ARIA状態、live region、44px操作領域
9. Web本番ビルド、CSP/Referrer Policy、Git SHA付き `release.json`、660 KiB/raw JS・175 KiB/gzip JS・12 MiB/島SVG・14 MiB/全体の静的予算、415 SVG完全性、Worker dry-run

カバレッジ下限はアプリソースが行94%・分岐84%・関数88%、Worker全モジュールが行91%・分岐81%・関数92%です。閾値未満はNode test runnerが失敗させます。

可用性・競合契約として、同じ公開順位への40並列cold readを1回のD1 queryへ集約する単体テスト、32並列の実Worker/D1 HTTP読込、キャッシュのfresh/stale/失効、read-replica session、同一セッションの同時再送、同期中の端末キュー追加を自動検査します。

失敗時のPlaywright trace、スクリーンショット、HTML reportは7日間だけCI artifactへ保存します。

## Release Gate

`main` のPages workflowは再利用可能なWorker workflowを先に呼び、Time Travel復元点、D1 migration、read replication有効化、同じGit SHAのWorker、API v5のrelease ID照合、品質チェック、Git SHA付きPages公開、本番スモークを直列化します。APIヘルス、APIヘッダー、Webの `release.json` のSHAとAPI v5が全て一致しなければ完了しません。

15分監視は次を外形確認します。

- Web HTML、言語、実JS bundle、ファビコン、5秒の応答閾値
- API/D1 health、v5、release ID、security/cache headers、4秒の要求閾値
- Webの `release.json` とAPIヘルス/ヘッダーのGit SHA・API v5一致
- Cloudflare Cron心拍の正常状態と25分以内の更新
- 全4モード、島9現行スコープ、互換用の旧九州ランキング応答形
- 公開ランキングのcache status、30秒TTL、D1地域・primaryメタデータ、同一coloでのcache hit
- 許可/拒否CORS preflight
- 専用トークンによるテスト投稿、非公開履歴、1件以上の削除、削除後の不在
- 失敗Issueの作成・追記、任意の外部Webhook通知、復旧時の自動クローズ

これとは独立にCloudflare Cronが15分ごとにD1とPagesを検査し、心拍とレイテンシをD1へ記録します。障害・復旧の状態遷移、公開診断の秘匿、Webhook失敗時の継続をWorker単体テストで固定します。

## Deterministic Contracts

- ゲーム残時間は100ms間隔の単純減算ではなく、絶対締切から算出します。
- 回答ロック300ms、最大5分、1回答の最大点からWorkerの得点上限を横断テストします。
- 投稿IDは再送しても同じD1主キーを使います。
- オフラインキューは50件、上限超過を利用者へ通知し、起動・復帰・オンライン復帰・表示中30秒ごとに3件ずつ同期します。15分のセッション期限と再試行間隔は正本契約から生成します。
- オフラインキューは秘密トークンを保存せず、旧キューの資格情報も読込時に除去します。
- オフラインキューの同期と追加は排他制御し、通信待機中に追加された投稿を同期結果で上書きしません。
- オンラインランキング停止中は保留投稿を送らず、明示的な停止操作で保存待ちキューを削除します。
- 設定とランキングの端末保存は排他制御し、同時更新の取りこぼしを回帰テストします。
- リモート保存成功後の端末キャッシュ失敗は二重投稿を誘発させず、公開保存成功と表示更新失敗を別状態で通知します。
- 公開ランキングは所有者あり・移行前データ用の両部分インデックス、D1 replica session、cache stampede抑止を検査します。
- 同名の別所有者はオンライン・オフラインとも別順位として保持し、本人マーカー付きの複数記録だけを最高点へまとめます。匿名キャッシュへ本人マーカーが漏れないことも検査します。
- 起動処理と4モード取得は部分成功し、remote/cache/localと失敗を画面で区別します。

## Manual Evidence

ストア提出前は [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) に物理iOS/Android端末でのVoiceOver/TalkBack、Androidハードウェアバック、振動、低速・切断復帰、バックグラウンド復帰、文字拡大の結果を残します。Apple/Googleの署名資格情報、ストア審査、実機支援技術の結果はリポジトリだけでは証明できず、未確認欄を自動検査の合格で代替しません。

## Definition Of Done

変更は関連する自動テスト、D1 migration、API/プライバシー文書、ロールバック手順を同じPRに含めます。必要チェックが成功し、本番スモーク、D1件数、公開コミットを照合して完了です。
