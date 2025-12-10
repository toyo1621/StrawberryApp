# GitHub Pagesデプロイ手順

## ステップ1: GitHub Secretsの設定

1. リポジトリの **Settings** → **Secrets and variables** → **Actions** に移動
2. **New repository secret** をクリック
3. 以下の2つのSecretを追加：

### Secret 1
- **Name**: `EXPO_PUBLIC_SUPABASE_URL`
- **Secret**: `https://xusdmbsjolnqrjndggxk.supabase.co`

### Secret 2
- **Name**: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Secret**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1c2RtYnNqb2xucXJqbmRnZ3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjY1NjYsImV4cCI6MjA3MDc0MjU2Nn0.iLPnJB8hikNYy9Q_j4kPTPgP-aORV9_HicP8wLXeFE4`

## ステップ2: GitHub Actionsワークフローファイルの追加

### 方法A: GitHub Web UIから追加（推奨）

1. リポジトリのトップページで **「Add file」** → **「Create new file」** をクリック
2. ファイルパスに `.github/workflows/deploy.yml` と入力
3. 以下の内容をコピー＆ペースト：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build web
        run: npm run build:web
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
          
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web-build
```

4. **「Commit new file」** をクリック

### 方法B: コマンドラインから追加

Personal Access Tokenに`workflow`スコープが必要です。

```bash
git add .github/workflows/deploy.yml
git commit -m "Add: GitHub Actions workflow for GitHub Pages"
git push origin main
```

## ステップ3: GitHub Pagesの有効化

1. リポジトリの **Settings** → **Pages** に移動
2. **Source** で **「GitHub Actions」** を選択
3. 設定は自動的に保存されます

## ステップ4: デプロイの確認

1. **Actions** タブを開く
2. ワークフローが実行されていることを確認
3. 完了すると、**緑色のチェックマーク**が表示されます
4. デプロイが完了すると、以下のURLでアクセス可能になります：
   - `https://toyo1621.github.io/StrawberryApp`

## トラブルシューティング

### デプロイが失敗する場合

1. **Actions** タブでエラーログを確認
2. Secretsが正しく設定されているか確認
3. `package.json`に`build:web`スクリプトがあるか確認

### 環境変数が読み込まれない場合

- Secretsの名前が正確か確認（大文字小文字を含む）
- ワークフローファイルの`env`セクションが正しいか確認
