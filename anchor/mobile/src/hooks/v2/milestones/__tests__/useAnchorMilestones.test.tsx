import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockStorage = new Map<string, string>();
const mockGet = jest.fn();
const mockPost = jest.fn();
let mockUserId: string | null = 'user-1';

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockUserId ? { id: mockUserId } : null }),
}));
jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStorage.set(key, value);
    },
  },
}));

import { useAnchorMilestones } from '../useAnchorMilestones';
import { milestoneCacheKey, serializeMilestoneCache } from '@/milestones/milestoneCache';
import type { MilestoneRecord } from '@/milestones/milestoneModel';

const rec = (id: string, definitionId: string, earnedAt: string, celebratedAt: string | null = null): MilestoneRecord => ({
  id,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata: {},
  celebratedAt,
});

const server = (milestones: MilestoneRecord[]) => ({ data: { success: true, data: { milestones, created: [] } } });

describe('useAnchorMilestones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockUserId = 'user-1';
  });

  it('loads the permanent record from the server and caches it', async () => {
    mockGet.mockResolvedValue(server([rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z')]));
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.records.map((r) => r.id)).toEqual(['m1']);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/anchors/a1/milestones');
    expect(JSON.parse(mockStorage.get(milestoneCacheKey('user-1', 'a1'))!).records).toHaveLength(1);
  });

  it('keeps earned milestones when the server cannot be reached', async () => {
    mockStorage.set(
      milestoneCacheKey('user-1', 'a1'),
      serializeMilestoneCache({
        schemaVersion: 1,
        accountId: 'user-1',
        anchorId: 'a1',
        records: [rec('m1', 'strength.building', '2026-10-01T00:00:00Z', '2026-10-01T00:01:00Z')],
        pendingCelebrated: [],
      }),
    );
    mockGet.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('offline'));
    expect(result.current.records.map((r) => r.definitionId)).toEqual(['strength.building']);
  });

  it('does not drop a cached milestone that a partial server read omits', async () => {
    mockStorage.set(
      milestoneCacheKey('user-1', 'a1'),
      serializeMilestoneCache({
        schemaVersion: 1,
        accountId: 'user-1',
        anchorId: 'a1',
        records: [rec('m1', 'strength.building', '2026-10-01T00:00:00Z', 'x')],
        pendingCelebrated: [],
      }),
    );
    mockGet.mockResolvedValue(server([rec('m2', 'commitment.practices.1', '2026-10-02T00:00:00Z')]));
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.records.map((r) => r.id).sort()).toEqual(['m1', 'm2']);
  });

  it('queues only uncelebrated milestones, oldest first', async () => {
    mockGet.mockResolvedValue(
      server([
        rec('m2', 'strength.established', '2026-10-03T00:00:00Z'),
        rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'),
        rec('m0', 'strength.building', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z'),
      ]),
    );
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.pendingCelebrations.map((r) => r.id)).toEqual(['m1', 'm2']);
  });

  it('records the celebration receipt once and posts it to the server', async () => {
    mockGet.mockResolvedValue(server([rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z')]));
    mockPost.mockResolvedValue({ data: { success: true } });
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.markCelebrated('m1');
      await result.current.markCelebrated('m1'); // a second call is a no-op
    });
    expect(result.current.pendingCelebrations).toEqual([]);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/milestones/m1/celebrated');
    expect(JSON.parse(mockStorage.get(milestoneCacheKey('user-1', 'a1'))!).pendingCelebrated).toEqual([]);
  });

  it('keeps the receipt for retry when the network drops, and never re-queues the celebration', async () => {
    mockGet.mockResolvedValue(server([rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z')]));
    mockPost.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.markCelebrated('m1');
    });
    expect(result.current.pendingCelebrations).toEqual([]);
    expect(JSON.parse(mockStorage.get(milestoneCacheKey('user-1', 'a1'))!).pendingCelebrated).toEqual(['m1']);

    // A later read that predates the receipt must not bring the celebration back.
    mockPost.mockResolvedValue({ data: { success: true } });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.pendingCelebrations).toEqual([]);
    await waitFor(() =>
      expect(JSON.parse(mockStorage.get(milestoneCacheKey('user-1', 'a1'))!).pendingCelebrated).toEqual([]),
    );
  });

  it('ignores another account’s cached record', async () => {
    mockStorage.set(
      milestoneCacheKey('user-1', 'a1'),
      serializeMilestoneCache({
        schemaVersion: 1,
        accountId: 'someone-else',
        anchorId: 'a1',
        records: [rec('m1', 'strength.building', '2026-10-01T00:00:00Z')],
        pendingCelebrated: [],
      }),
    );
    mockGet.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAnchorMilestones('a1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.records).toEqual([]);
  });

  it('does nothing without an Anchor', () => {
    const { result } = renderHook(() => useAnchorMilestones(null));
    expect(result.current.records).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
