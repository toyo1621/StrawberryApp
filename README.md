# いちごつめ！

時間内にいちごをたくさんつめるゲームです。

## 開発環境での実行

```bash
npm install
npm run dev
```

## Vercelへのデプロイ

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

- いちご選択ゲーム
- スコア記録
- ランキング表示
- レスポンシブデザイン

## 技術スタック

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Supabase