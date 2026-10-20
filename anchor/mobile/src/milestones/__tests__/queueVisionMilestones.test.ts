const mockStorage = new Map<string, string>();
const mockGet = jest.fn(), mockPost = jest.fn();
const mockAuth = { user: { id: 'u' }, accountRevision: 1, token: 'token' };
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) } }));
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
} }));
import { queueVisionMilestones } from '../queueVisionMilestones';
import { applyServerRecords, getSnapshot, resetMilestoneSnapshots, settleMilestone } from '../milestoneSnapshots';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import type { MilestoneRecord } from '../milestoneModel';

const record: MilestoneRecord = { id: 'm', anchorId: 'a', definitionId: 'vision.first', definitionVersion: 1, earnedAt: '2026-10-20T10:00:00Z', sourceKind: 'VISION_COMMIT', sourceEntityId: 'v', metadata: {}, celebratedAt: null };
beforeEach(() => {
  jest.clearAllMocks(); mockStorage.clear(); resetMilestoneSnapshots();
  useMilestoneCelebrationStore.getState().reset(); mockAuth.accountRevision = 1;
  mockGet.mockResolvedValue({ data: { data: { milestones: [record] } } });
  mockPost.mockResolvedValue({});
});

it('restores an offline receipt after restart before merging stale server records', async () => {
  applyServerRecords('u', 'a', [record]);
  mockPost.mockRejectedValueOnce(new Error('offline'));
  await settleMilestone('u', record);
  resetMilestoneSnapshots(); // process restart; encrypted storage survives
  await queueVisionMilestones('a');
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
  expect(getSnapshot('u', 'a')?.records[0].celebratedAt).toBeTruthy();
  expect(mockPost).toHaveBeenLastCalledWith('/api/v2/milestones/m/celebrated');
});

it('queues the authoritative persisted award once after board completion', async () => {
  await queueVisionMilestones('a'); await queueVisionMilestones('a');
  expect(useMilestoneCelebrationStore.getState().queue.map(item => item.record.id)).toEqual(['m']);
});

it('discards a response after an account revision changes', async () => {
  mockGet.mockImplementation(async () => { mockAuth.accountRevision = 2; return { data: { data: { milestones: [record] } } }; });
  await queueVisionMilestones('a');
  expect(getSnapshot('u', 'a')).toBeNull();
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
});
