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
// secret code
console.log('secret', await ev(`(function(){document.getElementById('shopBtn').click(); var i=document.getElementById('secretIn'); i.value='alle level'; document.getElementById('secretOk').click(); return [window.__spaceGame.progress().unlocked, document.getElementById('shopToast').textContent];})()`));
console.log('reset', await ev(`(function(){ /* simulate Neu starten confirm */ return 1; })()`));
// wormhole: level 8 has worms
await ev(`window.__spaceGame.startLevel(9); window.__spaceGame.setInvuln(99); window.__spaceGame.clear(); 1`);
await sleep(2500);
const r = await ev(`new Promise(function(res){ var G=window.__spaceGame, s=G.ship(); G.clear(); 
  // force portal
  var out=[]; var w = null;
  (function place(){ /* use internal via feat */ })();
  res(JSON.stringify(G.feat().worm)); })`);
console.log('worm now', r);
ws.close(); ch.kill(); console.log('errs', errs); process.exit(0);
