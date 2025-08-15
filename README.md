# いちごつめ！

時間内にいちごをたくさんつめるゲームです。

🎮 **ゲームURL**: https://toyo1621-strawberrya-ubrg.bolt.host

## ゲームの遊び方

1. 名前を入力してゲーム開始
2. 2つの選択肢からいちごを素早く選択
3. 正解すると1点獲得、間違えると3秒のペナルティ
4. 30秒間でできるだけ多くのいちごを見つけよう！
5. ランキングに挑戦してハイスコアを目指そう

## 開発環境での実行

```bash
npm install
npm run dev
```

## デプロイ済みサイト

本アプリケーションは既にBolt Hostingにデプロイされており、以下のURLでプレイできます：
https://toyo1621-strawberrya-ubrg.bolt.host

## Vercelへのデプロイ（オプション）

### 1. Supabaseプロジェクトの準備

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. プロジェクトのURLとAnon Keyを取得

### 2. Vercelでの環境変数設定

Vercelのプロジェクト設定で以下の環境変数を設定：

- `VITE_SUPABASE_URL`: あなたのSupabaseプロジェクトURL
- `VITE_SUPABASE_ANON_KEY`: あなたのSupabaseプロジェクトのAnon Key

### 3. データベースマイグレーション

Supabaseのダッシュボードで、`supabase/migrations/`内のSQLファイルを実行してテーブルを作成してください。

## 機能

- いちご選択ゲーム（2択）
- スコア記録とランキング表示
- Supabaseによる永続的なデータ保存
- レスポンシブデザイン
- アニメーション効果

## 技術スタック

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Supabase（データベース）
- Bolt Hosting（デプロイ）

## ゲーム仕様

- **制限時間**: 30秒
- **ペナルティ**: 間違えると3秒減少
- **得点**: 正解1回につき1点
- **ランキング**: 上位10位まで記録