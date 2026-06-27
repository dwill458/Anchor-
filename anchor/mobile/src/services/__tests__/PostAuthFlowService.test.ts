import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const mockMigrateAnchors = jest.fn();
const mockLogIn = jest.fn();
const mockRefreshTrialStatus = jest.fn();
const mockHydrateAuthenticatedData = jest.fn();
const mockFinalizePendingFirstAnchorDraft = jest.fn();

jest.mock('@/services/AnchorSyncService', () => ({
  __esModule: true,
  default: {
    isConfigured: jest.fn(() => true),
    migrateAnchors: (...args: unknown[]) => mockMigrateAnchors(...args),
    flushRetryQueue: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    logIn: (...args: unknown[]) => mockLogIn(...args),
    refreshTrialStatus: (...args: unknown[]) => mockRefreshTrialStatus(...args),
  },
}));

jest.mock('@/services/AuthHydrationService', () => ({
  __esModule: true,
  default: {
    hydrateAuthenticatedData: (...args: unknown[]) => mockHydrateAuthenticatedData(...args),
  },
}));

import PostAuthFlowService from '../PostAuthFlowService';

describe('PostAuthFlowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAnchorStore.getState().clearAnchors();
    useSubscriptionStore.setState({
      trialStartDate: null,
      subscriptionStatus: 'trial',
    });
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
      finalizePendingFirstAnchorDraft: mockFinalizePendingFirstAnchorDraft,
    } as any);

    mockFinalizePendingFirstAnchorDraft.mockResolvedValue(true);
  });

  it('migrates all local anchors during post-auth setup', async () => {
    const user = createMockUser({ id: 'user-123' });
    const localAnchor = createMockAnchor({ id: 'local-anchor', userId: 'user-123' });
    const foreignAnchor = createMockAnchor({ id: 'foreign-anchor', userId: 'user-other' });

    useAnchorStore.getState().setAnchors([localAnchor, foreignAnchor]);

    mockLogIn.mockResolvedValue({ hasActiveEntitlement: true });
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: true });
    mockMigrateAnchors.mockImplementation(async (anchors: unknown[]) => anchors);
    mockHydrateAuthenticatedData.mockResolvedValue(undefined);

    await PostAuthFlowService.run({
      user,
      token: 'token-123',
      preserveCompletedOnboarding: false,
    });

    expect(mockMigrateAnchors).toHaveBeenCalledTimes(1);
    expect(mockHydrateAuthenticatedData).toHaveBeenCalledWith({
      skipAnchorRefresh: false,
    });
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

  it('finalizes a pending first anchor draft before leaving post-auth setup', async () => {
    const user = createMockUser({ id: 'user-123' });

    useAuthStore.setState({
      pendingFirstAnchorDraft: {
        tempAnchorId: 'pending-first-anchor-1',
        source: 'onboarding_first_anchor',
        requiresAccountGate: false,
        createdAt: new Date('2026-05-18T08:00:00.000Z'),
      },
    } as any);

    mockLogIn.mockResolvedValue({ hasActiveEntitlement: true });
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: true });
    mockMigrateAnchors.mockResolvedValue([]);
    mockHydrateAuthenticatedData.mockResolvedValue(undefined);
    mockFinalizePendingFirstAnchorDraft.mockResolvedValue(true);

    await PostAuthFlowService.run({
      user,
      token: 'token-123',
      preserveCompletedOnboarding: false,
    });

    expect(mockHydrateAuthenticatedData).toHaveBeenNthCalledWith(1, {
      skipAnchorRefresh: true,
    });
    expect(mockFinalizePendingFirstAnchorDraft).toHaveBeenCalledTimes(1);
    expect(mockHydrateAuthenticatedData).toHaveBeenNthCalledWith(2, {
      skipAnchorRefresh: false,
    });
  });

  it('syncs the local trial timer from the server user payload during post-auth setup', async () => {
    const trialStartedAt = new Date('2026-06-20T00:00:00.000Z');
    const user = createMockUser({
      id: 'user-123',
      trialStartedAt,
      isTrialExpired: false,
    });

    mockLogIn.mockResolvedValue({ hasActiveEntitlement: false });
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: false });
    mockMigrateAnchors.mockResolvedValue([]);
    mockHydrateAuthenticatedData.mockResolvedValue(undefined);

    await PostAuthFlowService.run({
      user,
      token: 'token-123',
      preserveCompletedOnboarding: false,
    });

    expect(useSubscriptionStore.getState().trialStartDate).toBe(trialStartedAt.toISOString());
    expect(useSubscriptionStore.getState().subscriptionStatus).toBe('trial');
  });
});
