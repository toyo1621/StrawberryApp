const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 54のES Modules解決を無効化（互換性問題を回避）
config.resolver.unstable_enablePackageExports = false;

module.exports = config;

