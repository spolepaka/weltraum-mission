/**
 * Admin console — separate Vite entry so players never download it.
 * Access is decided by SpacetimeDB from the Firebase JWT email.
 */
import { ensureFirebase, isAuthConfigured, loadAuthUser, signInWithGoogle, signOutFirebase } from './lib/firebase-auth';
import { getSpacetimeClient, initSpacetime } from './lib/spacetime-client';

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
};

const root = document.getElementById('root')!;

function el(html: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild as HTMLElement;
}

function fmtWhen(micros: string): string {
  const n = Number(micros);
  if (!n) return '—';
  return new Date(n / 1000).toISOString().replace('T', ' ').slice(0, 19);
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
  const client = getSpacetimeClient();
  await client.reconnectWithToken(user.idToken);
  const ok = await initSpacetime();
  if (!ok) throw new Error('Could not connect to SpacetimeDB');
  const me = await client.adminMe();
  if (!me?.ok) {
    root.replaceChildren(el('<div class="gate"><h1>Access denied</h1><p class="err">This Firebase account is not an admin.</p></div>'));
    return;
  }
  await renderApp(client, me.email);
}

async function renderApp(client: ReturnType<typeof getSpacetimeClient>, email: string): Promise<void> {
  root.replaceChildren(el(`
    <div>
      <header>
        <h1>Weltraum Admin</h1>
        <div>${email} · <button type="button" id="out">Sign out</button></div>
      </header>
      <main>
        <div class="stats" id="stats"></div>
        <div class="row">
          <input id="q" placeholder="Search id, name, email" />
          <button type="button" id="reload">Reload</button>
        </div>
        <table><thead><tr>
          <th>ID</th><th>Name</th><th>Email</th><th>Coins</th><th>Unlock</th><th>Ships</th><th>Last seen</th><th>Ban</th>
        </tr></thead><tbody id="rows"></tbody></table>
        <div class="panel" id="detail"><p>Select a player.</p></div>
      </main>
    </div>
  `));
  (root.querySelector('#out') as HTMLButtonElement).onclick = async () => {
    await signOutFirebase();
    location.reload();
  };
  const q = root.querySelector('#q') as HTMLInputElement;
  const reload = async () => {
    const stats = await client.adminStats();
    (root.querySelector('#stats') as HTMLElement).innerHTML = `
      <div class="card">Players<b>${stats?.players ?? 0}</b></div>
      <div class="card">Active this week<b>${stats?.activeWeek ?? 0}</b></div>
      <div class="card">Games played<b>${stats?.gamesPlayed ?? 0}</b></div>`;
    const list = await client.adminListPlayers(q.value || '');
    const rows = (list || []) as PlayerRow[];
    const body = root.querySelector('#rows') as HTMLElement;
    body.innerHTML = rows.map((r) => `<tr data-id="${r.id}">
      <td>${r.id.slice(0, 10)}</td><td>${r.username || '—'}</td><td>${r.email || '—'}</td>
      <td>${r.coins}</td><td>${r.unlocked}</td><td>${(r.ships || '').split(',').filter(Boolean).length}</td>
      <td>${fmtWhen(r.lastSeen)}</td><td>${r.banned ? 'yes' : ''}</td>
    </tr>`).join('');
    body.querySelectorAll('tr').forEach((tr) => {
      tr.addEventListener('click', () => { void showPlayer(client, tr.getAttribute('data-id') || ''); });
    });
  };
  (root.querySelector('#reload') as HTMLButtonElement).onclick = () => { void reload(); };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') void reload(); });
  await reload();
}

async function showPlayer(client: ReturnType<typeof getSpacetimeClient>, id: string): Promise<void> {
  const row = await client.adminGetPlayer(id);
  const box = root.querySelector('#detail') as HTMLElement;
  if (!row) { box.innerHTML = '<p class="err">Not found.</p>'; return; }
  box.innerHTML = `
    <h2>${row.username || 'Pilot'} <small>${row.id}</small></h2>
    <p>${row.email || 'no linked email'} · unlock ${row.unlocked} · coins ${row.coins} · ${row.banned ? 'BANNED' : 'active'}</p>
    <p>Ships: ${row.ships || 'starter'}</p>
    <div class="row">
      <input id="coins" type="number" value="${row.coins}" />
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
      <button type="button" id="resetProg">Reset levels</button>
      <button type="button" class="danger" id="resetAll">Reset player</button>
      <input id="reason" placeholder="ban reason" />
      <button type="button" class="danger" id="ban">Ban</button>
      <button type="button" id="unban">Unban</button>
    </div>
    <p id="act"></p>`;
  const note = box.querySelector('#act') as HTMLElement;
  const run = async (fn: () => Promise<void>) => {
    try { await fn(); note.className = 'ok'; note.textContent = 'Saved.'; await showPlayer(client, id); }
    catch (err) { note.className = 'err'; note.textContent = err instanceof Error ? err.message : String(err); }
  };
  (box.querySelector('#setCoins') as HTMLButtonElement).onclick = () => run(() => client.adminSetCoins(id, BigInt((box.querySelector('#coins') as HTMLInputElement).value || '0')));
  (box.querySelector('#addCoins') as HTMLButtonElement).onclick = () => run(() => client.adminAddCoins(id, BigInt((box.querySelector('#delta') as HTMLInputElement).value || '0')));
  (box.querySelector('#unlock') as HTMLButtonElement).onclick = () => run(() => client.adminUnlockLevel(id, Number((box.querySelector('#lvl') as HTMLInputElement).value || 1)));
  (box.querySelector('#grant') as HTMLButtonElement).onclick = () => run(() => client.adminGrantShip(id, (box.querySelector('#ship') as HTMLInputElement).value.trim()));
  (box.querySelector('#remove') as HTMLButtonElement).onclick = () => run(() => client.adminRemoveShip(id, (box.querySelector('#ship') as HTMLInputElement).value.trim()));
  (box.querySelector('#resetProg') as HTMLButtonElement).onclick = () => run(() => client.adminResetProgress(id));
  (box.querySelector('#resetAll') as HTMLButtonElement).onclick = () => run(() => client.adminResetPlayer(id));
  (box.querySelector('#ban') as HTMLButtonElement).onclick = () => run(() => client.adminBan(id, (box.querySelector('#reason') as HTMLInputElement).value));
  (box.querySelector('#unban') as HTMLButtonElement).onclick = () => run(() => client.adminUnban(id));
}

void boot();
