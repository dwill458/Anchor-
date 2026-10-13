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

describe('AuthHydrationService senior review regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
  });

  it('eventually accepts a valid server revision when the local updatedAt is missing', async () => {
    const user = createMockUser({ id: 'review-missing-ts-user', totalAnchorsCreated: 1 });
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const local = {
      ...createMockAnchor({
        id,
        userId: user.id,
        intentionText: 'Local record with no ordering timestamp',
      }),
      updatedAt: undefined as unknown as Date,
    };
    const firstServerRevision = createMockAnchor({
      id,
      userId: user.id,
      intentionText: 'First server revision',
      updatedAt: new Date('2026-10-12T10:00:00.000Z'),
    });
    const latestServerRevision = createMockAnchor({
      id,
      userId: user.id,
      intentionText: 'Latest server revision',
      updatedAt: new Date('2026-10-13T10:00:00.000Z'),
    });

    setAccount(user, 'review-missing-token');
    useAnchorStore.getState().setAnchors([local]);
    setSuccessfulHydrationResponses(user, () => [firstServerRevision]);
    await AuthHydrationService.hydrateAuthenticatedData();

    setSuccessfulHydrationResponses(user, () => [latestServerRevision]);
    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().getAnchorById(id)?.intentionText).toBe(
      'Latest server revision',
    );
  });

  it('collapses duplicate backend IDs even when their local IDs differ', async () => {
    const user = createMockUser({ id: 'review-duplicate-user', totalAnchorsCreated: 2 });
    const backendId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const first = createMockAnchor({
      id: backendId,
      localId: 'local-copy-one',
      userId: user.id,
      intentionText: 'First copy',
    });
    const duplicate = createMockAnchor({
      id: backendId,
      localId: 'local-copy-two',
      userId: user.id,
      intentionText: 'Duplicate copy',
    });

    setAccount(user, 'review-duplicate-token');
    setSuccessfulHydrationResponses(user, () => [first, duplicate]);
    await AuthHydrationService.hydrateAuthenticatedData();

    expect(
      useAnchorStore.getState().anchors.filter((anchor) => anchor.id === backendId),
    ).toHaveLength(1);
  });

  it('invalidates an in-flight A hydration after an A to B to A account transition', async () => {
    const userA = createMockUser({ id: 'review-a-b-a-user-a', totalAnchorsCreated: 1 });
    const userB = createMockUser({ id: 'review-a-b-a-user-b', totalAnchorsCreated: 1 });
    const staleAnchorA = createMockAnchor({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      userId: userA.id,
      intentionText: 'Response from the first A session',
    });
    let resolveFirstAnchors: ((value: unknown) => void) | undefined;
    const firstAnchors = new Promise((resolve) => {
      resolveFirstAnchors = resolve;
    });

    setAccount(userA, 'reused-token-a');
    mockFetchCompleteProfile.mockResolvedValue({ user: userA, stats: {}, activeAnchors: [] });
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/anchors') return firstAnchors;
      if (url === '/api/auth/me/export') {
        return Promise.resolve({
          data: {
            data: {
              exportVersion: 2,
              account: { id: userA.id, anchors: [staleAnchorA], activations: [], charges: [] },
              burnedAnchors: [],
            },
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const staleHydration = AuthHydrationService.hydrateAuthenticatedData();
    useAuthStore.getState().setSession(userB, 'token-b');
    useAuthStore.getState().setSession(userA, 'reused-token-a');
    resolveFirstAnchors?.({ data: { data: [staleAnchorA] } });
    await staleHydration;

    expect(useAnchorStore.getState().anchors).toEqual([]);
  });
});
