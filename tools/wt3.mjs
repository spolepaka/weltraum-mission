import { spawn } from 'child_process';
const [port, file, w, h, ...levels] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/wt${port}`,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id=0; const pend={}, errs=[];
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); if (d.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(d.params.exceptionDetails).slice(0,200)); };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
const ev = async e => (await send('Runtime.evaluate', {expression: e, returnByValue: true})).result?.result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {width:+w, height:+h, deviceScaleFactor:1, mobile:true});
await send('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:5});
await send('Page.navigate', {url:'file://'+file}); await sleep(1200);
const touch = (type, x, y) => send('Input.dispatchTouchEvent', {type, touchPoints: type==='touchEnd'?[]:[{x, y, id: 1}]});
for (const L of levels) {
  await ev(`window.__spaceGame.startLevel(${L}); 1`);
  const S = await ev('window.__spaceGame.dims().S');
  // wait for natural portal
  let st; for (let i = 0; i < 120; i++) { await ev('window.__spaceGame.setInvuln(99); 1'); st = JSON.parse(await ev('JSON.stringify(Object.assign(window.__spaceGame.wormState(), {worm: window.__spaceGame.feat().worm, wells: window.__spaceGame.state().holes}))')); if (st.worm && st.wy > st.sy - 400) break; await sleep(100); }
  if (!st.worm) { console.log(`L${L} ${w}x${h}: no portal appeared`); continue; }
  const A = st.worm.ax, B = st.worm.bx; let x = st.x;
  await touch('touchStart', x * S, (st.sy - 10) * S);
  const log = []; let tp = 0, lastX = x;
  // steer finger toward A slowly; stay; then move away
  for (let f = 0; f < 70; f++) {
    const s2 = JSON.parse(await ev('JSON.stringify(window.__spaceGame.wormState())'));
    await ev('window.__spaceGame.setInvuln(99); 1');
    if (Math.abs(s2.x - lastX) > 150) tp++;
    log.push(`${f}:x${s2.x}${s2.exit !== undefined && s2.exit !== null ? '*' : ''}/wy${s2.wy}`);
    lastX = s2.x;
    // finger target: before teleport go toward A, after teleport keep still 10 frames, then drift right 
    const goal = tp === 0 ? A : (f % 30 < 15 ? s2.x : s2.x + (B > A ? 6 : -6));
    x = x + Math.max(-14, Math.min(14, (tp === 0 ? goal - s2.x : goal - s2.x)));
    await touch('touchMove', Math.max(5, Math.min(+w - 5, x * S)), (st.sy - 10) * S);
    await sleep(40);
  }
  await touch('touchEnd');
  console.log(`L${L} ${w}x${h} A=${Math.round(A)} B=${Math.round(B)} teleports=${tp}`); console.log('  ' + log.join(' '));
}
console.log('errs', JSON.stringify(errs)); ws.close(); ch.kill(); process.exit(0);
