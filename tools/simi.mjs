// node --experimental-websocket sim.mjs PORT FILE jobs... ; job = ship:L:runs:rate,dmg,heart  -> prints JSON lines
import { spawn } from 'child_process'; import fs from 'fs';
const [port, file, ...jobs] = process.argv.slice(2);
const bot = fs.readFileSync(new URL('./bot.js', import.meta.url), 'utf8');
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu','--mute-audio',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/simprof${port}`,'--window-size=1024,768','about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = {};
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
const ev = async e => { const r = await send('Runtime.evaluate', {expression: e, returnByValue: true, awaitPromise: true}); return r.result?.result?.value; };
await send('Emulation.setFocusEmulationEnabled', {enabled: true});
for (const job of jobs) {
  const [ship, L, runs, up] = job.split(':'); const [ra, dm, he] = (up || '0,0,0').split(',').map(Number);
  for (let r = 0; r < +runs; r++) {
    await send('Page.navigate', {url: 'file://' + file});
    await sleep(700);
    await ev(`localStorage.setItem('spaceMissionShop', JSON.stringify({coins:0,owned:['starter','${ship}'],equipped:'${ship}',up:{heart:${he},rate:${ra},dmg:${dm},dur:3,mag:3}})); localStorage.setItem('spaceMissionProgress', JSON.stringify({unlocked:100,stars:{}})); 1`);
    await send('Page.reload'); await sleep(800);
    await ev(bot + `; window.__spaceGame.setShip('${ship}'); window.__spaceGame.startLevel(${L}); 1`);
    const t0 = Date.now(); let st;
    while (Date.now() - t0 < 150000) { await sleep(1000); st = await ev('JSON.stringify(window.__spaceGame.simInfo())'); st = st && JSON.parse(st); if (st && st.state !== 'play' && st.state !== 'dying' && st.state !== 'sucked') break; }
    console.log(JSON.stringify({ship, L: +L, win: st && st.state === 'won', state: st && st.state, lives: st && st.lives, lt: st && Math.round(st.lt), boss: st && st.boss ? Math.round(st.boss.hp/st.boss.max*100) : null, hs: await ev("JSON.stringify(window.__H||{})"), err: await ev('window.__sim && window.__sim.err || null')}));
  }
}
ws.close(); ch.kill(); process.exit(0);
