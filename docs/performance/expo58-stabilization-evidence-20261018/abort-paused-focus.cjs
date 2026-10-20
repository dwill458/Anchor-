const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const WebSocket = require('E:/AnchorQA/expo58-stabilization-20261018/candidate/anchor/mobile/node_modules/ws');
const evidence = __dirname;
const adb = 'C:/Users/dwill/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const output = path.join(evidence, 'native-fault-navigation.jsonl');
const append = value => fs.appendFileSync(output, JSON.stringify({ utc: new Date().toISOString(), ...value }) + '\n');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const targets = await (await fetch('http://localhost:8081/json/list')).json();
  if (targets.length !== 1) throw new Error('Exactly one inspector target required');
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl, { origin: 'http://127.0.0.1:8081' });
  await new Promise((resolve, reject) => { socket.on('open', resolve); socket.on('error', reject); });
  const pending = new Map(); let sequence = 0;
  socket.on('message', raw => {
    const message = JSON.parse(String(raw)); const entry = pending.get(message.id); if (!entry) return;
    pending.delete(message.id); clearTimeout(entry.timeout);
    if (message.error || message.result?.exceptionDetails) entry.reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails)));
    else entry.resolve(message.result?.result?.value);
  });
  const evaluate = expression => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Inspector response timeout')); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  try {
    const state=await evaluate('globalThis.__anchorStabilizationQA.guard();globalThis.__anchorStabilizationQA.screenState()');
    if(state.focusedRouteName!=='V2Practice'||!state.active||state.complete)throw Error('Focused paused screen required');
    await evaluate("globalThis.__anchorStabilizationQA.measureButton('focus-paused-end-button')");
    let button;
    for(let i=0;i<40;i++){button=await evaluate('globalThis.__anchorStabilizationQA.button');if(button.status==='ready')break;await wait(100);}
    if(button.status!=='ready')throw Error('Focused Continue not measurable');
    const focused=execFileSync(adb,['-s','R5CX12KBNGR','shell','dumpsys','window'],{encoding:'utf8'}).split('\n').find(line=>line.includes('mCurrentFocus='))??'';
    if(!focused.includes('u10 ')||!focused.includes('com.anchorintentions.sqlcipherpreview20261015'))throw Error('Isolated foreground required');
    execFileSync(adb,['-s','R5CX12KBNGR','shell','input','tap',String(button.tapX),String(button.tapY)]);
    let returned;
    for(let i=0;i<75;i++){returned=await evaluate('globalThis.__anchorStabilizationQA.screenState()');if(returned.focusedRouteName==='V2DevelopmentHome')break;await wait(200);}
    if(returned.focusedRouteName!=='V2DevelopmentHome')throw Error('Did not return to Home');
    append({event:'background-aborted-session-home-return',profile:10,focusedRouteName:returned.focusedRouteName,historyCount:returned.historyCount});
  } finally { socket.close(); }
})().catch(error => { append({ event: 'failed', message: error.message }); process.exitCode = 1; });
