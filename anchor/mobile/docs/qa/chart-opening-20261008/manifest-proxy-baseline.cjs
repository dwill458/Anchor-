const http = require('http');

http.createServer(async (_request, response) => {
  try {
    const upstream = await fetch('http://127.0.0.1:8111/', {
      headers: { 'expo-platform': 'android', accept: 'application/expo+json' },
    });
    const manifest = await upstream.json();
    manifest.launchAsset.url =
      'http://127.0.0.1:8111/chart-opening-baseline.bundle?platform=android&dev=false&minify=true&lazy=false&transform.engine=hermes';
    response.writeHead(200, {
      'content-type': 'application/expo+json',
      'expo-protocol-version': '0',
    });
    response.end(JSON.stringify(manifest));
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
}).listen(8112, '0.0.0.0');
