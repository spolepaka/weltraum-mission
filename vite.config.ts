import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

/**
 * The playable game lives in public/index.html (v33 + Stage Zero hooks).
 * Vite's default publicDir would copy that file unprocessed and overwrite
 * the bundled entry, so we treat it as the HTML source and disable publicDir.
 */
function gameHtmlPlugin() {
  const gamePath = resolve(__dirname, 'public/index.html');
  return {
    name: 'game-html',
    transformIndexHtml: {
      order: 'pre' as const,
      handler() {
        return fs.readFileSync(gamePath, 'utf8');
      },
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: false,
  plugins: [gameHtmlPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
  },
});
