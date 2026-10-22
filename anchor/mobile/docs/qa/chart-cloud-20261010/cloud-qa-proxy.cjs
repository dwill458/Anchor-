const http = require('http');

http.createServer(async (_request, response) => {
  try {
    const upstream = await fetch('http://127.0.0.1:8093/', {
      headers: { 'expo-platform': 'android', accept: 'application/expo+json' },
    });
    const manifest = await upstream.json();
    manifest.launchAsset.url = 'http://10.0.2.2:8093/cloud-qa-entry.bundle?platform=android&dev=true&minify=false&lazy=false&transform.engine=hermes';
    manifest.hostUri = '10.0.2.2:8093';
    manifest.extra ??= {};
    manifest.extra.expoGo ??= {};
    manifest.extra.expoGo.debuggerHost = '10.0.2.2:8093';
    manifest.extra.expoGo.mainModuleName = 'cloud-qa-entry';
    manifest.extra.expoGo.packagerOpts = { ...(manifest.extra.expoGo.packagerOpts || {}), dev: true, hot: false };
    manifest.extra.expoClient ??= {};
    manifest.extra.expoClient.hostUri = '10.0.2.2:8093';
    const body = JSON.stringify(manifest).replaceAll('127.0.0.1:8093', '10.0.2.2:8093');
    response.writeHead(200, { 'content-type': 'application/expo+json', 'expo-protocol-version': '0' });
    response.end(body);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
}).listen(8094, '0.0.0.0');
