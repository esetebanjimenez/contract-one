import { defineConfig } from 'vite';

// Screenshot scenes for CI only (tools/shots). Never part of the Pages build.
export default defineConfig({
  base: '/contract-one/',
  build: { target: 'es2022', outDir: 'dist-shots', rollupOptions: { input: 'tools/shots/index.html' } },
});
