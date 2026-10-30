import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { readFileSync } from 'fs';
import path from 'path';
import { bodyComplexityGuard } from '../bodyComplexity';

function fixture() {
  const app = express();
  const validation = jest.fn((body: unknown) =>
    z
      .object({
        values: z.array(z.string()).max(3).optional(),
        data: z.unknown().optional(),
      })
      .passthrough()
      .safeParse(body)
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(bodyComplexityGuard);
  app.post('/', (req, res) => {
    const parsed = validation(req.body);
    res.status(parsed.success ? 200 : 400).json({ success: parsed.success });
  });
  return { app, validation };
}

describe('body complexity guard before schema validation', () => {
  it('accepts ordinary nested mobile payloads without altering their schema validation', async () => {
    const { app, validation } = fixture();
    const body = {
      values: ['one', 'two'],
      data: { settings: { audio: true }, scenes: [{ caption: 'A room' }] },
    };
    expect((await request(app).post('/').send(body)).status).toBe(200);
    expect(validation).toHaveBeenCalledWith(body);
  });

  it('rejects ten thousand invalid entries before Zod can allocate one issue per entry', async () => {
    const { app, validation } = fixture();
    const response = await request(app)
      .post('/')
      .send({ values: Array(10_000).fill(null) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_COMPLEX');
    expect(validation).not.toHaveBeenCalled();
  });

  it('rejects objects with more than 1024 own keys before schema validation', async () => {
    const { app, validation } = fixture();
    const response = await request(app)
      .post('/')
      .send({ data: Object.fromEntries(Array.from({ length: 1025 }, (_, i) => [`key${i}`, i])) });
    expect(response.status).toBe(413);
    expect(validation).not.toHaveBeenCalled();
  });

  it('rejects excessive total nodes even when individual arrays stay below their limit', async () => {
    const { app, validation } = fixture();
    const response = await request(app)
      .post('/')
      .send({ data: Array.from({ length: 9 }, () => Array(1024).fill(null)) });
    expect(response.status).toBe(413);
    expect(validation).not.toHaveBeenCalled();
  });

  it('rejects depth beyond 32 without recursive middleware traversal', async () => {
    const { app, validation } = fixture();
    let data: object = {};
    for (let i = 0; i < 40; i++) data = { nested: data };
    const response = await request(app).post('/').send({ data });
    expect(response.status).toBe(413);
    expect(validation).not.toHaveBeenCalled();
  });

  it('keeps ordinary schema failures governed by the existing Zod contract', async () => {
    const { app, validation } = fixture();
    expect(
      (
        await request(app)
          .post('/')
          .send({ values: ['one', 'two', 'three', 'four'] })
      ).status
    ).toBe(400);
    expect(validation).toHaveBeenCalledTimes(1);
  });

  it('does not inspect raw webhook buffers or primitive bodies', () => {
    for (const body of [Buffer.from('raw-signature-payload'), 'raw text', null, undefined]) {
      const next = jest.fn();
      const status = jest.fn();
      bodyComplexityGuard(
        { body } as express.Request,
        { status } as unknown as express.Response,
        next
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(status).not.toHaveBeenCalled();
    }
  });

  it('runs globally after parsers and before authentication/routes', () => {
    const index = readFileSync(path.join(__dirname, '../../../index.ts'), 'utf8');
    const guard = index.indexOf('app.use(bodyComplexityGuard)');
    expect(guard).toBeGreaterThan(index.indexOf('app.use(express.urlencoded('));
    expect(guard).toBeLessThan(index.indexOf("app.use('/api/', optionalAuthMiddleware)"));
  });
});
