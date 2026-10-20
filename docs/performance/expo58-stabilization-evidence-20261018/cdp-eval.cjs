const fs = require('node:fs');
const WebSocket = require('E:/AnchorQA/expo58-stabilization-20261018/candidate/anchor/mobile/node_modules/ws');
(async () => {
  const targets = await (await fetch('http://localhost:8081/json/list')).json();
  if (targets.length !== 1) throw new Error('Exactly one explicit QA inspector target required');
  const expression = fs.readFileSync(process.argv[2], 'utf8');
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl, { origin: 'http://127.0.0.1:8081' });
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.close(); reject(new Error('Inspector evaluation timeout')); }, 20000);
    socket.on('open', () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
      expression, awaitPromise: true, returnByValue: true,
    } })));
    socket.on('error', error => { clearTimeout(timeout); reject(error); });
    socket.on('close', code => { clearTimeout(timeout); reject(new Error('Inspector closed: ' + code)); });
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      if (message.id !== 1) return;
      clearTimeout(timeout); socket.close(); resolve(message);
    });
  });
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
