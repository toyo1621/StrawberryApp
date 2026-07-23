# Release Checklist

この文書はWeb、iOS、Androidの公開判定と外部証拠を同じ形式で残すためのテンプレートです。自動検査の成功は、実機支援技術、署名資格情報、ストア審査の代替にはなりません。

## Release record

| Field | Value |
| --- | --- |
| Version / build | `<version> / <build>` |
| Git commit | `<40-character SHA>` |
| Date (JST) | `<YYYY-MM-DD>` |
| Operator | `<name>` |
| Rollback commit | `<40-character SHA>` |

## Automated gates

- [ ] Node.js 22で `npm ci` と `npm run check` が成功
- [ ] `npm run doctor`、`npm run test:e2e`、`npm run build:native-bundles`、`npm run check:native-build` が成功
- [ ] `npm run build:web` と `npm run check:web-build` が成功
- [ ] Worker dry-run、全D1 migration、クエリ計画、実Worker/D1統合試験が成功
- [ ] Dependabot、CodeQL/依存監査、Action SHA固定、契約生成、プライバシー宣言検査が成功
- [ ] 公開後にWeb/APIのGit SHA、API v5、Cloudflare心拍、登録・履歴・削除スモークが一致
- [ ] D1 Time Travel bookmark、migration前後のランキング件数、read replication `auto` を記録

CI run URL: `<url>`

## Web manual check

- [ ] 320 x 568、Pixel相当、デスクトップで文字や操作要素が重ならない
- [ ] ライト・ダーク・OSの動きを減らす設定で全4モードを完了できる
- [ ] 投稿直後の順位に本人の記録が表示され、同名の別利用者は別行になる
- [ ] オフライン開始は端末履歴だけ、開始後の切断は復帰・再接続・表示中の定期再試行で期限内同期される
- [ ] キーボードだけでホーム、ゲーム、ランキング、設定、マイページを操作できる

Browser / OS / result: `<details>`

## iOS physical device

- [ ] VoiceOverの読み順、見出し、選択状態、進捗、誤答通知が理解できる
- [ ] Dynamic Type最大付近で主操作、得点、ランキング、ポリシーが欠けない
- [ ] 振動ON/OFF、ダークモード、動きを減らす、バックグラウンド復帰が正しい
- [ ] 低速・切断・再接続、アプリ再起動、本人履歴・全削除を確認
- [ ] EAS production build、署名、App Store privacy回答、審査用メタデータを確認

Device / iOS / tester / result: `<details>`

## Android physical device

- [ ] TalkBackの読み順、見出し、選択状態、進捗、誤答通知が理解できる
- [ ] 最大フォント・表示サイズで主操作、得点、ランキング、ポリシーが欠けない
- [ ] ハードウェア戻る、振動ON/OFF、ダークモード、動きを減らす、復帰が正しい
- [ ] 低速・切断・再接続、アプリ再起動、本人履歴・全削除を確認
- [ ] EAS production AAB、署名、Play Data safety回答、審査用メタデータを確認

Device / Android / tester / result: `<details>`

## Operations and privacy

- [ ] `store/privacy-declarations.json`、アプリ内ポリシー、App Store、Google Playの回答が一致
- [ ] `RATE_LIMIT_SALT` と公開資格情報の期限・最小権限を確認
- [ ] GitHub/Cloudflareの各 `MONITOR_ALERT_WEBHOOK_URL` の設定有無と障害・復旧通知を確認
- [ ] `/health.monitor.checkedAt` が25分以内、statusが `healthy` である
- [ ] P0/P1連絡先、ロールバック担当、復元bookmarkへアクセスできる

## Release decision

- [ ] 未解決のP0/P1がない
- [ ] 既知のP2/P3と受容理由を記録した
- [ ] Web / iOS / Androidそれぞれの対象範囲を明示して公開を承認した

Known issues and decision: `<details>`
