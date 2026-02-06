import SyncService from '../SyncService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor, ProfileData, User } from '@/types';
import { get, fetchCompleteProfile } from '@/services/ApiClient';

jest.mock('@/services/ApiClient', () => ({
  get: jest.fn(),
  fetchCompleteProfile: jest.fn(),
}));

const createAnchor = (overrides?: Partial<Anchor>): Anchor => ({
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Local anchor',
  category: 'career',
  distilledLetters: ['L'],
  baseSigilSvg: '<svg />',
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  ...overrides,
});

const createUser = (overrides?: Partial<User>): User => ({
  id: 'user-1',
  email: 'user@example.com',
  subscriptionStatus: 'free',
  totalAnchorsCreated: 1,
  totalActivations: 2,
  currentStreak: 1,
  longestStreak: 2,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

const createProfileData = (): ProfileData => ({
  user: createUser(),
  stats: {
    totalAnchorsCreated: 1,
    totalCharged: 0,
    totalActivations: 2,
    currentStreak: 1,
    longestStreak: 2,
  },
  activeAnchors: [
    {
      id: 'anchor-1',
      displayLabel: 'Career Anchor',
      category: 'career',
      isCharged: false,
      activationCount: 0,
      baseSigilSvg: '<svg />',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ],
});

describe('SyncService', () => {
  beforeEach(() => {
    useAnchorStore.setState({
      anchors: [],
      isLoading: false,
      error: null,
      lastSyncedAt: null,
    });

    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
      onboardingSegment: null,
      shouldRedirectToCreation: false,
      anchorCount: 0,
      profileData: null,
      profileLastFetched: null,
    });

    SyncService.setMockConfig({ enabled: false, anchors: [], profile: null });
    jest.clearAllMocks();
  });

  it('merges remote anchors into local state', async () => {
    const localAnchor = createAnchor({
      id: 'anchor-1',
      intentionText: 'Local anchor',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const remoteAnchor = createAnchor({
      id: 'anchor-1',
      intentionText: 'Remote anchor',
      updatedAt: new Date('2024-01-03T00:00:00.000Z'),
    });

    useAnchorStore.setState({
      anchors: [localAnchor],
      isLoading: false,
      error: null,
      lastSyncedAt: null,
    });

    (get as jest.Mock).mockResolvedValue({
      success: true,
      data: [remoteAnchor],
    });

    await SyncService.syncAnchors();

    const anchors = useAnchorStore.getState().anchors;
    expect(anchors).toHaveLength(1);
    expect(anchors[0].intentionText).toBe('Remote anchor');
  });

  it('syncs user profile data', async () => {
    const profile = createProfileData();

    (fetchCompleteProfile as jest.Mock).mockResolvedValue(profile);

    await SyncService.syncUserProfile();

    const authState = useAuthStore.getState();
    expect(authState.profileData?.user.id).toBe('user-1');
    expect(authState.profileData?.stats.totalAnchorsCreated).toBe(1);
  });
});
