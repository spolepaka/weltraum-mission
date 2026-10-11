/** Soft-reload after a deploy so leftover tabs pick up new hashed chunks. */

export const SOFT_RELOAD_KEY = 'spaceMissionSoftReload';
export const VERSION_PATH = '/version.json';

export const BUSY_STATES = ['play', 'dying', 'sucked'] as const;

declare const __BUILD_ID__: string;

export function currentBuildId(): string {
  try {
    return typeof __BUILD_ID__ === 'string' && __BUILD_ID__ ? __BUILD_ID__ : 'dev';
  } catch {
    return 'dev';
  }
}

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Unable to preload|Loading chunk|Importing a module script failed/i.test(msg);
}

export function readGameState(): string {
  try {
    const info = (window as Window & { __spaceGame?: { simInfo?: () => { state?: string } } }).__spaceGame?.simInfo?.();
    return info?.state || '';
  } catch {
    return '';
  }
}

export function isLevelInProgress(state = readGameState()): boolean {
  return (BUSY_STATES as readonly string[]).includes(state);
}

function sessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function sessionSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

function sessionClear(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

export function alreadySoftReloaded(): boolean {
  return sessionGet(SOFT_RELOAD_KEY) === '1';
}

export function markSoftReloaded(): void {
  sessionSet(SOFT_RELOAD_KEY, '1');
}

export function clearSoftReloadGuard(): void {
  sessionClear(SOFT_RELOAD_KEY);
}

export function showUpdatingToast(text?: string): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('chunkUpdateToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chunkUpdateToast';
    el.setAttribute('role', 'status');
    el.style.cssText = [
      'position:fixed', 'top:16%', 'left:50%', 'transform:translateX(-50%)',
      'z-index:90', 'padding:10px 18px', 'border-radius:16px',
      'background:rgba(20,80,50,.94)', 'border:2px solid #7dffa8',
      'color:#fff', 'font:bold 18px Trebuchet MS,Segoe UI,Arial,sans-serif',
      'pointer-events:none', 'text-align:center',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = text || updatingCopy();
}

function updatingCopy(): string {
  try {
    const api = (window as Window & { __weltraum?: { i18n?: { t?: (k: string) => string } } }).__weltraum?.i18n;
    const out = api?.t?.('tips.updatingGame');
    if (out && out !== 'tips.updatingGame') return out;
  } catch { /* ignore */ }
  return 'Updating the game…';
}

export function savePlayState(): void {
  try {
    (window as Window & { __weltraum?: { onGameSave?: () => void } }).__weltraum?.onGameSave?.();
  } catch { /* ignore */ }
}

export type SoftReloadReason = 'chunk' | 'version';

export function requestSoftReload(reason: SoftReloadReason, reload: () => void = defaultReload): boolean {
  if (alreadySoftReloaded()) {
    showUpdatingToast();
    return false;
  }
  if (reason === 'version' && isLevelInProgress()) {
    pendingVersionReload = true;
    return false;
  }
  if (reason === 'chunk' && isLevelInProgress()) {
    pendingVersionReload = true;
    showUpdatingToast();
    return false;
  }
  markSoftReloaded();
  savePlayState();
  showUpdatingToast();
  reload();
  return true;
}

function defaultReload(): void {
  if (typeof location !== 'undefined') location.reload();
}

let pendingVersionReload = false;
let installed = false;

export function takePendingVersionReload(): boolean {
  const next = pendingVersionReload;
  pendingVersionReload = false;
  return next;
}

export async function checkBuildVersion(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(VERSION_PATH, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json() as { id?: string };
    if (!data?.id || data.id === currentBuildId()) return false;
    return requestSoftReload('version');
  } catch {
    return false;
  }
}

export async function importFresh<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    if (isStaleChunkError(err)) requestSoftReload('chunk');
    throw err;
  }
}

export function installChunkUpdateHandlers(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;

  const onPreload = (event: Event) => {
    const err = (event as Event & { payload?: unknown }).payload;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    requestSoftReload('chunk');
    void err;
  };
  const onReject = (event: PromiseRejectionEvent) => {
    if (!isStaleChunkError(event.reason)) return;
    event.preventDefault();
    requestSoftReload('chunk');
  };
  const onFocus = () => {
    if (pendingVersionReload && !isLevelInProgress()) {
      pendingVersionReload = false;
      requestSoftReload('version');
      return;
    }
    void checkBuildVersion();
  };

  window.addEventListener('vite:preloadError', onPreload);
  window.addEventListener('unhandledrejection', onReject);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onFocus();
  });

  return () => {
    window.removeEventListener('vite:preloadError', onPreload);
    window.removeEventListener('unhandledrejection', onReject);
    window.removeEventListener('focus', onFocus);
    installed = false;
  };
}
