export default {
  expo: {
    name: "いちごつめ！",
    slug: "ichigo-tsume-game-2024",
    version: "1.0.0",
    // iOS/Androidのビルド番号（リリース時にインクリメント）
    ios: {
      buildNumber: "1",
      supportsTablet: true,
      bundleIdentifier: "com.strawberrygame.app",
      // アイコンとスプラッシュスクリーンは準備でき次第有効化
      // icon: "./assets/icon.png",
      // splash: {
      //   image: "./assets/splash.png",
      //   resizeMode: "contain",
      //   backgroundColor: "#ffffff"
      // }
    },
    android: {
      versionCode: 1,
      package: "com.strawberrygame.app",
      // アダプティブアイコンは準備でき次第有効化
      // adaptiveIcon: {
      //   foregroundImage: "./assets/adaptive-icon.png",
      //   backgroundColor: "#ffffff"
      // }
    },
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      // スプラッシュ画像は準備でき次第有効化
      // image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    web: {
      // favicon: "./assets/favicon.png", // ファビコンが存在しない場合はコメントアウト
      bundler: "metro"
    },
    experiments: {
      baseUrl: "/StrawberryApp"
    },
    scheme: "ichigo-tsume-game-2024",
    newArchEnabled: true,
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    },
    // プライバシーポリシーとプライバシー情報（App Store/Google Play提出時に必要）
    privacy: "public",
    // アプリの説明（ストア提出時に使用）
    description: "時間内にいちごや島、国旗をたくさん当てよう！ランキングで競おう！"
  }
};

