# 公開ランキングのモデレーション

## 運営方針

2026年10月23日の所有者承認に基づき、公開ランキングを維持します。担当はtoyo1621、原則1日1回の通報確認、24時間以内の一次対応を目標とします。実際の監視開始・対応実績はコードの完成とは別です。自動の定期通知は作成していません。

| 対策 | 適用範囲 | 自動・手動 |
| --- | --- | --- |
| 名前NG | 新規投稿を拒否。既存ランキングの該当名は「非公開の名前」に置換 | 初期の明白な不適切語と、運営登録ルールで自動照合 |
| 通報 | 記録ID・理由を非公開で受付 | 利用者が送信、運営が確認 |
| ブロック | 自分のランキングから対象利用者を除外 | 利用者が登録・設定画面で解除 |
| 運営制限 | 対象所有者の全モード・地域・期間の公開記録を除外し、新規公開投稿も停止 | 運営が通報確認後に実行・解除 |

NGと本人向けブロックは利用停止処分ではありません。通報数だけの自動BANはしません。誤通報や競争相手の排除に悪用されるためです。NGはNFKC・英字小文字化・空白記号除去後に照合し、正規表現は受け付けません。初期語は `worker/src/namePolicy.ts` の限定的な完全一致です。日本語の文脈や伏字すべてを検出できるとは保証しません。

通常は所有者ハッシュ単位でブロックするため、改名・別ゲームでも有効で、同名の別利用者は巻き込みません。所有者情報のない移行記録は、その記録IDだけが対象です。匿名トークンを作り直す利用者の完全な再参加防止はできません。本人履歴・自己削除は利用制限中も維持します。

本人ブロックは公開順位の計算後・表示件数の制限前に適用します。非表示の行は詰めますが、順位番号と結果画面の全体順位は `publicRank` を使い、ブロックで自分の全体順位が上がって見えないようにします。

## 本番利用の前提

この実装の追加だけでは本番に反映されません。承認済みリリース時に次の順で行います。

1. D1バックアップと現在の復旧点を確認し、`0014_ranking_moderation.sql` を適用する。既存スコアを変更・削除しない追加移行です。
2. 32〜256文字のランダムな専用秘密値を `wrangler secret put MODERATION_ADMIN_TOKEN --config worker/wrangler.toml` で設定する。公開変数・Git・クライアントへ置かない。
3. Workerを先に公開し、ローカル同等の通報・ブロック・解除確認を、承認済み検証用記録で実施する。
4. Webとネイティブを公開し、問い合わせフォームの受信を所有者が確認する。通報の内容・本人情報を公開Issueに貼らない。

DB移行前に新Workerを公開すると新テーブル参照が失敗します。旧クライアントのv5契約は互換ですが、通報・ブロックUIは新クライアントが必要です。管理secret未設定時も通常プレイ・通報受付は動きますが、運営による審査ができないので公開開始条件にはしません。

## 毎日の運営

専用シェルに `MODERATION_API_URL`（WorkerのHTTPS origin）と `MODERATION_ADMIN_TOKEN` を非公開で設定します。秘密値はコマンド引数に直接書かず、シェル履歴・画面共有・ログへ残さないでください。以下は操作例で、実行には設定と権限が必要です。

```bash
node scripts/moderate-rankings.mjs reports
node scripts/moderate-rankings.mjs hide REPORT_ID --confirm
node scripts/moderate-rankings.mjs dismiss REPORT_ID --confirm
node scripts/moderate-rankings.mjs restore REPORT_ID --confirm
node scripts/moderate-rankings.mjs restrictions
node scripts/moderate-rankings.mjs release RESTRICTION_ID --confirm
```

未処理は古い順に最大100件です。確認済みを処理して再取得すると次の未処理が出ます。攻撃的・差別的・性的な名前、個人情報、なりすましを確認し、必要なら非公開と投稿制限、不成立なら却下します。個人情報や脅迫など緊急性の高いものを優先します。判断はD1へ記録し、異議申し立てはアプリの問い合わせ窓口で受けます。制限中の投稿応答に出る受付番号で、通報記録の保持期限後も解除できます。

### NG設定による自動化

```bash
node scripts/moderate-rankings.mjs ng-list
node scripts/moderate-rankings.mjs ng-add '禁止する名前' exact --confirm
node scripts/moderate-rankings.mjs ng-add '禁止語' contains --confirm
node scripts/moderate-rankings.mjs ng-remove RULE_ID --confirm
```

まず完全一致を使います。部分一致は普通の名前まで伏せる可能性があるため、最低2文字、具体的な被害が確認できた語だけに限定します。設定は最大100件です。NG追加後は次のAPI取得から既存表示も伏せます。誤検知はルール削除で解除し、コード変更・再デプロイは不要です。既に開いている画面やオフライン保存済みの表示は遠隔で書き換えません。個別利用者の全記録を非公開にする場合はNGではなく運営制限を使います。

## 保護と保持

- 利用者の通報は所有者ごとに直近24時間で20件、通報・ブロック書込は接続元ごとに8件/分。件数判定はSQL内で行い、同じ記録への通報は重複しません。
- 本人ブロックは最大200件、本人以外は一覧取得・解除できません。所有者ハッシュ・通報者・内部対象キーを公開APIへ出しません。
- 通報と判断ログは各作成から90日経過後に15分間隔の定期処理で削除します。本人データ削除では本人の通報とブロックも削除します。他人からの通報は保持期限まで残る場合があります。
- 継続中の運営制限は最小限の内部対象キー・受付番号・日時だけを保持し、解除またはサービス終了まで残します。スコア削除で処分は解除しません。NGルールは削除またはサービス終了まで保持します。
- 管理APIは専用Bearer必須・Origin付きブラウザ通信を拒否・全応答no-storeです。管理操作はクライアントアプリに組み込みません。
- 本人向け順位はprimaryを読み、共有キャッシュを使いません。匿名参照の内部キャッシュは残しますが、応答前にprimaryで削除・制限・NGを再確認します。確認不能時は未検査の名前を返さずエラーにします。
- ブロック中の通信断では、端末の古い他人の公開キャッシュを表示しません。本人履歴と未送信スコアは消しません。

## 確認

`npm run test:worker` は実SQLiteクエリで権限・同名・改名・期間・公開順位・NG・保持・キャッシュを確認します。`npm run test:db` と `npm run test:integration` はローカルD1/Worker、`npm run test:moderation-cli` は運営CLIの確認・資格情報・接続先、`npm run test:e2e:moderation` はモックAPIでPC・320px・iPad WebKitの通報、失敗時の再送、ブロック、再起動、解除、NG名の開始前拒否、公開順位、axeを検証します。本番受信やiOS実機のVoiceOverまで確認した証拠ではありません。

Appleの[ユーザー生成コンテンツ要件](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)を踏まえた最小対策です。コードや自動テストの成功は審査承認を保証しません。

## コミット前のローカル検証記録（2026-10-23）

対象は `codex/ios-ipad-release` の実装時点のローカル変更です。この検証では本番データを読み書きせず、デプロイも行っていません。その後のコミット・PR更新・GitHub CIの結果はPR #62に記録し、以下のローカル結果とは区別します。

| 項目 | 結果 |
| --- | --- |
| `npm ci` | 成功。braces、node-forge、既存Metroの3パッチを再適用。依存・override・lockfileは変更なし。Expo 54.0.37 / React Native 0.81.5を維持 |
| `npm run check:quality` | 成功。lint、型、契約、プライバシー、保守性、144件のNodeテスト、D1移行・データ保全、実Worker/D1統合を通過 |
| アプリ / Workerカバレッジ | アプリ: 行95.43%、分岐87.40%、関数90.05%。Worker: 行95.38%、分岐92.55%、関数97.67% |
| 既存E2E | 71成功、2スキップ。スキップはFirefox/WebKitの転送量計測のみ。性能予算は緩和なし |
| モデレーションE2E | 9成功。PC、320px、iPad WebKitで通報・失敗再送・ブロック・再起動・解除・開始前のNG/制限拒否・公開順位維持・axe |
| 実ローカルAPI + ブラウザ | 架空データ専用Worker/D1で通報・ブロック・公開順位維持・解除を確認。モック検証とは別に実施 |
| Web本番相当ビルド | 最大JS 650.7 KiB、gzip 170.6 KiB、全体12.04 MiB。既存予算内。確認画面用のビルドとは別に本番API URL・CSPを検証 |
| iOS / Android Metro export | iOS 2.12 MiB、Android 2.13 MiBのHermesバンドル。両方の容量予算を通過 |
| iOSプロジェクト生成 | 既存iosフォルダを触らない一時コピーでprebuildと生成検証に成功。iPhone/iPad、iPadの全方向・ウィンドウ対応、4種類のデータ申告を確認。コンパイル・実機試験の代替ではない |
| Worker dry-run | 成功。62.95 KiB / gzip 14.47 KiB。アップロードなし |
| Expo Doctor | 17/18。残る1件はこのMacのCocoaPods未導入。無視設定は追加していない |
| 全依存監査 | High 23 / Moderate 0 / Critical 0で失敗継続。原因はbracesとnode-forgeの2勧告。局所緩和と監査解消は別として扱い、除外・ゲート緩和なし。詳細はSECURITY.md |

このローカル検証時点では、新しい変更に対するGitHub上のCI、CodeQLは未実施です。署名付きiOSビルド、iPhone/iPad実機・VoiceOver、TestFlight、App Store提出、本番のDB移行・管理secret設定・問い合わせ受信・通報の実運用も未実施です。上記の成功をそれらの証拠として代用しません。

ローカル証跡: `.tmp/moderation-dependency-audit.json`、`.tmp/playwright-report/`、`.tmp/playwright-moderation-report/`、`.tmp/playwright-moderation-results/`。ローカル確認画面は `http://127.0.0.1:4182/`、専用APIは `http://127.0.0.1:8796`、専用DBは `.tmp/moderation-preview-d1` です。すべて架空データで、本番には接続しません。`確認用NG` を入力すると開始前の拒否を確認できます。管理secretはこの確認用APIにも設定していません。
