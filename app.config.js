export default {
  expo: {
    name: "いちごつめ！",
    slug: "ichigo-tsume-game-2024",
    version: "1.0.0",
    platforms: ["ios", "android", "web"],
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
      bundler: "metro",
      basePath: "/StrawberryApp"
    },
    scheme: "ichigo-tsume-game-2024",
    extra: {
      supabaseUrl: "https://xusdmbsjolnqrjndggxk.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1c2RtYnNqb2xucXJqbmRnZ3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjY1NjYsImV4cCI6MjA3MDc0MjU2Nn0.iLPnJB8hikNYy9Q_j4kPTPgP-aORV9_HicP8wLXeFE4"
    },
    description: "時間内にいちごや島、国旗をたくさん当てよう！ランキングで競おう！"
  }
};

