const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Webビルド用の設定
config.resolver.unstable_enablePackageExports = true;

// SVGファイルをテキストとして扱う
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;

