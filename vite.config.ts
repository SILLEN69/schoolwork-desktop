import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    // CLI/build checks in scripts use node:test and run separately in CI.
    exclude: [...configDefaults.exclude, 'scripts/**', 'work/**', 'release*/**', 'dist*/**', 'temp/**'],
  },
});
