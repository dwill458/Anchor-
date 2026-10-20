// Read-only inspector helper. Expressions must not print account data or secrets.
const fs = require('node:fs');
(async () => {
  const pages = await (await fetch('http://localhost:8081/json/list')).json();
  const page = pages.find(p => p.title.includes('samsung'));
  if (!page) throw new Error('No Samsung inspector target');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const timer = setTimeout(() => { socket.close(); process.exitCode = 1; }, 15000);
  socket.addEventListener('open', () => socket.send(JSON.stringify({id: 0, method: 'Runtime.enable'})));
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id === 0) { socket.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression: process.argv[2], returnByValue: true, awaitPromise: true}})); return; }
    if (msg.id !== 1) return;
    console.log(JSON.stringify(msg.result ?? msg.error, null, 2));
    clearTimeout(timer); socket.close();
  });
})();
