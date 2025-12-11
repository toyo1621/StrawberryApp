export default {
  expo: {
    name: "いちごつめ！",
    slug: "ichigo-tsume-game-2024",
    version: "1.0.0",
    ios: {
      buildNumber: "1",
      supportsTablet: true,
      bundleIdentifier: "com.strawberrygame.app",
    },
    android: {
      versionCode: 1,
      package: "com.strawberrygame.app",
    },
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    web: {
      bundler: "metro"
    },
    scheme: "ichigo-tsume-game-2024",
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    },
    description: "時間内にいちごや島、国旗をたくさん当てよう！ランキングで競おう！"
  }
};

