import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  // GitHub Pages project site: https://edvisionedward-boop.github.io/Evergate-Office/
  base: '/Evergate-Office/',
  plugins: [viteSingleFile({ overrideConfig: { base: '/Evergate-Office/' } })],
  build: { outDir: 'dist', target: 'es2019', assetsInlineLimit: 100000000, cssCodeSplit: false, chunkSizeWarningLimit: 3000 },
  server: { host: true, port: 5173 },
});
