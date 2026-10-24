import { defineConfig } from 'vite';

// GitHub Pages serves from /contract-one/, so every asset path must be relative to this base.
export default defineConfig({
  base: '/contract-one/',
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'] },
});
