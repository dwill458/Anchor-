const http = require('node:http');
let runId = null;
http.createServer(async (request, response) => {
  if (request.url === '/control') {
    if (request.method === 'POST') {
      let body = '';
      for await (const chunk of request) body += chunk;
      runId = JSON.parse(body).runId;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ runId }));
    return;
  }
  try {
    if (new URL(request.url, 'http://localhost').pathname !== '/') {
      const asset = await fetch('http://127.0.0.1:8081' + request.url);
      response.writeHead(asset.status, { 'content-type': asset.headers.get('content-type') || 'application/octet-stream' });
      response.end(Buffer.from(await asset.arrayBuffer()));
      return;
    }
    const upstream = await fetch('http://127.0.0.1:8081/', { headers: { 'expo-platform': 'android', accept: 'application/expo+json' } });
    const manifest = await upstream.json();
    const bundleURL = new URL(manifest.launchAsset.url);
    bundleURL.pathname = '/session-audio-qa.bundle';
    manifest.launchAsset.url = bundleURL.toString();
    response.writeHead(200, { 'content-type': 'application/expo+json', 'expo-protocol-version': '0' });
    response.end(JSON.stringify(manifest));
  } catch (error) { response.writeHead(500); response.end(String(error)); }
}).listen(8094, '0.0.0.0', () => console.log('Audio QA manifest proxy listening on 8094'));
