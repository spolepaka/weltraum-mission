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
import fs from 'fs';
await ev(`(function(){var st=document.createElement('style'); st.textContent='#msg,#hud,#controls,#power,#wordBox{display:none!important}'; document.head.appendChild(st); return 1;})()`);
const names = [];
for (const LL of [...Array(33).keys()].map(i=>3+3*i).concat([100])) {
  await ev(`window.__spaceGame.startLevel(${LL}); window.__spaceGame.setInvuln(99); window.__spaceGame.boss(); (function(){var G=window.__spaceGame; G.clear(); var b=G.bossInfo(); return 1;})()`);
  await ev(`(function(){ var s=window.__spaceGame; var bi=s.bossInfo(); return 1; })()`);
  await ev('window.__sim={speed:4}; 1'); await sleep(1000); await ev('window.__sim=null; window.__spaceGame.clear(); 1'); await sleep(100);
  const nm = await ev(`(function(){var f=window.__spaceGame.feat(); return [f.bossType, document.querySelector('#bossName')?document.querySelector('#bossName').textContent:'' , window.__spaceGame.levelInfo(${LL}).boss]})()`);
  const bi = await ev(`JSON.stringify(Object.assign(window.__spaceGame.bossInfo(), {S: window.__spaceGame.dims().S}))`); const b = JSON.parse(bi); b.x*=b.S; b.y*=b.S;
  const r = await send('Page.captureScreenshot', {format:'png', clip:{x: Math.max(0,b.x-200), y: Math.max(0, b.y-150), width: 400, height: 300, scale: 0.6}});
  fs.writeFileSync(`/tmp/bs_${LL}.png`, Buffer.from(r.result.data,'base64')); names.push([LL, nm[2]]);
}
fs.writeFileSync('/tmp/bs_names.json', JSON.stringify(names));
console.log('errs', JSON.stringify(errs)); ws.close(); ch.kill(); process.exit(0);
