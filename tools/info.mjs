import { spawn } from 'child_process';
const [port, file, expr] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/inf${port}`,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id=0; const pend={};
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) pend[d.id](d); };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
await send('Page.navigate', {url:'file://'+file}); await sleep(1200);
const r = await send('Runtime.evaluate', {expression: expr, returnByValue: true}); console.log(JSON.stringify(r.result.result.value, null, 1)); ch.kill(); process.exit(0);
