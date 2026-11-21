// vite.config.ts — build settings. `base: './'` makes dist/ work from any
// sub-folder (GitHub Pages serves from /<repo>/).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 }, // three.js alone is ~700 kB
  test: { include: ['tests/**/*.test.ts'] },
});
