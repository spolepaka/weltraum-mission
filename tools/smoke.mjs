import { spawn } from 'child_process';
const [port, file, w, h] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/smk${port}`,`--window-size=${w},${h}`,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = {}, issues = [];
for (let i = 0; i < 40; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(250); }
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') issues.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0,300));
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') issues.push('ERR ' + JSON.stringify(d.params.args).slice(0,300));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/peerjs|unpkg|net::|src\/main\.ts|CORS/.test(d.params.entry.text + d.params.entry.url)) issues.push('LOG ' + d.params.entry.text); };
const send = (method, params={}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method, params})); });
const ev = async e => (await send('Runtime.evaluate', {expression: e, returnByValue: true})).result?.result?.value;
await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', {width:+w, height:+h, deviceScaleFactor:1, mobile:false});
await send('Page.navigate', {url: 'file://' + file}); await sleep(1500);
const out = { state0: await ev('window.__spaceGame.state().state'), planets: await ev('window.__spaceGame.mapInfo().planets.length') };
for (const L of [1, 19, 21, 50, 60, 100]) { await ev(`window.__spaceGame.startLevel(${L})`); await sleep(1500); out['L'+L] = await ev('(function(){var s=window.__spaceGame.state();return s.state+" boss:"+(s.boss!==null)})()'); }
out.heat = await ev('[19,40,70,97,100].map(function(L){return window.__spaceGame.levelInfo(L).heat})');
await ev('document.getElementById("pauseBtn") && 1');
console.log(JSON.stringify(out), 'ISSUES', JSON.stringify(issues));
ws.close(); ch.kill(); process.exit(0);
