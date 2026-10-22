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
    purchaseDefaultTrialPackage: jest.fn(),
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
  it('preserves additions and edits made while same-account migration is in flight', async () => {
    const user = createMockUser({ id: 'user-a' });
    const oldAnchor = createMockAnchor({ id: 'local-a', userId: user.id });
    useAnchorStore.getState().setAnchors([oldAnchor]);
    mockLogIn.mockResolvedValue(undefined);
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: true });
    mockHydrateAuthenticatedData.mockResolvedValue(undefined);
    let resolveMigration!: (anchors: unknown[]) => void;
    mockMigrateAnchors.mockImplementation(() => new Promise((resolve) => { resolveMigration = resolve; }));
    const pending = PostAuthFlowService.run({ user, token: 'token-a', preserveCompletedOnboarding: false });
    await new Promise((resolve) => setImmediate(resolve));
    const edited = { ...oldAnchor, intentionText: 'SYNTHETIC NEW EDIT', updatedAt: new Date() };
    const added = createMockAnchor({ id: 'local-new', userId: user.id });
    useAnchorStore.getState().setAnchors([edited, added]);
    resolveMigration([oldAnchor]);
    await pending;
    expect(useAnchorStore.getState().getAnchorById(oldAnchor.id)?.intentionText).toBe('SYNTHETIC NEW EDIT');
    expect(useAnchorStore.getState().getAnchorById(added.id)).toBeDefined();
  });

  it('cannot commit A migration into B after the account changes in flight', async () => {
    const userA = createMockUser({ id: 'user-a' });
    const userB = createMockUser({ id: 'user-b' });
    const anchorA = createMockAnchor({ id: 'local-a', userId: userA.id });
    const anchorB = createMockAnchor({ id: 'local-b', userId: userB.id });
    useAnchorStore.getState().setAnchors([anchorA]);
    mockLogIn.mockResolvedValue(undefined);
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: true });
    let resolveMigration!: (anchors: unknown[]) => void;
    mockMigrateAnchors.mockImplementation(() => new Promise((resolve) => { resolveMigration = resolve; }));
    const pending = PostAuthFlowService.run({ user: userA, token: 'token-a', preserveCompletedOnboarding: false });
    const rejected = expect(pending).rejects.toThrow('Authentication context changed');
    await new Promise((resolve) => setImmediate(resolve));
    useAuthStore.getState().setSession(userB, 'token-b');
    useAnchorStore.getState().setAnchors([anchorB]);
    resolveMigration([anchorA]);
    await rejected;
    expect(useAnchorStore.getState().anchors).toEqual([anchorB]);
    expect(mockHydrateAuthenticatedData).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    useAnchorStore.getState().clearAnchors();
    useSubscriptionStore.setState({
      trialStartDate: null,
      subscriptionStatus: 'expired',
      rcSynced: false,
      hasActiveEntitlement: false,
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

  it('migrates only the authenticated owners local anchors during post-auth setup', async () => {
    const trialStartedAt = new Date().toISOString();
    const user = createMockUser({
      id: 'user-123',
      createdAt: new Date(trialStartedAt),
      trialStartedAt,
      isTrialExpired: false,
    });
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
      launchTrialPurchase: false,
    });

    expect(mockMigrateAnchors).toHaveBeenCalledTimes(1);
    expect(useSubscriptionStore.getState().subscriptionStatus).toBe('expired');
    expect(useSubscriptionStore.getState().trialStartDate).toBeNull();
    expect(mockHydrateAuthenticatedData).toHaveBeenCalledWith({
      skipAnchorRefresh: false,
    });
    expect(mockMigrateAnchors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-anchor', userId: 'user-123' }),
      ]),
      'user-123'
    );
    expect(useAnchorStore.getState().anchors).toHaveLength(1);
    expect(useAnchorStore.getState().partitions['account:user-other'].anchors).toEqual([foreignAnchor]);
    expect(mockMigrateAnchors.mock.calls[0][0]).not.toContainEqual(foreignAnchor);
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
      launchTrialPurchase: false,
    });

    expect(mockHydrateAuthenticatedData).toHaveBeenNthCalledWith(1, {
      skipAnchorRefresh: true,
    });
    expect(mockFinalizePendingFirstAnchorDraft).toHaveBeenCalledTimes(1);
    expect(mockHydrateAuthenticatedData).toHaveBeenNthCalledWith(2, {
      skipAnchorRefresh: false,
    });
  });

  it('rejects post-auth finalization with CREATE_ANCHOR_FREE_LOCKED if unentitled user already created an anchor', async () => {
    const user = createMockUser({
      id: 'locked-user',
      totalAnchorsCreated: 1,
      freeAnchorConsumed: true,
    });
    const localDraft = createMockAnchor({ id: 'temp-local-1', userId: 'guest' });

    useAnchorStore.getState().setAnchors([localDraft]);
    useAuthStore.setState({
      pendingFirstAnchorDraft: {
        tempAnchorId: 'temp-local-1',
        source: 'onboarding_first_anchor',
        requiresAccountGate: false,
        createdAt: new Date('2026-05-18T08:00:00.000Z'),
      },
    } as any);

    mockLogIn.mockResolvedValue({ hasActiveEntitlement: false });
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: false });
    mockMigrateAnchors.mockResolvedValue([]);
    mockHydrateAuthenticatedData.mockResolvedValue(undefined);

    await expect(
      PostAuthFlowService.run({
        user,
        token: 'token-123',
        preserveCompletedOnboarding: false,
        launchTrialPurchase: false,
      })
    ).rejects.toThrow('CREATE_ANCHOR_FREE_LOCKED');

    // Unconfirmed local drafts must NOT be migrated to backend sync
    expect(mockMigrateAnchors).toHaveBeenCalledWith([], 'locked-user');
    // Must NOT call finalize
    expect(mockFinalizePendingFirstAnchorDraft).not.toHaveBeenCalled();
    // But local anchor is preserved in memory for paywall finalization
    expect(useAnchorStore.getState().anchors).toEqual([localDraft]);
  });

  it('allows comped and legacy-migration accounts to finalize a pending draft even when RevenueCat reports no active entitlement', async () => {
    const compedUser = createMockUser({
      id: 'comped-user',
      isComped: true,
      totalAnchorsCreated: 2,
      freeAnchorConsumed: true,
    });
    const localDraft = createMockAnchor({ id: 'temp-comped-1', userId: 'guest' });

    useAnchorStore.getState().setAnchors([localDraft]);
    useAuthStore.setState({
      pendingFirstAnchorDraft: {
        tempAnchorId: 'temp-comped-1',
        source: 'onboarding_first_anchor',
        requiresAccountGate: false,
        createdAt: new Date('2026-05-18T08:00:00.000Z'),
      },
    } as any);

    mockLogIn.mockResolvedValue({ hasActiveEntitlement: false });
    mockRefreshTrialStatus.mockResolvedValue({ hasActiveEntitlement: false });
    mockMigrateAnchors.mockImplementation(async (anchors: unknown[]) => anchors);
    mockHydrateAuthenticatedData.mockResolvedValue(undefined);
    mockFinalizePendingFirstAnchorDraft.mockResolvedValue(true);

    const result = await PostAuthFlowService.run({
      user: compedUser,
      token: 'token-comped',
      preserveCompletedOnboarding: true,
      launchTrialPurchase: false,
    });

    expect(result.hasActiveEntitlement).toBe(true);
    expect(mockFinalizePendingFirstAnchorDraft).toHaveBeenCalledTimes(1);
  });
});
