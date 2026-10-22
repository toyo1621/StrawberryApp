# iPhone・iPad公開: ご本人の作業

アカウントの登録・契約・秘密鍵の発行は、Codexでは代行せず所有者が行います。パスワード、2要素認証コード、`.p8`、証明書はチャットやGitに貼らないでください。

## 1. Apple側の準備

- [ ] Apple IDの2要素認証とApple Developer Programの登録を完了する。
- [ ] 個人／法人を選び、App Storeに表示される販売者名と契約を確認する。法人の場合は組織確認も完了する。
- [ ] App Store Connectでアプリを作成する。仮の表示名は「つめチャレ！」、言語は日本語、プラットフォームはiOS。
- [ ] Bundle ID `com.strawberrygame.app` が自分のTeamで利用できるか確認する。既に他者が所有している場合は、実装側の識別子変更が必要なので知らせる。
- [ ] App Store Connectの数字のApple IDを確認し、`eas.json` の `submit.production.ios.ascAppId` に実値を設定する。これはパスワードではない。
- [ ] 有料配信・課金を追加しない初回MVPとするか決める。広告・課金は現在未実装で、公開のためだけに追加する必要はない。

## 2. Expoと署名

- [ ] Expoアカウントでプロジェクトを作成／関連付けする。設定上のownerは `toyo1621`。異なるアカウントの場合は設定も合わせる。
- [ ] ローカルで `npx --yes eas-cli@19.1.0 login` を実行する。
- [ ] ExpoプロジェクトのUUIDを `EAS_PROJECT_ID` に設定する。ローカルのExpoには `.env.local` を使えるが、EAS CLIは自動では読み込まないため、実行するシェルで `export EAS_PROJECT_ID=<実際のUUID>` を設定する。架空のUUIDで埋めない。
- [ ] 最初の署名ビルドは所有者が対話的に実行し、Apple Team・証明書・Provisioning Profileを確認する。

```bash
npx --yes eas-cli@19.1.0 build --platform ios --profile production
```

このコマンドはクラウドビルドを作成します。依存監査や実機試験が未完了の状態でストアへ提出しないでください。アプリの配信先はTestFlightと本公開で区別します。

- [ ] 自動化する場合はGitHubの `mobile-production` Environmentへ `EXPO_TOKEN` をSecret、`EAS_PROJECT_ID` をVariableとして登録する。
- [ ] 同Environmentに必要なレビュー承認とmainブランチ制限を設定する。
- [ ] EASの署名・App Store Connect APIキーを初期設定する。GitHubのコードやログに秘密鍵を置かない。

現在のMacの設定ではXcode本体・CocoaPodsを利用できず、EASも未ログインです。ローカルシミュレータを使う場合はXcode 26以降とiOS 26ランタイムを導入／選択し、利用規約への同意、Command Line Toolsの選択、CocoaPods 1.15.2以降の設定を行ってください。CIの署名なし検証にはApple／Expoのログインは不要です。

## 3. ストア情報と運営判断

- [ ] 説明文、サブタイトル、キーワード、カテゴリ、著作権、配信国、価格、年齢区分の質問に回答する。
- [ ] Kidsカテゴリを選ぶかは別途判断する。ゲームの見た目だけで子ども向け・4歳以上などと断定しない。
- [ ] EUで配信する場合はDSAのトレーダー情報を確認する。
- [ ] プライバシー回答を `store/privacy-declarations.json` と照合する。「データ収集なし」にはしない。名前・ゲーム結果・仮名のユーザー識別子等を扱う。
- [ ] 公開ランキングを維持するか、初回は端末内ランキングのみにするか決める。公開名はユーザー生成コンテンツとして審査前に確認が必要。現在は文字種／長さの入力検査、削除、お問い合わせはあるが、悪質ユーザーのブロックや不適切語フィルタは未実装。ご本人は方針・受付担当・対応期限を決め、その決定に従ってCodex側で必要な最小実装を進める。
- [ ] Googleフォームで問い合わせを実際に受信できることを確認し、監視する担当者を決める。
- [ ] 島データの国土地理院地図／toyo1621による制作という出典・権利表示を確認する。
- [ ] 次のURLは実装済みページの予定URL。本ブランチは未デプロイなので、公開後にHTTP 200と本文を確認してから登録する。

| 用途 | 予定URL |
| --- | --- |
| Privacy Policy | `https://toyo1621.github.io/StrawberryApp/privacy.html` |
| Support | `https://toyo1621.github.io/StrawberryApp/support.html` |

## 4. 実機と提出

- [ ] TestFlightに同じビルドIDの成果物をアップロードする。アップロードだけではApp Store公開にはならない。
- [ ] iPhoneとiPadの実機で4モード、保存・ランキング・履歴・削除、オフライン、再起動、背景復帰を確認する。
- [ ] iPadの縦横、Split View／小さいウィンドウ、ソフトウェア／外付けキーボード、最大付近のDynamic Typeを確認する。
- [ ] VoiceOverの実際の読み上げと振動を確認する。WebKitやシミュレータの成功で代替しない。
- [ ] iPhoneと13インチiPad向けの実際のアプリ画面を撮影する。Webのレスポンシブ画像を実機画像として流用しない。
- [ ] 審査担当への説明を登録する。ログイン不要、4つのゲーム、オンラインランキングの公開範囲、設定で送信停止、マイページで削除、オフラインでプレイ可能であることを説明する。
- [ ] 未解決の品質／監査エラーを解消し、`RELEASE_CHECKLIST.md` に結果を記録する。
- [ ] 審査へ提出し、承認後の公開は手動公開で所有者が判断する。

## 一次資料

- [Apple Developer Program](https://developer.apple.com/programs/)
- [Apple提出要件](https://developer.apple.com/news/upcoming-requirements/): 2026年10月22日確認時点でXcode 26／iOS・iPadOS 26 SDK以降。
- [スクリーンショット仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [ユーザー生成コンテンツのガイドライン](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- [ExpoのiOS提出手順](https://docs.expo.dev/submit/ios/)
- [EAS CLIとExpo CLIの環境変数の違い](https://docs.expo.dev/eas/environment-variables/faq/)
