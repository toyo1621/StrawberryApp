# Operations

## 本番サービス

| 対象 | URL | 確認 |
| --- | --- | --- |
| Web | https://toyo1621.github.io/StrawberryApp/ | `npm run smoke:web` |
| API/D1 | https://strawberry-rankings-api.toyo1621.workers.dev/health | `npm run smoke:rankings-api` |

目標は月間99.5%のWeb/API到達性です。ランキングAPIが停止してもゲーム本体と端末内保存は利用できるため、ランキング停止とゲーム停止を分けて判断します。

## 監視

- `.github/workflows/monitor-production.yml` が毎時、Webシェル・実JS bundle・ファビコン・5秒以内の応答、全4モードと島8地域、CORS、API v4・release ID、D1接続、API各要求4秒以内を検査します。専用トークンでゲームセッションを発行し、テストスコアを登録、非公開履歴で確認後に必ず削除します。
- Pages公開workflowはデプロイ直後に同じ検査を行います。
- Worker Observabilityは全リクエストを対象に有効化し、5xxをリクエストID付きJSONログで記録します。
- 失敗時は `production-monitor` ラベルのGitHub Issueを自動作成または追記し、復旧時に自動クローズします。Cloudflare Observabilityでは5xx、リクエストID、レイテンシを確認します。

初動目安:

| 優先度 | 例 | 初動目標 |
| --- | --- | --- |
| P0 | データ消失・漏えい、全機能停止 | 即時、公開停止も検討 |
| P1 | API/D1停止、投稿不能が継続 | 1時間以内 |
| P2 | 一部モード、表示、同期の不具合 | 1営業日以内 |
| P3 | 軽微な文言・運用改善 | 次回リリース |

## 障害対応

1. GitHub Actionsの直近monitor/deploy runとCloudflareのWorker logsを確認します。
2. `/health` が失敗する場合はWorker自体かD1接続かを切り分けます。
3. `/health` は成功し `/rankings` だけ失敗する場合はクエリ、スキーマ、対象モードを確認します。
4. Pagesだけ失敗する場合は直近artifact、base URL、API環境変数を確認します。
5. 影響範囲、開始時刻、暫定対応、復旧時刻を記録します。
6. 復旧後にWeb/APIスモークを実行し、4モード読込と登録・履歴・削除の往復確認を行います。

クライアントは開始後のAPI障害時に最大50件を端末へ保持し、セッションの15分期限内に起動・アプリ復帰ごとに3件ずつ同期します。同じ投稿IDを再利用するため、タイムアウト後の再送でも二重登録されません。セッションなし・期限切れの記録は公開せず端末履歴だけに残します。

## バックアップと復元

Worker公開workflowはD1 migrationの直前にTime Travel bookmarkを取得し、GitHub Actions Step Summaryへ復元コマンドとともに記録します。

```bash
npx wrangler d1 time-travel info strawberry-rankings \
  --config worker/wrangler.toml --json
npx wrangler d1 time-travel restore strawberry-rankings \
  --config worker/wrangler.toml --bookmark <bookmark>
```

Time Travelの利用可能期間はCloudflareプランに依存するため、長期保管が必要な変更では `wrangler d1 export` も暗号化した管理領域へ取得します。SQLには公開名が含まれるためIssue、CI artifact、リポジトリへ添付しません。復元は書込停止、対象bookmark、モード・地域別件数を確認してから実行し、直後にAPI smokeを行います。

`score_submission_buckets` と `game_sessions` は短期データです。復元後に期限切れ行を削除でき、ランキング本体の件数照合とは分けて扱います。

## ロールバック

- UI不具合: 原因コミットをrevertして `main` へpushし、Pagesのpost-deploy smokeまで確認します。
- Worker不具合: Cloudflareの直前成功versionへ戻すか、直前コミットをrelease tag付きで再公開し、`x-release-id` とAPI smokeを照合します。
- D1不具合: 書き込みを止めるWorkerへ戻し、workflow記録の事前bookmarkからTime Travel復元します。
- `RATE_LIMIT_SALT` 漏えい: 新しいランダム値へローテーションし、Cloudflare tokenも影響範囲に応じて失効します。

## 定期作業

- 毎週: monitor失敗、Worker 5xx、依存監査結果を確認。
- リリース時: D1バックアップ、変更順序、スモーク、ロールバック対象コミットを記録。
- 四半期: Cloudflare/GitHubトークン、GitHubセキュリティ設定、ストア資格情報、プライバシー記載、依存更新を棚卸し。

専用APMや24時間オンコール、月間SLOの自動集計はMVPの範囲外です。毎時monitor履歴が到達性の証拠で、単一要求のWeb 5秒/API 4秒閾値を強制します。利用規模や重要度が上がった時点で、外部通知先、エラー率・p95レイテンシ集計を追加します。
