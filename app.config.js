export default {
  expo: {
    name: "いちごつめ！",
    slug: "ichigo-tsume-game-2024",
    owner: "toyo1621",
    version: "1.4.0",
    icon: "./assets/app-icon.png",
    ios: {
      buildNumber: "5",
      supportsTablet: true,
      bundleIdentifier: "com.strawberrygame.app",
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"]
          }
        ]
      }
    },
    android: {
      versionCode: 5,
      package: "com.strawberrygame.app",
      adaptiveIcon: {
        foregroundImage: "./assets/app-icon.png",
        backgroundColor: "#8b0000"
      }
    },
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/app-icon.png",
      resizeMode: "contain",
      backgroundColor: "#fff1f5"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    web: {
      bundler: "metro",
      favicon: "./assets/app-icon.png",
      lang: "ja",
      name: "いちごつめ！",
      shortName: "いちごつめ",
      themeColor: "#be185d",
      backgroundColor: "#fff1f5"
    },
    experiments: {
      baseUrl: process.env.EXPO_PUBLIC_BASE_URL || "/StrawberryApp"
    },
    plugins: [
      "expo-secure-store"
    ],
    scheme: "ichigo-tsume-game-2024",
    extra: {
      rankingsApiUrl: process.env.EXPO_PUBLIC_RANKINGS_API_URL
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    description: "時間内にいちごや島、国旗、色をたくさん当てる2択ゲーム"
  }
};
