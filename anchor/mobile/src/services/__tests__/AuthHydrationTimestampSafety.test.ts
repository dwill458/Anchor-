import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';

const mockApiGet = jest.fn();
const mockFetchCompleteProfile = jest.fn();

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockApiGet(...args) },
  fetchCompleteProfile: (...args: unknown[]) => mockFetchCompleteProfile(...args),
}));

import AuthHydrationService from '../AuthHydrationService';
import AnchorSyncService from '../AnchorSyncService';

function resetStores(): void {
  useAnchorStore.getState().clearAnchors();
  useProfileStore.getState().resetProfile();
  useSessionStore.setState({
    lastSession: null,
    todayPractice: { date: '2026-10-13', sessionsCount: 0, totalSeconds: 0 },
    weeklyPractice: { weekKey: '2026-W42', sessionsCount: 0, totalSeconds: 0 },
    lastGraceDayUsedAt: null,
    sessionLog: [],
    threadStrength: 50,
    totalSessionsCount: 0,
    lastPrimedAt: null,
    weekHistory: [false, false, false, false, false, false, false],
    weekHistoryKey: '2026-W42',
    primingHistory: [],
    journeyWeekStart: null,
    lastDecayDate: null,
  } as any);
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    hasCompletedOnboarding: false,
    profileData: null,
    profileLastFetched: null,
    pendingFirstAnchorDraft: null,
    pendingFirstAnchorMutations: [],
    isFinalizingPendingFirstAnchor: false,
    pendingFirstAnchorError: null,
    isOfflineMode: false,
  } as any);
  useSettingsStore.setState({
    focusSessionMode: 'quick',
    focusSessionDuration: 30,
    focusSessionAudio: 'silent',
    primeSessionDuration: 120,
    primeSessionAudio: 'silent',
    sessionAudioDefaults: {
      focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    },
    sessionAudioDefaultsOwnerUserId: null,
    sessionAudioDefaultsOwnerInitialized: false,
    sessionAudioDefaultsUpdatedAt: null,
  } as any);
}

function setAccount(user: ReturnType<typeof createMockUser>, token: string): void {
  useAuthStore.setState({ user, token, isAuthenticated: true } as any);
}

function setSuccessfulHydrationResponses(
  user: ReturnType<typeof createMockUser>,
  getAnchors: () => ReturnType<typeof createMockAnchor>[],
): void {
  mockFetchCompleteProfile.mockResolvedValue({ user, stats: {}, activeAnchors: [] });
  mockApiGet.mockImplementation(async (url: string) => {
    if (url === '/api/anchors') return { data: { data: getAnchors() } };
    if (url === '/api/auth/me/export') {
      return {
        data: {
          data: {
            exportVersion: 2,
            account: { id: user.id, anchors: getAnchors(), activations: [], charges: [] },
            burnedAnchors: [],
          },
        },
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}


describe('missing timestamp reconciliation safety', () => {
  const user = createMockUser({ id: 'synthetic-timestamp-owner', totalAnchorsCreated: 1 });
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const local = () => ({ ...createMockAnchor({ id, userId: user.id, intentionText: 'Unsynced local writing', activationCount: 4 }), updatedAt: undefined as unknown as Date });
  const remote = (day: number) => createMockAnchor({ id, userId: user.id, intentionText: 'Server ' + day, updatedAt: new Date('2026-10-' + day + 'T10:00:00Z') });
  beforeEach(() => { jest.clearAllMocks(); resetStores(); setAccount(user, 'synthetic-timestamp-token'); useAnchorStore.getState().setAnchors([local()]); });
  it('retains the original private record after adopting a later server revision and JSON reload', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Unsynced local writing');
    useAnchorStore.getState().setAnchors(JSON.parse(JSON.stringify(useAnchorStore.getState().anchors)));
    setSuccessfulHydrationResponses(user, () => [remote(13)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Server 13');
    useAnchorStore.getState().setAnchors(JSON.parse(JSON.stringify(useAnchorStore.getState().anchors)));
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(id)).toEqual(expect.objectContaining({id, userId:user.id, intentionText:'Unsynced local writing', activationCount:4}));
  });
  it('repeated reads of the same server revision never count as synchronization', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Unsynced local writing');
  });
  it('a known local mutation prevents later server revisions from replacing it after JSON reload', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAnchorStore.getState().updateAnchor(id, { intentionText:'New pending edit', updatedAt:undefined as unknown as Date });
    useAnchorStore.getState().setAnchors(JSON.parse(JSON.stringify(useAnchorStore.getState().anchors)));
    setSuccessfulHydrationResponses(user, () => [remote(13)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('New pending edit');
  });
  it('account B cannot retrieve account A recovery writing', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAuthStore.getState().setSession(createMockUser({id:'synthetic-timestamp-b'}),'synthetic-b');
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(id)).toBeUndefined();
    useAuthStore.getState().setSession(user,'synthetic-timestamp-token');
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(id)?.intentionText).toBe('Unsynced local writing');
  });
  it('protects changed legacy content even when a caller bypassed updateAnchor', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAnchorStore.getState().setAnchors(useAnchorStore.getState().anchors.map(
      (anchor) => ({ ...anchor, intentionText: 'Changed legacy content' }),
    ));
    setSuccessfulHydrationResponses(user, () => [remote(13)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    setSuccessfulHydrationResponses(user, () => [remote(14)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Changed legacy content');
  });
  it('a sync acknowledgement clears the pending edit without deleting the recovery copy', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAnchorStore.getState().updateAnchor(id, { intentionText: 'Acknowledged edit' });
    useAnchorStore.getState().applySyncedAnchor(id, { ...remote(13), intentionText:'Acknowledged edit' });
    setSuccessfulHydrationResponses(user, () => [remote(14)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Server 14');
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(id)?.intentionText).toBe('Unsynced local writing');
  });
  it('a stale acknowledgement cannot erase a newer pending edit or clear its protection', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAnchorStore.getState().updateAnchor(id, { intentionText: 'Edit sent to server' });
    useAnchorStore.getState().updateAnchor(id, { intentionText: 'Newer unsynced edit' });
    useAnchorStore.getState().applySyncedAnchor(id, { ...remote(13), intentionText: 'Edit sent to server' });
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Newer unsynced edit');
    expect(useAnchorStore.getState().getAnchorById(id)?.localReconciliation?.pendingLocalMutation).toBe(true);
    setSuccessfulHydrationResponses(user, () => [remote(14)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('Newer unsynced edit');
  });
  it('a stale queued retry cannot erase pending writing', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAnchorStore.getState().updateAnchor(id, { intentionText: 'New pending writing' });
    const configured = jest.spyOn(AnchorSyncService, 'isConfigured').mockReturnValue(true);
    const retry = jest.spyOn(AnchorSyncService, 'flushRetryQueue').mockResolvedValue([remote(13)]);
    try {
      await useAnchorStore.getState().flushPendingSync();
      expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe('New pending writing');
      expect(useAnchorStore.getState().getAnchorById(id)?.localReconciliation?.pendingLocalMutation).toBe(true);
    } finally {
      configured.mockRestore();
      retry.mockRestore();
    }
  });
  it('accepts a server null acknowledgement for a cleared optional field', async () => {
    setSuccessfulHydrationResponses(user, () => [remote(12)]);
    await AuthHydrationService.hydrateAuthenticatedData();
    useAnchorStore.getState().updateAnchor(id, { mantraText: undefined });
    useAnchorStore.getState().applySyncedAnchor(id, { ...remote(13), mantraText: null as unknown as string });
    expect(useAnchorStore.getState().getAnchorById(id)?.localReconciliation?.pendingLocalMutation).toBeFalsy();
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(id)?.intentionText).toBe('Unsynced local writing');
  });
});
