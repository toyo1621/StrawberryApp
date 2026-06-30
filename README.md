# いちごつめ！

時間内に2つの選択肢から正解を選び続ける、瞬発力重視の2択ゲームです。いちご、島、国旗、色の4モードで遊べます。

## 公開URL

GitHub Pagesで公開中です。

https://toyo1621.github.io/StrawberryApp

GitHub Pagesへのデプロイ手順やSecrets設定は [GITHUB_PAGES_SETUP.md](./GITHUB_PAGES_SETUP.md) を参照してください。

## ゲーム概要

- 制限時間は30秒
- 選択肢は常に2択
- 正解すると1点
- 間違えると3秒のペナルティ
- 2連続正解以降は連続正解ボーナスで0.5秒回復
- 残り10秒はフィーバー状態になり、特別アイテムの出現率が上がります

## ゲームモード

### いちごモード

表示された選択肢から、いちごを素早く選ぶモードです。

- ショートケーキ: 3点 + 2秒回復
- ホールケーキ: 5点 + 5秒回復
- ゲーム終了後に記憶チャレンジがあります
- 間違えると、いちごジュースの演出が画面全体に表示されます

### 島モード

日本の有人離島の形を見て、正しい島を選ぶモードです。

- SVGの島アセットを利用
- ゴールデン島: 3点 + 1秒回復
- 島の形を覚えながら遊べます

### 国旗モード

表示された国名に対応する国旗を選ぶモードです。

- `flag-icons` を利用
- 世界の国旗を覚えながら遊べます

### 色モード

色名と色見本を見て、正しい色を選ぶモードです。

- 色彩検定に出てくる色名を学べます
- マンセル値、HEX、説明文を持つ色データを利用
- ゴールデン色: 3点 + 1秒回復

## 主な機能

- モード別ランキング
- 全体、日別、週別、月別ランキング
- プレイヤーごとのスコア履歴
- マイページでのプレイヤー名管理
- ダークモード
- 振動フィードバックのオン/オフ
- プライバシーポリシー、利用規約画面
- Supabase未設定時のローカル保存フォールバック

## 技術スタック

- Expo 54
- React 19
- React Native 0.81
- React Native Web
- TypeScript 5.9
- Supabase
- React Native Async Storage
- flag-icons

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. 環境変数を設定

`.env.example` を参考に `.env` を作成し、Supabaseの接続情報を設定します。

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Supabaseの環境変数がない場合、ランキングとスコア履歴はローカルストレージに保存されます。

### 3. 開発サーバーを起動

```bash
# Webブラウザで起動
npm run web

# Expo Goで起動
npm start

# iOSシミュレーターで起動
npm run ios

# Androidエミュレーターで起動
npm run android
```

## Webビルド

```bash
npm run build:web
```

Webビルドの出力先は `web-build` です。ローカルで確認する場合は次のコマンドを使います。

```bash
npm run preview
```

## データベース

Supabaseを使う場合は、以下のマイグレーションを適用します。

1. `supabase/migrations/20250815005541_sweet_snowflake.sql`
2. `supabase/migrations/20250815034556_calm_math.sql`

ランキングは `rankings` テーブルに保存され、モードごとに `game_type` で分類されます。

## ディレクトリ構成

```text
src/
  App.tsx
  components/
  services/
  assets/
  constants.ts
supabase/
  migrations/
```

## デプロイ

本番公開先はGitHub Pagesです。

https://toyo1621.github.io/StrawberryApp

GitHub Actionsでビルドする場合は、`EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` をRepository Secretsに設定してください。
