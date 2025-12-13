const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Webビルド用の設定
config.resolver.unstable_enablePackageExports = true;

module.exports = config;

