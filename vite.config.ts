import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { en } from './src/i18n/en';
import { de } from './src/i18n/de';
import { STORE_FULL_IP, signGeo, truncateIp } from './src/lib/geo-privacy';

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

export function buildId(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.VITE_BUILD_ID
    || `dev-${new Date().toISOString().slice(0, 19)}`;
}

function versionPlugin() {
  const id = buildId();
  return {
    name: 'build-version',
    config() {
      return { define: { __BUILD_ID__: JSON.stringify(id) } };
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ id }),
      });
    },
  };
}

function gameHtmlPlugin() {
  const gamePath = resolve(__dirname, 'public/index.html');
  return {
    name: 'game-html',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(_html: string, ctx: { server?: unknown; filename?: string; path?: string }) {
        const file = `${ctx.filename || ''} ${ctx.path || ''}`;
        if (file.includes('admin.html') || ctx.path === '/admin') {
          if (ctx.server || process.env.E2E_LOCAL === '1') {
            return _html.replace(
              "connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com",
              "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com",
            );
          }
          return _html;
        }
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

function geoApiPlugin() {
  const handle = (req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }, res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (b: string) => void }) => {
    const h = (name: string) => {
      const v = req.headers[name] ?? req.headers[name.toLowerCase()];
      return Array.isArray(v) ? (v[0] || '') : String(v || '');
    };
    const forwarded = h('x-forwarded-for').split(',')[0].trim();
    const rawIp = forwarded || h('x-real-ip') || req.socket?.remoteAddress || '';
    const country = decodeURIComponent(h('x-vercel-ip-country') || '');
    const region = decodeURIComponent(h('x-vercel-ip-country-region') || '');
    const city = decodeURIComponent(h('x-vercel-ip-city') || '');
    const ipTrunc = truncateIp(rawIp);
    const iat = Date.now();
    const body = {
      country: country.slice(0, 8),
      region: region.slice(0, 16),
      city: city.slice(0, 48),
      ipTrunc,
      iat,
      storeFullIp: STORE_FULL_IP,
      ipFull: STORE_FULL_IP ? rawIp.slice(0, 64) : '',
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ...body, sig: signGeo(body) }));
  };
  return {
    name: 'geo-api',
    configureServer(server: { middlewares: { use: (path: string, fn: (req: never, res: never) => void) => void } }) {
      server.middlewares.use('/api/geo', handle as never);
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, fn: (req: never, res: never) => void) => void } }) {
      server.middlewares.use('/api/geo', handle as never);
    },
  };
}

function roadsterSpritesPlugin() {
  const dir = resolve(__dirname, 'public/ships');
  const serve = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b?: Buffer) => void }, next: () => void) => {
    const name = (req.url || '').replace(/^\/+/, '').split('?')[0];
    const file = resolve(dir, name);
    if (!name || !file.startsWith(dir) || !fs.existsSync(file)) { next(); return; }
    res.setHeader('Content-Type', 'image/png');
    res.end(fs.readFileSync(file));
  };
  const copyTo = (outDir: string) => {
    const dest = resolve(outDir, 'ships');
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.png')) fs.copyFileSync(resolve(dir, f), resolve(dest, f));
    }
  };
  return {
    name: 'roadster-sprites',
    configureServer(server: { middlewares: { use: (path: string, fn: typeof serve) => void } }) {
      server.middlewares.use('/ships', serve);
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, fn: typeof serve) => void } }) {
      server.middlewares.use('/ships', serve);
    },
    writeBundle() {
      copyTo(resolve(__dirname, 'dist'));
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: false,
  plugins: [gameHtmlPlugin(), versionPlugin(), geoApiPlugin(), roadsterSpritesPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
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
