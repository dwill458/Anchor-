const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const WebSocket = require('E:/AnchorQA/expo58-stabilization-20261018/candidate/anchor/mobile/node_modules/ws');
const evidence = __dirname;
const adb = 'C:/Users/dwill/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const output = path.join(evidence, 'native-focus-cycles.jsonl');
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
    await evaluate('globalThis.__anchorStabilizationQA.guard(); true');
    append({ event: 'start', profile: 10, controlledSamples: 20, pilotSamples: 1, plannedDurationSeconds: 30 });
    for (let cycle = 1; cycle <= 21; cycle++) {
      if (cycle > 1) {
        const started = await evaluate('globalThis.__anchorStabilizationQA.startFocus()');
        append({ event: 'route-start', cycle, ...started });
      }
      let state; const deadline = Date.now() + 65000;
      do {
        state = await evaluate('globalThis.__anchorStabilizationQA.screenState()');
        if (state.failures) throw new Error('Focus persistence rejected');
        if (state.complete && state.historyCount === cycle) break;
        if (Date.now() > deadline) throw new Error('Completion did not reach a durable completion screen');
        await wait(500);
      } while (true);
      const observedCompletionMs = cycle === 1 ? null : state.sinceRouteMs;
      await evaluate('globalThis.__anchorStabilizationQA.verifyCycle()');
      let verified;
      for (let attempt = 0; attempt < 100; attempt++) {
        verified = await evaluate('globalThis.__anchorStabilizationQA.verification');
        if (verified.status === 'failed') throw new Error(verified.message);
        if (verified.status === 'complete') break;
        await wait(100);
      }
      if (verified.status !== 'complete') throw new Error('Durability verification did not settle');
      await evaluate("globalThis.__anchorStabilizationQA.measureButton('focus-complete-done-button')");
      let button;
      for (let attempt = 0; attempt < 40; attempt++) {
        button = await evaluate('globalThis.__anchorStabilizationQA.button');
        if (button.status === 'ready') break;
        await wait(100);
      }
      if (button.status !== 'ready') throw new Error('Continue native touch target not measurable');
      const focused = execFileSync(adb, ['-s', 'R5CX12KBNGR', 'shell', 'dumpsys', 'window'], { encoding: 'utf8' }).split('\n').find(line => line.includes('mCurrentFocus=')) ?? '';
      if (!focused.includes('u10 ') || !focused.includes('com.anchorintentions.sqlcipherpreview20261015')) throw new Error('Phone left isolated QA profile; tap refused');
      execFileSync(adb, ['-s', 'R5CX12KBNGR', 'shell', 'input', 'tap', String(button.tapX), String(button.tapY)]);
      append({ event: 'cycle-verified', cycle, controlled: cycle > 1, observedCompletionMs, ...verified,
        continueTouch: { x: button.tapX, y: button.tapY, widthDp: button.width, heightDp: button.height } });
      await wait(1500);
    }
    const qa = await evaluate('globalThis.__anchorStabilizationQA.guard(); ({traces:globalThis.__anchorStabilizationQA.traces,verifiedCycles:globalThis.__anchorStabilizationQA.verifiedCycles})');
    fs.writeFileSync(path.join(evidence, 'native-focus-traces.json'), JSON.stringify(qa, null, 2));
    append({ event: 'complete', verifiedCycles: qa.verifiedCycles });
  } finally { socket.close(); }
})().catch(error => { append({ event: 'failed', message: error.message }); process.exitCode = 1; });
