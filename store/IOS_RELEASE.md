# iPhone・iPadリリース準備

対象はExpo 54 / React Native 0.81.5の既存アプリ。Web・Worker・D1の本番環境を変更せず、iOS専用ブランチで準備します。アカウント操作は [IOS_OWNER_ACTIONS.md](./IOS_OWNER_ACTIONS.md) に分離しています。

## 実装

- iPhoneは従来どおり縦表示。iPadは4方向表示とリサイズ可能なウィンドウを許可する。
- 全方向のSafe Areaを適用する。ゲームの選択肢は利用可能幅に合わせ、広い画面では大きく、狭い画面でははみ出さないようにする。
- 短い画面や文字拡大時はゲーム・記憶チャレンジをスクロール可能にする。
- ホームは広い画面では開始操作とランキングの2列、狭い画面や大きな文字では1列にする。回転で名前・地域・ゲーム状態を初期化しない。
- 不要なFace ID権限は付けない。SecureStoreの秘密トークン保存とPrivacy Manifestは維持する。
- 非免除暗号化を使用しない申告を明示する。独自暗号・VPN・課金等を後から追加する場合は再確認する。
- Privacy PolicyとSupportの静的ページをWebビルド時に生成する。ポリシー本文はアプリと同じJSONを使い、JavaScriptなしで読めるようにする。
- 提出CIはレビュー済みmainからのみ実行し、当該実行で作成した成功ビルドIDだけを提出する。`--latest` は使わない。

## 自動検証

```bash
npm ci
npm run check:quality
npm run doctor
npm run prebuild:ios
npm run verify:ios
npm run build:native-bundles
npm run check:native-build
npm run test:e2e
npm run audit:high
```

`npm run check` は品質と監査の両方を必須にします。既知の監査エラーを一括除外しません。`ios/` と `android/` は生成物なのでコミットせず、変更は `app.config.js` とソースに行います。

WebKitのiPad試験は834×1194、1194×834、1366×1024、375×768、320×568で、名前・島地域・ゲーム中の得点／タイマーの維持を検証します。これはSafari相当の証拠で、ネイティブ起動や実機試験ではありません。

### ネイティブ検証CI

`.github/workflows/ios-native-validation.yml` は、Xcode 26.3でCocoaPodsを導入し、署名不要のReleaseシミュレータアプリをコンパイルします。固定版・SHA-256検証済みのMaestroで以下を操作し、ログ・JUnit・スクリーンショットを `ios-native-evidence` に残します。

- iPhoneで4モード、結果画面、マイページ、設定。
- iPadで同じ操作と、ゲーム中の縦横回転・得点維持。
- iPadで最大のアクセシビリティ文字サイズ。

専用の一時シミュレータを作り、試験後にその端末だけを削除します。既存シミュレータのデータは消しません。API環境変数を空にして、本番へのスコア送信を防ぎます。ネイティブCIは検証用であり、失敗中の依存監査を迂回したストア提出を認めるものではありません。

### ローカルでのネイティブ起動

フルXcodeとiOSランタイムの導入後に実行します。生成済み `ios/` を使う場合、Expo設定の変更後には `npm run prebuild:ios` を再実行します。

```bash
EXPO_PUBLIC_RANKINGS_API_URL= npm run ios
```

EASの `ios-simulator` プロファイルは、Metroサーバー不要のReleaseアプリを作り、API送信を無効にします。クラウド利用にはExpoログインと実際のプロジェクトIDが必要です。`development` は通常のDebugアプリで、`expo-dev-client` は導入していません。Debug起動は `npm run ios` とMetroを使います。

## リリース判定

| 項目 | 判定・制約 |
| --- | --- |
| iPhone／iPadの生成設定 | `npm run verify:ios` で検証。両device family、iOS 15.1以降、iPad4方向、ATS、暗号化申告、不要なFace ID権限なし |
| WebのiPad操作 | 専用Playwright試験で検証。ネイティブの証拠とは別扱い |
| ネイティブコンパイル・シミュレータUI | CI runと成果物を確認して記録する。設定追加だけでは成功扱いしない |
| 依存監査 | 2026年10月22日: 高23・中5の計28パッケージ、根本警告はbraces／node-forge／sprintf-jsの3種類。失敗は維持 |
| EAS／署名／TestFlight | 所有者のログイン・Apple資格情報が未設定。未実行 |
| 実機VoiceOver・振動・iPadマルチタスク | 証拠不足。所有者またはテスターによる実機確認が必要 |
| 公開名前のモデレーション | ブロック等が未実装。運営方針と最小実装を審査前に確定する |
| App Store本公開 | 未実行。所有者の提出・審査・公開判断が必要 |

MVPに広告、課金、ログイン、Game Center、iCloud同期を追加する必要はありません。公開ランキングを維持する場合の安全な運営と、実機で遊べることを優先します。
