import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';

const mockApiGet = jest.fn();
const mockFetchCompleteProfile = jest.fn();

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  fetchCompleteProfile: (...args: unknown[]) => mockFetchCompleteProfile(...args),
}));

import AuthHydrationService from '../AuthHydrationService';

describe('AuthHydrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAnchorStore.getState().clearAnchors();
    useSessionStore.setState({
      lastSession: null,
      todayPractice: { date: '2026-05-18', sessionsCount: 0, totalSeconds: 0 },
      weeklyPractice: { weekKey: '2026-W21', sessionsCount: 0, totalSeconds: 0 },
      lastGraceDayUsedAt: null,
      sessionLog: [],
      threadStrength: 50,
      totalSessionsCount: 0,
      lastPrimedAt: null,
      weekHistory: [false, false, false, false, false, false, false],
      weekHistoryKey: '2026-W21',
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
  });

  it('preserves unsynced local temp anchors during authenticated hydration', async () => {
    const localTempAnchor = createMockAnchor({
      id: 'anchor-1779092632674',
      updatedAt: new Date('2026-05-18T08:00:00.000Z'),
    });
    const remoteAnchor = createMockAnchor({
      id: 'server-anchor-1',
      updatedAt: new Date('2026-05-18T08:10:00.000Z'),
    });
    const activatedAt = new Date().toISOString();

    useAnchorStore.getState().setAnchors([localTempAnchor]);

    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/api/anchors') {
        return {
          data: {
            data: [remoteAnchor],
          },
        };
      }

      if (url === '/api/auth/me/export') {
        return {
          data: {
            data: {
              account: {
                activations: [
                  {
                    id: 'activation-1',
                    anchorId: remoteAnchor.id,
                    activationType: 'visual',
                    durationSeconds: 30,
                    activatedAt,
                  },
                ],
              },
            },
          },
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });
    mockFetchCompleteProfile.mockResolvedValue({
      user: createMockUser(),
      stats: {},
      activeAnchors: [],
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'server-anchor-1' }),
        expect.objectContaining({ id: 'anchor-1779092632674' }),
      ])
    );
    expect(useSessionStore.getState().primingHistory).toHaveLength(1);
    expect(useSessionStore.getState().lastPrimedAt).toBe(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    );
    expect(useSessionStore.getState().weekHistory.some(Boolean)).toBe(true);
  });
});
