import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';

const mockMigrateAnchors = jest.fn();
const mockLogIn = jest.fn();
const mockRefreshTrialStatus = jest.fn();

jest.mock('@/services/AnchorSyncService', () => ({
  __esModule: true,
  default: {
    migrateAnchors: (...args: unknown[]) => mockMigrateAnchors(...args),
    flushRetryQueue: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    logIn: (...args: unknown[]) => mockLogIn(...args),
    refreshTrialStatus: (...args: unknown[]) => mockRefreshTrialStatus(...args),
    purchaseDefaultTrialPackage: jest.fn(),
  },
}));

import PostAuthFlowService from '../PostAuthFlowService';

describe('PostAuthFlowService', () => {
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

  it('migrates all local anchors during post-auth setup', async () => {
    const user = createMockUser({ id: 'user-123' });
    const localAnchor = createMockAnchor({ id: 'local-anchor', userId: 'user-123' });
    const foreignAnchor = createMockAnchor({ id: 'foreign-anchor', userId: 'user-other' });

    useAnchorStore.getState().setAnchors([localAnchor, foreignAnchor]);

    mockLogIn.mockResolvedValue({ hasActiveEntitlement: true });
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: true });
    mockMigrateAnchors.mockImplementation(async (anchors: unknown[]) => anchors);

    await PostAuthFlowService.run({
      user,
      token: 'token-123',
      preserveCompletedOnboarding: false,
      launchTrialPurchase: false,
    });

    expect(mockMigrateAnchors).toHaveBeenCalledTimes(1);
    expect(mockMigrateAnchors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-anchor', userId: 'user-123' }),
        expect.objectContaining({ id: 'foreign-anchor', userId: 'user-other' }),
      ]),
      'user-123'
    );
    expect(useAnchorStore.getState().anchors).toHaveLength(2);
    expect(useAuthStore.getState().user?.id).toBe('user-123');
  });
});
