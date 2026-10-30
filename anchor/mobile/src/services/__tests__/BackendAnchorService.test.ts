import service, { isBackendAnchorId } from '../BackendAnchorService';
import { apiClient } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import type { Anchor } from '@/types';
let mockAuth = { accountRevision: 1, token: 'session-token', user: { id: 'account-a' }, isAuthenticated: true,
  pendingFirstAnchorDraft: null as { tempAnchorId: string; backendAnchorId?: string; ownerUserId?: string } | null };
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock('@/services/AuthService', () => ({ AuthService: { ensureGuestSession: async () => ({ user: { id: mockAuth.user.id }, token: 'verified-token' }) } }));

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('isBackendAnchorId', () => {
  it('only treats UUIDs as backend anchor ids', () => {
    expect(isBackendAnchorId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isBackendAnchorId('anchor-local-123')).toBe(false);
    expect(isBackendAnchorId('pending-first-anchor-123')).toBe(false);
    expect(isBackendAnchorId('temp-123')).toBe(false);
    expect(isBackendAnchorId('legacy-local-id')).toBe(false);
    expect(isBackendAnchorId('')).toBe(false);
    expect(isBackendAnchorId(undefined)).toBe(false);
  });
});

describe('original Anchor promotion ownership and idempotency', () => {
  const local = { id: 'local-original', userId: 'account-a', intentionText: 'I focus', category: 'career',
    distilledLetters: ['F', 'C', 'S'], baseSigilSvg: '<svg/>', structureVariant: 'balanced',
    createdAt: new Date(), updatedAt: new Date() } as Anchor;
  const apply = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { accountRevision: 1, token: 'session-token', user: { id: 'account-a' }, isAuthenticated: true, pendingFirstAnchorDraft: null };
    (useAnchorStore.getState as jest.Mock).mockReturnValue({ getAnchorById: () => local, applySyncedAnchor: apply });
  });
  it('retries original SVG promotion with the same stable key and captured owner', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({ data: { success: true, data: { ...local, id: 'server-anchor' } } });
    await expect(service.ensureServerAnchor(local.id)).rejects.toThrow('Connection lost');
    await service.ensureServerAnchor(local.id);
    const calls = (apiClient.post as jest.Mock).mock.calls;
    expect(calls[0][1].idempotencyKey).toBe(calls[1][1].idempotencyKey);
    expect(calls[1][2]).toMatchObject({ anchorAuthToken: 'verified-token', anchorAuthGuard: expect.any(Function) });
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it('rejects a foreign local owner before the network request', async () => {
    (useAnchorStore.getState as jest.Mock).mockReturnValue({ getAnchorById: () => ({ ...local, userId: 'account-b' }) });
    await expect(service.ensureServerAnchor(local.id)).rejects.toThrow('another account');
    expect(apiClient.post).not.toHaveBeenCalled();
  });
  it('rejects an unapproved guest transfer into a registered account', async () => {
    (useAnchorStore.getState as jest.Mock).mockReturnValue({ getAnchorById: () => ({ ...local, userId: 'guest' }) });
    await expect(service.ensureServerAnchor(local.id)).rejects.toThrow('not authorized');
    expect(apiClient.post).not.toHaveBeenCalled();
  });
  it('ignores a late response after an A to B to A switch', async () => {
    (apiClient.post as jest.Mock).mockImplementationOnce(async () => {
      mockAuth.accountRevision += 2;
      return { data: { success: true, data: { ...local, id: 'late-server-anchor' } } };
    });
    await expect(service.ensureServerAnchor(local.id)).rejects.toThrow('Authentication context changed');
    expect(apply).not.toHaveBeenCalled();
  });
});
