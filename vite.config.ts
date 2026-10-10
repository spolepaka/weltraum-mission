import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

/**
 * The playable game lives in public/index.html (v33 + Stage Zero hooks).
 * Vite's default publicDir would copy that file unprocessed and overwrite
 * the bundled entry, so we treat it as the HTML source and disable publicDir.
 */
const PROD_CONNECT = "connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com";
const DEV_CONNECT = "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com";

function gameHtmlPlugin() {
  const gamePath = resolve(__dirname, 'public/index.html');
  return {
    name: 'game-html',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(_html: string, ctx: { server?: unknown }) {
        let html = fs.readFileSync(gamePath, 'utf8');
        // Localhost is only for the Vite dev server, never the production build.
        if (ctx.server) {
          html = html.replace(PROD_CONNECT, DEV_CONNECT);
        }
        return html;
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
