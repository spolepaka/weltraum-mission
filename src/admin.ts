/**
 * Admin console — separate Vite entry so players never download it.
 * Access is decided by SpacetimeDB from the Firebase JWT email.
 */
import { currentIdToken, ensureFirebase, isAuthConfigured, loadAuthUser, signInWithGoogle, signOutFirebase } from './lib/firebase-auth';
import { getSpacetimeClient, initSpacetime } from './lib/spacetime-client';
import { isEmptyGuest, matchesPlayerFilter, sortPlayers } from './lib/empty-guest';
import { STORE_FULL_IP, GEO_RETENTION_DAYS } from './lib/geo-privacy';

function peekIdTokenClaims(token?: string): { email: string; iss: string; sub: string; emailVerified: boolean } {
  if (!token) return { email: '', iss: '', sub: '', emailVerified: false };
  try {
    const part = token.split('.')[1];
    if (!part) return { email: '', iss: '', sub: '', emailVerified: false };
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { email?: string; iss?: string; sub?: string; email_verified?: boolean };
    return {
      email: String(payload.email || ''),
      iss: String(payload.iss || ''),
      sub: String(payload.sub || ''),
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return { email: '', iss: '', sub: '', emailVerified: false };
  }
}

function showDenied(server: { email?: string; detail?: string }, clientToken?: string): void {
  let diag: Record<string, unknown> = {};
  try { diag = JSON.parse(server.detail || '{}') as Record<string, unknown>; } catch { /* ignore */ }
  const client = peekIdTokenClaims(clientToken);
  const rows = [
    ['Server email', server.email || '—'],
    ['Server issuer', String(diag.issuer || '—')],
    ['Server has JWT', diag.hasJwt == null ? '—' : String(diag.hasJwt)],
    ['Server UID (sub)', String(diag.sub || '—')],
    ['Server identity', String(diag.identity || '—')],
    ['Email verified', diag.emailVerified == null ? '—' : String(diag.emailVerified)],
    ['Server reason', String(diag.reason || 'denied')],
    ['Client email', client.email || '—'],
    ['Client issuer', client.iss || '—'],
    ['Client UID', client.sub || '—'],
  ];
  root.replaceChildren(el(`
    <div class="gate">
      <h1>Access denied</h1>
      <p class="err">This Firebase account is not an admin.</p>
      <table class="diag"><tbody>
        ${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(String(v))}</td></tr>`).join('')}
      </tbody></table>
    </div>`));
}

type PlayerRow = {
  id: string;
  username: string;
  email: string;
  coins: string;
  unlocked: number;
  highest?: number;
  ships: string;
  lastSeen: string;
  created: string;
  banned: boolean;
  testBot?: boolean;
  emptyGuest?: boolean;
  signedIn?: boolean;
  activeToday?: boolean;
  linkedIds?: string;
  linkedTo?: string;
};

type PlayerDetail = PlayerRow & {
  firebaseSub?: string;
  equipped?: string;
  stars?: Record<string, { stars: number; best: string } | number>;
  achievements?: string;
  banReason?: string;
  sessions?: number;
  roomsJoined?: number;
  language?: string;
  presence?: Array<Record<string, string>>;
  coinHistory?: Array<Record<string, string | number>>;
  audit?: Array<Record<string, string>>;
  storeFullIp?: boolean;
};

const PAGE_SIZE = 25;
const COLS: Array<{ key: string; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'kind', label: 'Kind' },
  { key: 'coins', label: 'Coins' },
  { key: 'unlocked', label: 'Unlock' },
  { key: 'ships', label: 'Ships' },
  { key: 'lastSeen', label: 'Last seen' },
  { key: 'banned', label: 'Ban' },
];

const root = document.getElementById('root')!;
const state = {
  rows: [] as PlayerRow[],
  sortKey: 'lastSeen',
  sortDir: 'desc' as 'asc' | 'desc',
  page: 0,
  selected: '',
  hideEmpty: true,
  signedIn: false,
  guest: false,
  banned: false,
  activeToday: false,
  testBot: false,
};

function el(html: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild as HTMLElement;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function fmtWhen(micros: string | number | undefined): string {
  const n = Number(micros);
  if (!n) return '—';
  return new Date(n / 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function shipCount(ships: string): number {
  return (ships || '').split(',').map((s) => s.trim()).filter(Boolean).length;
}

function kindLabel(row: PlayerRow): string {
  const bits: string[] = [];
  if (row.email || row.signedIn) bits.push('signed-in');
  else bits.push('guest');
  if (row.linkedTo || row.linkedIds) bits.push('linked');
  if (row.testBot) bits.push('test');
  if (row.emptyGuest || isEmptyGuest(row)) bits.push('empty');
  if (row.banned) bits.push('banned');
  return bits.join(' · ');
}

async function boot(): Promise<void> {
  root.replaceChildren(el('<div class="gate"><h1>Weltraum Admin</h1><p id="status">Checking sign-in…</p><button type="button" id="go">Sign in with Google</button></div>'));
  const status = root.querySelector('#status') as HTMLElement;
  const go = root.querySelector('#go') as HTMLButtonElement;
  if (!isAuthConfigured()) {
    status.textContent = 'Firebase is not configured in this build.';
    go.disabled = true;
    return;
  }
  await ensureFirebase();
  go.onclick = async () => {
    status.textContent = 'Signing in…';
    try {
      await signInWithGoogle();
      await enter();
    } catch (err) {
      status.className = 'err';
      status.textContent = err instanceof Error ? err.message : String(err);
    }
  };
  if (loadAuthUser()) {
    try { await enter(); } catch (err) {
      status.className = 'err';
      status.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}

async function enter(): Promise<void> {
  const user = loadAuthUser();
  if (!user?.idToken) throw new Error('Not signed in');
  const fresh = await currentIdToken(true);
  const token = fresh || user.idToken;
  const client = getSpacetimeClient();
  await client.reconnectWithToken(token);
  const ok = await initSpacetime();
  if (!ok) throw new Error('Could not connect to SpacetimeDB');
  const me = await client.adminMe();
  if (!me?.ok) {
    showDenied(me || {}, token);
    return;
  }
  await renderApp(client, me.email);
}

function filtered(): PlayerRow[] {
  const q = (root.querySelector('#q') as HTMLInputElement | null)?.value || '';
  const rows = state.rows.filter((r) => matchesPlayerFilter(r, {
    hideEmptyGuests: state.hideEmpty,
    signedIn: state.signedIn,
    guest: state.guest,
    banned: state.banned,
    activeToday: state.activeToday,
    testBot: state.testBot,
    query: q,
  }));
  return sortPlayers(rows as unknown as Array<Record<string, unknown>>, state.sortKey, state.sortDir) as unknown as PlayerRow[];
}

async function renderApp(client: ReturnType<typeof getSpacetimeClient>, email: string): Promise<void> {
  root.replaceChildren(el(`
    <div>
      <header>
        <h1>Weltraum Admin</h1>
        <div>${esc(email)} · <button type="button" id="out">Sign out</button></div>
      </header>
      <main>
        <section>
          <div class="stats" id="stats"></div>
          <div class="row">
            <input id="q" placeholder="Search id, name, email, linked id" />
            <button type="button" id="reload">Reload</button>
          </div>
          <div class="row filters">
            <label><input type="checkbox" id="hideEmpty" checked /> Hide empty guests</label>
            <label><input type="checkbox" id="fSigned" /> Signed-in</label>
            <label><input type="checkbox" id="fGuest" /> Guest</label>
            <label><input type="checkbox" id="fBanned" /> Banned</label>
            <label><input type="checkbox" id="fToday" /> Active today</label>
            <label><input type="checkbox" id="fTest" /> Test / bot</label>
          </div>
          <table>
            <thead><tr>${COLS.map((c) => `<th data-sort="${c.key}">${c.label}</th>`).join('')}</tr></thead>
            <tbody id="rows"></tbody>
          </table>
          <div class="pager">
            <button type="button" class="ghost" id="prev">Prev</button>
            <span id="page" class="muted"></span>
            <button type="button" class="ghost" id="next">Next</button>
          </div>
        </section>
        <aside class="panel" id="detail"><p>Select a player.</p></aside>
      </main>
    </div>
  `));
  (root.querySelector('#out') as HTMLButtonElement).onclick = async () => {
    await signOutFirebase();
    location.reload();
  };
  const bindCheck = (id: string, set: (v: boolean) => void) => {
    const box = root.querySelector(id) as HTMLInputElement;
    box.addEventListener('change', () => { set(box.checked); state.page = 0; paintRows(client); });
  };
  bindCheck('#hideEmpty', (v) => { state.hideEmpty = v; });
  bindCheck('#fSigned', (v) => { state.signedIn = v; });
  bindCheck('#fGuest', (v) => { state.guest = v; });
  bindCheck('#fBanned', (v) => { state.banned = v; });
  bindCheck('#fToday', (v) => { state.activeToday = v; });
  bindCheck('#fTest', (v) => { state.testBot = v; });
  root.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort') || 'lastSeen';
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = key === 'lastSeen' || key === 'coins' ? 'desc' : 'asc'; }
      paintRows(client);
    });
  });
  (root.querySelector('#prev') as HTMLButtonElement).onclick = () => { state.page = Math.max(0, state.page - 1); paintRows(client); };
  (root.querySelector('#next') as HTMLButtonElement).onclick = () => { state.page += 1; paintRows(client); };
  const q = root.querySelector('#q') as HTMLInputElement;
  q.addEventListener('input', () => { state.page = 0; paintRows(client); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') void reload(client); });
  (root.querySelector('#reload') as HTMLButtonElement).onclick = () => { void reload(client); };
  await reload(client);
}

async function reload(client: ReturnType<typeof getSpacetimeClient>): Promise<void> {
  const q = (root.querySelector('#q') as HTMLInputElement)?.value || '';
  const stats = await client.adminStats();
  (root.querySelector('#stats') as HTMLElement).innerHTML = `
    <div class="card">Players<b>${stats?.players ?? 0}</b></div>
    <div class="card">Signed-in<b>${stats?.signedIn ?? '—'}</b></div>
    <div class="card">Empty guests<b>${stats?.emptyGuests ?? '—'}</b></div>
    <div class="card">Active this week<b>${stats?.activeWeek ?? 0}</b></div>
    <div class="card">Games played<b>${stats?.gamesPlayed ?? 0}</b></div>`;
  const list = await client.adminListPlayers(q);
  state.rows = (list || []) as PlayerRow[];
  paintRows(client);
  if (state.selected) await showPlayer(client, state.selected);
}

function paintRows(client: ReturnType<typeof getSpacetimeClient>): void {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (state.page >= pages) state.page = pages - 1;
  const slice = rows.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
  const body = root.querySelector('#rows') as HTMLElement;
  body.innerHTML = slice.map((r) => `<tr data-id="${esc(r.id)}" class="${r.id === state.selected ? 'on' : ''}">
    <td>${esc(r.id.slice(0, 10))}</td>
    <td>${esc(r.username || '—')}</td>
    <td>${esc(r.email || '—')}</td>
    <td><span class="chip">${esc(kindLabel(r))}</span></td>
    <td>${esc(String(r.coins))}</td>
    <td>${r.unlocked}</td>
    <td>${shipCount(r.ships)}</td>
    <td>${fmtWhen(r.lastSeen)}</td>
    <td>${r.banned ? 'yes' : ''}</td>
  </tr>`).join('') || '<tr><td colspan="9" class="muted">No players match the filters.</td></tr>';
  body.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => { void showPlayer(client, tr.getAttribute('data-id') || ''); });
  });
  (root.querySelector('#page') as HTMLElement).textContent = `${rows.length} shown · page ${state.page + 1}/${pages}`;
}

function kv(label: string, value: string): string {
  return `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
}

function tableBlock(title: string, rows: string): string {
  return `<h3>${esc(title)}</h3><table class="diag"><tbody>${rows}</tbody></table>`;
}

async function showPlayer(client: ReturnType<typeof getSpacetimeClient>, id: string): Promise<void> {
  state.selected = id;
  paintRows(client);
  const box = root.querySelector('#detail') as HTMLElement;
  box.innerHTML = '<p class="muted">Loading…</p>';
  const row = await client.adminGetPlayer(id) as PlayerDetail | null;
  if (!row) { box.innerHTML = '<p class="err">Not found.</p>'; return; }
  const listRow = state.rows.find((r) => r.id === id);
  const linkedIds = String(row.linkedIds || listRow?.linkedIds || '');
  const linkedTo = String(listRow?.linkedTo || '');
  const stars = row.stars && typeof row.stars === 'object' ? row.stars : {};
  const starRows = Object.entries(stars).sort((a, b) => Number(a[0]) - Number(b[0])).map(([lvl, info]) => {
    const starsN = typeof info === 'number' ? info : info.stars;
    const best = typeof info === 'number' ? '' : info.best;
    return `<tr><td>L${esc(lvl)}</td><td>${starsN}★</td><td>${esc(best || '—')}</td></tr>`;
  }).join('') || '<tr><td colspan="3" class="muted">No level results</td></tr>';
  const presence = Array.isArray(row.presence) ? row.presence : [];
  const coins = Array.isArray(row.coinHistory) ? row.coinHistory : [];
  const audit = Array.isArray(row.audit) ? row.audit : [];
  const fullIp = row.storeFullIp === true || STORE_FULL_IP;
  box.innerHTML = `
    <h2>${esc(row.username || 'Unnamed pilot')}</h2>
    <p class="muted">${esc(kindLabel({ ...row, linkedIds, linkedTo }))}</p>
    ${tableBlock('Identity', [
      kv('Player id', esc(row.id)),
      kv('Firebase sub', esc(String(row.firebaseSub || '—'))),
      kv('Linked email', esc(row.email || '—')),
      kv('Linked guest ids', esc(linkedIds || '—')),
      kv('Linked to', linkedTo ? `<button type="button" class="ghost" id="openLinked">${esc(linkedTo.slice(0, 16))}…</button>` : '—'),
      kv('Language', esc(String(row.language || '—'))),
      kv('Created', fmtWhen(row.created)),
      kv('Last seen', fmtWhen(row.lastSeen)),
      kv('Sessions', String(row.sessions ?? 0)),
      kv('Rooms joined', String(row.roomsJoined ?? 0)),
    ].join(''))}
    ${tableBlock('Progress (server source of truth)', [
      kv('Name', esc(row.username || '—')),
      kv('Coins', esc(String(row.coins))),
      kv('Unlocked / highest', String(row.unlocked)),
      kv('Equipped', esc(String(row.equipped || 'starter'))),
      kv('Ships owned', esc(row.ships || 'starter')),
      kv('Achievements', esc(String(row.achievements || '—'))),
      kv('Banned', row.banned ? esc(String(row.banReason || 'yes')) : 'no'),
      kv('Test / bot', row.testBot ? 'yes' : 'no'),
    ].join(''))}
    <h3>Level progress</h3>
    <table class="diag"><thead><tr><th>Level</th><th>Stars</th><th>Best</th></tr></thead><tbody>${starRows}</tbody></table>
    <h3>Coin history</h3>
    <table class="diag"><thead><tr><th>When</th><th>Amount</th><th>Reason</th><th>Level</th></tr></thead>
    <tbody>${coins.map((c) => `<tr><td>${fmtWhen(c.at)}</td><td>${esc(String(c.amount))}</td><td>${esc(String(c.reason))}</td><td>${esc(String(c.level || ''))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None yet</td></tr>'}</tbody></table>
    <h3>Location (GDPR)</h3>
    <p class="muted">Country / region / city + truncated IP, kept ${GEO_RETENTION_DAYS} days, admin-only. Full IP constant STORE_FULL_IP is ${fullIp ? 'ON' : 'OFF (default)'}.</p>
    <table class="diag"><thead><tr><th>When</th><th>Place</th><th>IP</th><th>Device</th></tr></thead>
    <tbody>${presence.map((p) => `<tr>
      <td>${fmtWhen(p.at)}</td>
      <td>${esc([p.country, p.region, p.city].filter(Boolean).join(' / ') || '—')}</td>
      <td>${esc(fullIp && p.ipFull ? p.ipFull : (p.ipTrunc || '—'))}</td>
      <td>${esc(p.userAgent || '—')}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="muted">No presence yet</td></tr>'}</tbody></table>
    <h3>Admin audit</h3>
    <table class="diag"><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
    <tbody>${audit.map((a) => `<tr><td>${fmtWhen(a.at)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">None</td></tr>'}</tbody></table>
    <h3>Actions</h3>
    <div class="row">
      <input id="coins" type="number" value="${esc(String(row.coins))}" />
      <button type="button" id="setCoins">Set coins</button>
      <input id="delta" type="number" value="0" />
      <button type="button" id="addCoins">Add / subtract</button>
    </div>
    <div class="row">
      <input id="lvl" type="number" value="${row.unlocked}" min="1" max="100" />
      <button type="button" id="unlock">Set unlock</button>
      <input id="ship" placeholder="ship id" />
      <button type="button" id="grant">Grant ship</button>
      <button type="button" id="remove">Remove ship</button>
    </div>
    <div class="row">
      <button type="button" id="flagTest">${row.testBot ? 'Clear test/bot flag' : 'Mark as test/bot'}</button>
      <button type="button" id="resetProg">Reset levels</button>
      <button type="button" class="danger" id="resetAll">Reset player</button>
    </div>
    <div class="row">
      <input id="reason" placeholder="ban reason" />
      <button type="button" class="danger" id="ban">Ban</button>
      <button type="button" id="unban">Unban</button>
    </div>
    <p id="act"></p>
    <div class="warn">
      <strong>Bulk-delete empty guests</strong>
      <p class="muted">Offered only — type PURGE to confirm. Deletes guest rows with no name, email, coins, progress, extra ships, or stars, last seen more than N days ago. Max 200 per run. Does not run automatically.</p>
      <div class="row">
        <input id="purgeDays" type="number" min="1" max="365" value="14" />
        <input id="purgeConfirm" placeholder="type PURGE" />
        <button type="button" class="danger" id="purge">Delete empty guests</button>
      </div>
    </div>`;
  const note = box.querySelector('#act') as HTMLElement;
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      note.className = 'ok';
      note.textContent = 'Saved.';
      await reload(client);
      await showPlayer(client, id);
    } catch (err) {
      note.className = 'err';
      note.textContent = err instanceof Error ? err.message : String(err);
    }
  };
  const openLinked = box.querySelector('#openLinked') as HTMLButtonElement | null;
  if (openLinked && linkedTo) openLinked.onclick = () => { void showPlayer(client, linkedTo); };
  (box.querySelector('#setCoins') as HTMLButtonElement).onclick = () => run(() => client.adminSetCoins(id, BigInt((box.querySelector('#coins') as HTMLInputElement).value || '0')));
  (box.querySelector('#addCoins') as HTMLButtonElement).onclick = () => run(() => client.adminAddCoins(id, BigInt((box.querySelector('#delta') as HTMLInputElement).value || '0')));
  (box.querySelector('#unlock') as HTMLButtonElement).onclick = () => run(() => client.adminUnlockLevel(id, Number((box.querySelector('#lvl') as HTMLInputElement).value || 1)));
  (box.querySelector('#grant') as HTMLButtonElement).onclick = () => run(() => client.adminGrantShip(id, (box.querySelector('#ship') as HTMLInputElement).value.trim()));
  (box.querySelector('#remove') as HTMLButtonElement).onclick = () => run(() => client.adminRemoveShip(id, (box.querySelector('#ship') as HTMLInputElement).value.trim()));
  (box.querySelector('#flagTest') as HTMLButtonElement).onclick = () => run(() => client.adminSetTestFlag(id, !row.testBot));
  (box.querySelector('#resetProg') as HTMLButtonElement).onclick = () => run(() => client.adminResetProgress(id));
  (box.querySelector('#resetAll') as HTMLButtonElement).onclick = () => run(() => client.adminResetPlayer(id));
  (box.querySelector('#ban') as HTMLButtonElement).onclick = () => run(() => client.adminBan(id, (box.querySelector('#reason') as HTMLInputElement).value));
  (box.querySelector('#unban') as HTMLButtonElement).onclick = () => run(() => client.adminUnban(id));
  (box.querySelector('#purge') as HTMLButtonElement).onclick = () => {
    const days = Number((box.querySelector('#purgeDays') as HTMLInputElement).value || 14);
    const confirm = (box.querySelector('#purgeConfirm') as HTMLInputElement).value.trim();
    if (confirm !== 'PURGE') {
      note.className = 'err';
      note.textContent = 'Type PURGE to confirm the bulk delete. Nothing was deleted.';
      return;
    }
    void run(() => client.adminPurgeEmptyGuests(days, confirm));
  };
}

void boot();
