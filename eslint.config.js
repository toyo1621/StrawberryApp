const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['web-build/**', '.tmp/**', '.wrangler/**'],
  },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'worker/src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
    rules: {
      complexity: ['error', 30],
      'max-depth': ['error', 5],
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },
]);
