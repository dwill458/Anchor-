const mockPost = jest.fn();
const mockAuth = { user: { id: 'u' }, token: 'token', accountRevision: 1 };
const mockStorage = new Map<string, string>();
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { post: (...args: unknown[]) => mockPost(...args) } }));
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
} }));
import { queueMilestoneAction } from '../queueMilestoneAction';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { getSnapshot, resetMilestoneSnapshots, settleMilestone } from '../milestoneSnapshots';
const record = { id: 'm', anchorId: 'a', definitionId: 'vision.first', definitionVersion: 1, earnedAt: new Date().toISOString(), sourceKind: 'VISION_COMMIT', sourceEntityId: 'v', metadata: {}, celebratedAt: null };
const reservation = () => ({ data: { data: { presentation: { presentationId: 'reservation', expiresAt: new Date(Date.now() + 90000).toISOString(), record } } } });
beforeEach(() => {
  jest.clearAllMocks(); mockStorage.clear(); resetMilestoneSnapshots();
  useMilestoneCelebrationStore.getState().reset(); mockAuth.accountRevision = 1;
  mockPost.mockResolvedValue(reservation());
});
it('queues only a server-reserved featured award and caches earned truth', async () => {
  await queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' });
  expect(mockPost).toHaveBeenCalledWith('/api/v2/anchors/a/milestone-celebration', { kind: 'vision', sourceEntityId: 'v' }, expect.objectContaining({ anchorAuthToken: 'token' }));
  expect(useMilestoneCelebrationStore.getState().queue).toHaveLength(1);
  expect(getSnapshot('u', 'a')?.records[0].id).toBe('m');
});
it('does nothing when historical reconciliation has no featured reservation', async () => {
  mockPost.mockResolvedValue({ data: { data: { presentation: null } } });
  await queueMilestoneAction('a', { kind: 'practice', sourceEntityId: 'p' });
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
});
it('ignores delayed confirmation after the originating screen unmounts', async () => {
  let active = true;
  mockPost.mockImplementation(async () => { active = false; return reservation(); });
  await queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' }, () => active);
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
});
it('does not interrupt unrelated navigation after an eight-second response delay', async () => {
  const start = Date.now(); const spy = jest.spyOn(Date, 'now').mockReturnValue(start);
  mockPost.mockImplementation(async () => { spy.mockReturnValue(start + 8001); return reservation(); });
  await queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' });
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]); spy.mockRestore();
});
it('discards responses after an account revision changes', async () => {
  mockPost.mockImplementation(async () => { mockAuth.accountRevision = 2; return reservation(); });
  await queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' });
  expect(getSnapshot('u', 'a')).toBeNull();
});
it('does not queue expired or mismatched-anchor responses', async () => {
  const response = reservation(); response.data.data.presentation.expiresAt = new Date(0).toISOString();
  mockPost.mockResolvedValue(response);
  await queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' });
  await queueMilestoneAction('other', { kind: 'vision', sourceEntityId: 'v' });
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
});
it('sends the reservation receipt only after actual completion', async () => {
  await queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' });
  expect(mockPost).toHaveBeenCalledTimes(1);
  const known = getSnapshot('u', 'a')!.records[0];
  await settleMilestone('u', known);
  expect(mockPost).toHaveBeenLastCalledWith('/api/v2/milestones/m/celebrated', { presentationId: 'reservation' }, expect.objectContaining({ anchorAuthToken: 'token' }));
});
it('keeps awards available when the optional celebration request fails', async () => {
  mockPost.mockRejectedValue(new Error('offline'));
  await expect(queueMilestoneAction('a', { kind: 'vision', sourceEntityId: 'v' })).resolves.toBeUndefined();
  expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
});
