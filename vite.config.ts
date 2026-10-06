import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    exclude: [...configDefaults.exclude, 'work/**', 'release*/**', 'dist*/**'],
  },
});
