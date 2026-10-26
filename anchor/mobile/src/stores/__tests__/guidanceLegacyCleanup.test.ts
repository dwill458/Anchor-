import { useTeachingStore } from '../teachingStore';
import { useAnchorStore } from '../anchorStore';
import { useSessionStore } from '../sessionStore';
import { createMockAnchor } from '@/__tests__/utils/testUtils';
import { getTeachingSeen, setTeachingSeen, resetAllTeachingSeen } from '@/hooks/v2/teaching/teachingSeen';
let mockV2Enabled = true;
jest.mock('@/config/v2FeatureFlag', () => ({ isAnchorV2Enabled: () => mockV2Enabled }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ token: null, user: null, isGuest: true }) } }));
beforeEach(() => {
  mockV2Enabled = true;
  useTeachingStore.getState().reset();
  useAnchorStore.getState().clearAnchors();
  useSessionStore.getState().reset();
});
it.each([true, false])('keeps legacy flags but queues legacy milestones only outside V2 (%s)', enabled => {
  mockV2Enabled = enabled;
  useAnchorStore.getState().addAnchor(createMockAnchor());
  useSessionStore.getState().recordSession({ anchorId: 'a', type: 'reinforce', durationSeconds: 30, mode: 'silent', completedAt: new Date().toISOString() });
  const state = useTeachingStore.getState();
  expect(state.userFlags.hasCreatedFirstAnchor).toBe(true);
  expect(state.userFlags.hasCompletedFirstCharge).toBe(true);
  expect(state.pendingMilestones).toHaveLength(enabled ? 0 : 2);
});
it('Replay resets teaching records and V2 seen keys while preserving every story flag', async () => {
  const store = useTeachingStore.getState();
  store.setUserFlag('hasSeenFirstAnchorArrival', true);
  store.setUserFlag('hasSeenFirstPracticeScene', true);
  store.setUserFlag('hasTracedBefore', true);
  store.recordShown('old-tip', 'glass_card', 1);
  store.queueMilestone('old-milestone');
  store.recordTraceHintSeen('trace');
  store.exhaustTraceHint('trace');
  const flags = useTeachingStore.getState().userFlags;
  setTeachingSeen('a', 'home.today');
  store.resetTeachingRecords();
  await resetAllTeachingSeen('a');
  expect(useTeachingStore.getState()).toMatchObject({
    showCounts: {}, lastShownAt: {}, exhaustedIds: {}, pendingMilestones: [], lastVeilCardAt: null,
    traceHintSeenCounts: {}, traceHintExhaustedIds: {}, sessionSeenIds: [], sessionSeenPatterns: [], userFlags: flags,
  });
  expect(await getTeachingSeen('a', 'home.today')).toBe(false);
});
it('full reset still clears story flags for account isolation', () => {
  useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', true);
  useTeachingStore.getState().setUserFlag('hasSeenFirstPracticeScene', true);
  useTeachingStore.getState().reset();
  expect(useTeachingStore.getState().userFlags.hasSeenFirstAnchorArrival).toBe(false);
  expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(false);
});
