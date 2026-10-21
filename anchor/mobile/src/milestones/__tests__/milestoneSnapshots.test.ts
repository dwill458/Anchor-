const mockStorage = new Map<string, string>();
const mockPost = jest.fn();
const mockAuth = { user: { id: 'u' }, token: 't', accountRevision: 1 };
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));

jest.mock('@/services/ApiClient', () => ({ apiClient: { post: (...args: unknown[]) => mockPost(...args) } }));
jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStorage.set(key, value);
    },
  },
}));

import {
  applyServerRecords,
  flushPendingReceipts,
  getSnapshot,
  resetMilestoneSnapshots,
  restoreSnapshot,
  settleMilestone,
} from '../milestoneSnapshots';
import type { MilestoneRecord } from '../milestoneModel';

const rec = (id: string, definitionId: string, celebratedAt: string | null = null): MilestoneRecord => ({
  id,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt: '2026-10-01T00:00:00Z',
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata: {},
  celebratedAt,
});
const NOW = new Date('2026-10-19T12:00:00Z');

describe('milestoneSnapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.user.id = 'u'; mockAuth.accountRevision = 1;
    mockStorage.clear();
    resetMilestoneSnapshots();
    mockPost.mockResolvedValue({ data: { success: true } });
  });

  it('settles a milestone once: stamps it locally, posts the receipt, clears the pending flag', async () => {
    applyServerRecords('u', 'a1', [rec('m1', 'commitment.practices.1')], NOW);
    await settleMilestone('u', rec('m1', 'commitment.practices.1'), NOW);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/milestones/m1/celebrated', undefined, expect.objectContaining({ anchorAuthToken: 't' }));
    const snap = getSnapshot('u', 'a1')!;
    expect(snap.records[0].celebratedAt).toBe(NOW.toISOString());
    expect(snap.pendingCelebrated).toEqual([]);

    await settleMilestone('u', rec('m1', 'commitment.practices.1'), NOW);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('records a milestone it had not seen (earned during practice sync) and settles it', async () => {
    await settleMilestone('u', rec('m9', 'strength.building'), NOW);
    expect(getSnapshot('u', 'a1')!.records.map((r) => r.id)).toEqual(['m9']);
    expect(getSnapshot('u', 'a1')!.records[0].celebratedAt).toBe(NOW.toISOString());
  });

  it('keeps the receipt for retry while offline and delivers it later', async () => {
    mockPost.mockRejectedValueOnce(new Error('offline'));
    await settleMilestone('u', rec('m1', 'commitment.practices.1'), NOW);
    expect(getSnapshot('u', 'a1')!.pendingCelebrated).toEqual(['m1']);
    expect(getSnapshot('u', 'a1')!.records[0].celebratedAt).toBe(NOW.toISOString());

    await flushPendingReceipts('u', 'a1');
    expect(getSnapshot('u', 'a1')!.pendingCelebrated).toEqual([]);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('a server read that predates the receipt cannot bring a celebration back', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await settleMilestone('u', rec('m1', 'commitment.practices.1'), NOW);
    applyServerRecords('u', 'a1', [rec('m1', 'commitment.practices.1', null)], NOW);
    expect(getSnapshot('u', 'a1')!.records[0].celebratedAt).not.toBeNull();
  });

  it('never drops an earned milestone because a read omitted it', () => {
    applyServerRecords('u', 'a1', [rec('m1', 'strength.building'), rec('m2', 'commitment.practices.1')], NOW);
    applyServerRecords('u', 'a1', [rec('m2', 'commitment.practices.1')], NOW);
    expect(getSnapshot('u', 'a1')!.records.map((r) => r.id).sort()).toEqual(['m1', 'm2']);
  });

  it('survives a restart: the persisted snapshot restores, including pending receipts', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await settleMilestone('u', rec('m1', 'commitment.practices.1'), NOW);
    resetMilestoneSnapshots();
    const restored = await restoreSnapshot('u', 'a1');
    expect(restored?.records.map((r) => r.id)).toEqual(['m1']);
    expect(restored?.pendingCelebrated).toEqual(['m1']);
  });

  it('keeps accounts and Anchors separate', async () => {
    applyServerRecords('u', 'a1', [rec('m1', 'strength.building')], NOW);
    expect(getSnapshot('someone-else', 'a1')).toBeNull();
    expect(getSnapshot('u', 'a2')).toBeNull();
  });

  it('keeps a receipt pending after an account switch during delivery', async () => {
    mockPost.mockImplementationOnce(async (_url, _body, config) => {
      expect(config.anchorAuthGuard()).toBe(true);
      mockAuth.accountRevision = 2;
      expect(config.anchorAuthGuard()).toBe(false);
      return {};
    });
    await settleMilestone('u', rec('m1', 'strength.building'), NOW);
    expect(getSnapshot('u', 'a1')!.pendingCelebrated).toEqual(['m1']);
  });

  it('preserves the reservation token through stale server reads and process restart', async () => {
    const reserved = { ...rec('m1', 'strength.building'), presentationId: 'reservation', presentationExpiresAt: new Date(Date.now() + 90000).toISOString() };
    applyServerRecords('u', 'a1', [reserved]);
    applyServerRecords('u', 'a1', [rec('m1', 'strength.building')]);
    resetMilestoneSnapshots(); await restoreSnapshot('u', 'a1');
    await settleMilestone('u', reserved);
    expect(mockPost).toHaveBeenLastCalledWith('/api/v2/milestones/m1/celebrated', { presentationId: 'reservation' }, expect.any(Object));
  });
});
