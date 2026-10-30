import { spawnSync } from 'child_process';
import { ipKeyGenerator } from 'express-rate-limit';

describe('HTTP dependency abuse regressions', () => {
  it('keeps distinct IPv4-mapped clients in distinct rate-limit and guest-budget buckets', () => {
    const first = ipKeyGenerator('::ffff:192.0.2.1');
    const second = ipKeyGenerator('::ffff:198.51.100.2');
    expect(first).not.toBe(second);
    expect(first).toBe(ipKeyGenerator('192.0.2.1'));
    expect(second).toBe(ipKeyGenerator('198.51.100.2'));
  });

  it.each(['gzip', 'deflate'] as const)(
    'a small %s request with delayed trailing bytes cannot crash the HTTP process',
    encoding => {
      // Child isolation is essential: the vulnerable decoder throws outside the
      // Express error boundary. The complete fixture is under 100 bytes, bounded
      // by both a child watchdog and spawn timeout; no external network is used.
      const script = `
      const express = require(${JSON.stringify(require.resolve('express'))});
      const http = require('http');
      const zlib = require('zlib');
      const app = express();
      app.use(express.json({ limit: '1mb' }));
      app.post('/', (_req, res) => res.json({ ok: true }));
      app.get('/health', (_req, res) => res.sendStatus(200));
      app.use((_error, _req, res, _next) => res.sendStatus(400));
      const watchdog = setTimeout(() => process.exit(3), 1500);
      const server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const compressed = zlib.${encoding === 'gzip' ? 'gzipSync' : 'deflateSync'}(Buffer.from('{}'));
        const req = http.request({ hostname: '127.0.0.1', port, path: '/', method: 'POST', headers: {
          'Content-Type': 'application/json', 'Content-Encoding': '${encoding}', 'Transfer-Encoding': 'chunked',
        } }, res => res.resume());
        req.on('error', () => {});
        req.write(compressed);
        setTimeout(() => req.end(Buffer.from('TRAILER')), 40);
        setTimeout(() => {
          const check = http.get({ hostname: '127.0.0.1', port, path: '/health' }, res => {
            res.resume();
            res.on('end', () => {
              process.stdout.write('health:' + res.statusCode);
              clearTimeout(watchdog);
              server.closeAllConnections();
              server.close(() => process.exit(res.statusCode === 200 ? 0 : 2));
            });
          });
          check.on('error', () => process.exit(4));
        }, 180);
      });
    `;
      const child = spawnSync(process.execPath, ['-e', script], {
        encoding: 'utf8',
        timeout: 4000,
      });
      expect({ status: child.status, error: child.error?.message, stderr: child.stderr }).toEqual({
        status: 0,
        error: undefined,
        stderr: '',
      });
      expect(child.stdout).toBe('health:200');
    }
  );
});
