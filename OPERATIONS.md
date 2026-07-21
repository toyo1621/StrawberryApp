# Operations

## 本番サービス

| 対象 | URL | 確認 |
| --- | --- | --- |
| Web | https://toyo1621.github.io/StrawberryApp/ | `npm run smoke:web` |
| API/D1 | https://strawberry-rankings-api.toyo1621.workers.dev/health | `npm run smoke:rankings-api` |

目標は月間99.5%のWeb/API到達性です。ランキングAPIが停止してもゲーム本体と端末内保存は利用できるため、ランキング停止とゲーム停止を分けて判断します。

## 監視

- `.github/workflows/monitor-production.yml` が毎時、Webシェル、API、D1接続、レスポンス形、主要セキュリティヘッダーを検査します。
- Pages公開workflowはデプロイ直後に同じ検査を行います。
- Worker Observabilityは全リクエストを対象に有効化し、5xxをリクエストID付きJSONログで記録します。
- GitHub Actions失敗通知とCloudflare Observabilityの5xx/レイテンシを運用者が確認します。

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
6. 復旧後にWeb/APIスモークと全4モードの読込を確認します。

クライアントはAPI障害時に最大50件を端末へ保持し、起動ごとに3件ずつ同期します。同じ投稿IDを再利用するため、タイムアウト後の再送でも二重登録されません。

## バックアップと復元

ランキングテーブルを変更する前にD1をエクスポートします。

```bash
npx wrangler d1 export strawberry-rankings --remote \
  --config worker/wrangler.toml \
  --output strawberry-rankings-backup.sql
```

バックアップには公開名が含まれるため、安全なローカル領域に置き、Issue、CI artifact、リポジトリへ添付しません。復元は別の検証用D1でSQLを適用し、モード別件数と上位結果を照合してから本番で実施します。

`score_submission_events` は復元対象ではありません。15分以内に削除する一時データであり、マイグレーション時に再作成できます。

## ロールバック

- UI不具合: 原因コミットをrevertして `main` へpushし、Pagesのpost-deploy smokeまで確認します。
- Worker不具合: 直前の成功コミットをcheckoutし、`npm run worker:deploy` 後にAPI smokeを実行します。
- D1不具合: 書き込みを止めるWorkerへ戻し、事前バックアップから検証済み手順で復元します。
- `RATE_LIMIT_SALT` 漏えい: 新しいランダム値へローテーションし、Cloudflare tokenも影響範囲に応じて失効します。

## 定期作業

- 毎週: monitor失敗、Worker 5xx、依存監査結果を確認。
- リリース時: D1バックアップ、変更順序、スモーク、ロールバック対象コミットを記録。
- 四半期: Cloudflare/GitHubトークン、ストア資格情報、プライバシー記載、依存更新を棚卸し。

専用APMや24時間オンコールはMVPの範囲外です。利用規模や重要度が上がった時点で、外形監視の通知先、エラー率・p95レイテンシのアラート、D1定期バックアップを自動化します。
