import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { en } from './src/i18n/en';
import { de } from './src/i18n/de';

/**
 * The playable game lives in public/index.html (v33 + Stage Zero hooks).
 * Vite's default publicDir would copy that file unprocessed and overwrite
 * the bundled entry, so we treat it as the HTML source and disable publicDir.
 */
const FIREBASE_CONNECT = "https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com";
const PEER_CONNECT = "https://0.peerjs.com wss://0.peerjs.com https://*.peerjs.com wss://*.peerjs.com";
const PROD_CONNECT = `connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com ${FIREBASE_CONNECT} ${PEER_CONNECT}`;
const DEV_CONNECT = `connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com ${FIREBASE_CONNECT} ${PEER_CONNECT}`;
const FIREBASE_AUTH_PROXY = {
  '/__/auth': {
    target: 'https://weltraum-mission.firebaseapp.com',
    changeOrigin: true,
    secure: true,
  },
  '/__/firebase': {
    target: 'https://weltraum-mission.firebaseapp.com',
    changeOrigin: true,
    secure: true,
  },
};

function catalogForHtml<T extends { feats?: Record<string, unknown> }>(cat: T): T {
  const feats = { ...(cat.feats || {}) };
  for (const k of Object.keys(feats)) {
    if (Number(k) > 3) delete feats[k];
  }
  return { ...cat, feats };
}

function gameHtmlPlugin() {
  const gamePath = resolve(__dirname, 'public/index.html');
  return {
    name: 'game-html',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(_html: string, ctx: { server?: unknown }) {
        let html = fs.readFileSync(gamePath, 'utf8');
        // Localhost is only for the Vite dev server and local E2E (`E2E_LOCAL=1`).
        // Production / Vercel builds never include it.
        if (ctx.server || process.env.E2E_LOCAL === '1') {
          html = html.replace(PROD_CONNECT, DEV_CONNECT);
        }
        const bundle = JSON.stringify({ en: catalogForHtml(en), de: catalogForHtml(de) });
        if (!html.includes('window.__I18N_BUNDLE__=')) {
          html = html.replace(
            '<script>\n(function () {',
            `<script>window.__I18N_BUNDLE__=${bundle};</script>\n<script>\n(function () {`
          );
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
    proxy: FIREBASE_AUTH_PROXY,
  },
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
    proxy: FIREBASE_AUTH_PROXY,
  },
});
