import { spawn } from 'child_process'; import fs from 'fs';
const [port, file, w, h, setup, out] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/shot${port}`,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id=0; const pend={};
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
await send('Emulation.setDeviceMetricsOverride', {width:+w, height:+h, deviceScaleFactor:1, mobile:false});
await send('Page.navigate', {url:'file://'+file}); await sleep(1200);
const r = await send('Runtime.evaluate', {expression: setup, returnByValue: true, awaitPromise: true}); console.log(JSON.stringify(r.result.result.value));
await sleep(1500);
const s = await send('Page.captureScreenshot', {format:'png'}); fs.writeFileSync(out, Buffer.from(s.result.data, 'base64')); ch.kill(); process.exit(0);
