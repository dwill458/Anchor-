import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';

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

    useAnchorStore.getState().setAnchors([localTempAnchor]);

    mockFetchCompleteProfile.mockResolvedValue({
      user: createMockUser(),
      stats: {},
      activeAnchors: [],
    });
    mockApiGet.mockResolvedValue({
      data: {
        data: [remoteAnchor],
      },
    });

    await AuthHydrationService.hydrateAuthenticatedData();

    expect(useAnchorStore.getState().anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'server-anchor-1' }),
        expect.objectContaining({ id: 'anchor-1779092632674' }),
      ])
    );
  });
});
