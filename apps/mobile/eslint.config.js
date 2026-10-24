// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Third-party source kept as published (see src/vendor/*/README.md).
    ignores: ['dist/*', '.expo/*', 'src/vendor/**'],
  },
]);
