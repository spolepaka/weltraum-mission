import { spawn } from 'child_process';
const [port, file] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/wt${port}`,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id=0; const pend={}, errs=[];
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); if (d.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(d.params.exceptionDetails).slice(0,200)); };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
const ev = async e => (await send('Runtime.evaluate', {expression: e, returnByValue: true, awaitPromise: true})).result?.result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {width:1024, height:768, deviceScaleFactor:1, mobile:false});
await send('Page.navigate', {url:'file://'+file}); await sleep(1200);
await ev(`window.__spaceGame.startLevel(9); 1`); await sleep(2500);
const out = await ev(`new Promise(function(res){ var G=window.__spaceGame; G.setInvuln(999); G.clear(); G.wormAt(250, 750); var s=G.ship(); s.x=150; s.prevX=150; var log=[], tt=0;
  window.__sim={speed:1, bot:function(dt){ tt+=dt; G.setInvuln(999); if (tt<1.2) s.x += 200*dt; else if (tt<2.5) s.x += 0; else s.x -= 0; log.push(Math.round(s.x)); }};
  setTimeout(function(){ window.__sim=null; var st=G.wormState(); res(JSON.stringify({trace: log.filter(function(_,i){return i%6===0;}), end: st})); }, 3000); })`);
console.log(out);
// bullet test: ship under portal a; fire
const b = await ev(`new Promise(function(res){ var G=window.__spaceGame; G.clear(); G.wormAt(300, 700); var s=G.ship(); s.x=300; s.prevX=300; s.wormExit=300; G.setFire(true); var seen=[]; var iv=setInterval(function(){ seen.push(G.wormState().bullets.join(',')); },50); setTimeout(function(){ clearInterval(iv); G.setFire(false); res(JSON.stringify(seen.slice(0,14))); },700); })`);
console.log('bullets', b);
ws.close(); ch.kill(); console.log('errs', errs); process.exit(0);
