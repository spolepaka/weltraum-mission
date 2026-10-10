import { spawn } from 'child_process'; import fs from 'fs';
const [port, file, w, h, ...idx] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/mshot${port}`,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id=0; const pend={}; const errs=[];
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); if (d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text); if (d.method==='Runtime.consoleAPICalled' && d.params.type==='error') errs.push(JSON.stringify(d.params.args)); };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
const ev = async e => (await send('Runtime.evaluate', {expression:e, returnByValue:true})).result?.result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {width:+w, height:+h, deviceScaleFactor:1, mobile:false});
await send('Page.navigate', {url:'file://'+file}); await sleep(800);
await ev(`localStorage.setItem('spaceMissionProgress', JSON.stringify({unlocked:100,stars:{}}))`);
await send('Page.reload'); await sleep(1200);
console.log('bad icons', JSON.stringify(await ev('window.__spaceGame.bossIconOk()')), await ev('window.__iconErr'));
for (const i of idx) { await ev(`window.__spaceGame.centerMap(${i})`); await sleep(700); const s = await send('Page.captureScreenshot', {format:'png'}); fs.writeFileSync(`/tmp/map_${w}_${i}.png`, Buffer.from(s.result.data, 'base64')); }
console.log('errors', JSON.stringify(errs)); ch.kill(); process.exit(0);
