import express from 'express';
import request from 'supertest';
import { authMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { uploadProfilePicture } from '../../../services/StorageService';
import usersRouter from '../users';

jest.mock('../../middleware/auth');
jest.mock('../../../services/StorageService', () => ({ uploadProfilePicture: jest.fn() }));
jest.mock('../../../lib/prisma', () => ({ prisma: {
  user: { findUnique: jest.fn(), update: jest.fn() },
} }));

const mockUser = jest.mocked(require('../../../lib/prisma').prisma.user);
const user = { id: 'user-1', profilePictureUrl: 'https://example.test/picture.jpg' };
const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);
app.use(errorHandler);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(authMiddleware).mockImplementation(async (req, _res, next) => {
    req.user = { uid: 'firebase-1' } as typeof req.user;
    next();
  });
  mockUser.findUnique.mockResolvedValue(user);
  mockUser.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...user, ...data }));
});

it('returns a fresh cache key when the same profile photo object is replaced', async () => {
  jest.mocked(uploadProfilePicture).mockResolvedValue(user.profilePictureUrl);
  const body = { profilePictureBase64: 'data:image/jpeg;base64,AAAA' };
  const first = await request(app).patch('/api/users/me').send(body).expect(200);
  const second = await request(app).patch('/api/users/me').send(body).expect(200);
  expect(first.body.data.profilePictureUrl).toMatch(/^https:\/\/example\.test\/picture\.jpg\?v=.+$/);
  expect(second.body.data.profilePictureUrl).not.toBe(first.body.data.profilePictureUrl);
  expect(mockUser.update).toHaveBeenLastCalledWith({
    where: { authUid: 'firebase-1' }, data: { profilePictureUrl: second.body.data.profilePictureUrl },
  });
});

it('clears the saved URL when the user removes their photo', async () => {
  const response = await request(app).patch('/api/users/me').send({ profilePictureUrl: null }).expect(200);
  expect(response.body.data.profilePictureUrl).toBeNull();
  expect(uploadProfilePicture).not.toHaveBeenCalled();
});
