import express from 'express';
import request from 'supertest';

// Any route that reaches auth is rejected, which proves session audio never asks for an account.
jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(401).json({ error: 'auth required' });
  },
}));

const mockGetSignedUrl = jest.fn();
jest.mock('../../../../services/StorageService', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

import sessionAudioRoutes from '../sessionAudioRoutes';

const app = express();
app.use('/api/v2', sessionAudioRoutes);

describe('GET /api/v2/session-audio/:file', () => {
  beforeEach(() => {
    mockGetSignedUrl.mockReset();
    mockGetSignedUrl.mockResolvedValue('https://acct.r2.cloudflarestorage.com/anchor/session-audio/x.mp3?sig=1');
  });

  it('redirects to a short-lived signed URL inside the session-audio prefix, without auth', async () => {
    const response = await request(app).get('/api/v2/session-audio/DeepFocus_10min_Lina.bdbe6e66.mp3');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://acct.r2.cloudflarestorage.com/anchor/session-audio/x.mp3?sig=1');
    expect(response.headers['cache-control']).toBe('private, max-age=300');
    expect(mockGetSignedUrl).toHaveBeenCalledWith('session-audio/DeepFocus_10min_Lina.bdbe6e66.mp3', 3600);
  });

  it.each(['..%2Fsecrets.mp3', 'track.wav', '.mp3', 'a..mp3', 'a%20b.mp3'])('refuses %s', async (file) => {
    const response = await request(app).get(`/api/v2/session-audio/${file}`);
    expect(response.status).toBe(404);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('is mounted ahead of the authenticated V2 routers', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.ts'), 'utf8') as string;
    expect(source.indexOf("v2Router.use('/', sessionAudioRoutes)")).toBeLessThan(source.indexOf("v2Router.use('/', visionRoutes)"));
  });
});
