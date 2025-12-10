# いちごつめ！& 島つめ！

**瞬発2択ゲーム** - 時間内に正しい選択肢を素早く選んでハイスコアを目指そう！

🎮 **ゲームURL**: https://toyo1621-strawberrya-ubrg.bolt.host

## ゲームコンセプト

**瞬発力と判断力を試す2択ゲーム**
- 制限時間30秒の中で、2つの選択肢から正解を素早く選択
- 正解すれば得点、間違えれば時間ペナルティ
- 瞬間的な判断力と集中力が勝負の鍵

## 2つのゲームモード

### 🍓 いちごモード
- **目標**: 2つの選択肢からいちごを素早く選択
- **特別アイテム**: 
  - 🍰 ショートケーキ（3点 + 1秒回復）
  - 🎂 ホールケーキ（5点 + 5秒回復）
- **記憶チャレンジ**: ゲーム終了後に記憶ゲームで追加得点

### 🏝️ 島モード  
- **目標**: 指定された島の形を2つの選択肢から素早く選択
- **特別アイテム**: ✨ ゴールデン島（3点 + 1秒回復）
- **学習要素**: 東京都の島々の形を覚えながら楽しめる

## ゲームの遊び方

1. **モード選択**: いちごモードか島モードを選択
2. **名前入力**: プレイヤー名を入力（12文字まで）
3. **瞬発プレイ**: 2つの選択肢から正解を素早くタップ
4. **スコアアップ**: 
   - 正解 → 1点獲得
   - 間違い → 3秒のペナルティ
   - 特別アイテムで高得点＆時間回復
5. **ランキング挑戦**: 30位までのランキングでハイスコアを競う

## ゲーム仕様

### ⏱️ 基本ルール
- **制限時間**: 30.0秒（0.1秒単位表示）
- **選択肢**: 常に2択
- **得点**: 正解1回につき1点
- **ペナルティ**: 間違えると3秒減少

### 🎁 ボーナス機能
- **連続正解ボーナス**: 2回以上連続正解で0.5秒回復
- **フィーバーモード**: 残り10秒で特別アイテム出現率5倍
- **記憶チャレンジ**: いちごモード限定の追加得点チャンス

### 🏆 ランキングシステム
- **記録方法**: 各プレイヤーの最高スコアを永続保存
- **表示**: ゲーム終了後に30位まで表示
- **リアルタイム更新**: Supabaseによる即座のランキング反映

## 開発環境での実行

### Expo環境での開発

このプロジェクトはExpo環境で開発されています。

#### 1. 依存関係のインストール

```bash
npm install
```

#### 2. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### 3. 開発サーバーの起動

```bash
# Webブラウザで起動
npm run web

# iOSシミュレーターで起動（Macのみ）
npm run ios

# Androidエミュレーターで起動
npm run android

# または、Expo Goアプリで起動
npm start
```

#### 4. ビルド

```bash
# Web用にビルド
npm run build:web

# iOS用にビルド（EAS Buildが必要）
eas build --platform ios

# Android用にビルド（EAS Buildが必要）
eas build --platform android
```

## デプロイ

### Vercelへのデプロイ

1. **VercelアカウントでGitHubリポジトリをインポート**
   - [Vercel](https://vercel.com)にログイン
   - 「New Project」をクリック
   - GitHubリポジトリを選択

2. **環境変数の設定**
   - プロジェクト設定 → Environment Variables
   - 以下の環境変数を追加：
     - `EXPO_PUBLIC_SUPABASE_URL`: あなたのSupabaseプロジェクトURL
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: あなたのSupabaseプロジェクトのAnon Key

3. **デプロイ**
   - Vercelが自動的に`vercel.json`の設定を読み込みます
   - `npm run build:web`が実行され、`web-build`ディレクトリがデプロイされます

### GitHub Pagesへのデプロイ

1. **GitHub Secretsの設定**
   - リポジトリの Settings → Secrets and variables → Actions
   - 以下のSecretsを追加：
     - `EXPO_PUBLIC_SUPABASE_URL`: あなたのSupabaseプロジェクトURL
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: あなたのSupabaseプロジェクトのAnon Key

2. **GitHub Pagesの有効化**
   - リポジトリの Settings → Pages
   - Source: 「GitHub Actions」を選択

3. **自動デプロイ**
   - `main`ブランチにプッシュすると、自動的にGitHub Actionsが実行されます
   - デプロイが完了すると、`https://toyo1621.github.io/StrawberryApp`でアクセス可能になります

### データベースマイグレーション

どちらの方法でも、Supabaseのダッシュボードで以下のSQLを実行してください：

1. `supabase/migrations/20250815005541_sweet_snowflake.sql` - テーブル作成
2. `supabase/migrations/20250815034556_calm_math.sql` - RPC関数作成

## 技術スタック

- **フロントエンド**: React 18 + TypeScript + Expo
- **スタイリング**: NativeWind (Tailwind CSS for React Native)
- **データベース**: Supabase（PostgreSQL）
- **デプロイ**: Expo（Web/iOS/Android対応）
- **状態管理**: React Hooks + useRef（パフォーマンス最適化）
- **ビルドツール**: Expo CLI

## ゲームデザインの特徴

### 🎯 瞬発力重視の設計
- **0.1秒単位のタイマー**: 精密な時間管理
- **即座のフィードバック**: 正解/不正解の視覚的表現
- **連続プレイ**: 途切れない快適なゲーム体験

### 🎨 ユーザビリティ
- **レスポンシブデザイン**: スマホ・PC両対応
- **アクセシビリティ**: 適切なaria-label設定
- **視覚的フィードバック**: アニメーション効果で直感的な操作感

### 📊 データ分析対応
- **詳細なスコア記録**: プレイヤー別最高スコア管理
- **ゲームタイプ別集計**: モード別ランキング
- **タイムスタンプ記録**: プレイ履歴の追跡可能

## 今後の拡張可能性

- 新しいゲームモード追加
- 難易度設定機能
- プレイヤー統計情報
- ソーシャル機能（スコア共有）
- 季節限定イベント

---

**瞬発力と判断力を試す、シンプルで奥深い2択ゲーム体験をお楽しみください！**