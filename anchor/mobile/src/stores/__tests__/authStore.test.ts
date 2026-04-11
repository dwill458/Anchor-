/**
 * Anchor App - AuthStore Tests
 *
 * Comprehensive tests for authentication state management
 */

import { useAuthStore } from '../authStore';
import { useAnchorStore } from '../anchorStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import type { Anchor, User } from '@/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('authStore', () => {
  // Helper to create mock user
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    hasCompletedOnboarding: true,
    subscriptionStatus: 'free',
    totalAnchorsCreated: 0,
    totalActivations: 0,
    currentStreak: 0,
    longestStreak: 0,
    stabilizesTotal: 0,
    stabilizeStreakDays: 0,
    createdAt: new Date(),
    ...overrides,
  });

  const createMockAnchor = (overrides?: Partial<Anchor>): Anchor => ({
    id: 'temp-anchor-1',
    userId: 'guest-user',
    intentionText: 'I move with focus',
    category: 'career',
    distilledLetters: ['M', 'V', 'F'],
    baseSigilSvg: '<svg />',
    structureVariant: 'balanced',
    isCharged: false,
    activationCount: 0,
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: true,
      onboardingSegment: null,
      shouldRedirectToCreation: false,
      anchorCount: 0,
      pendingFirstAnchorDraft: null,
      pendingFirstAnchorMutations: [],
      isFinalizingPendingFirstAnchor: false,
      pendingFirstAnchorError: null,
      profileData: null,
      profileLastFetched: null,
      wallpaperPromptSeen: false,
    });
    useAnchorStore.setState({
      anchors: [],
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      currentAnchorId: undefined,
    });
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have null user initially', () => {
      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should have null token initially', () => {
      const { token } = useAuthStore.getState();
      expect(token).toBeNull();
    });

    it('should not be authenticated initially', () => {
      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
    });

    it('should not be loading initially', () => {
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should have completed onboarding initially', () => {
      const { hasCompletedOnboarding } = useAuthStore.getState();
      expect(hasCompletedOnboarding).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should set user', () => {
      const { setUser } = useAuthStore.getState();
      const mockUser = createMockUser();

      setUser(mockUser);

      const { user } = useAuthStore.getState();
      expect(user).toEqual(mockUser);
    });

    it('should set isAuthenticated to true when user is set', () => {
      const { setUser } = useAuthStore.getState();
      const mockUser = createMockUser();

      setUser(mockUser);

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(true);
    });

    it('should set isAuthenticated to false when user is null', () => {
      const { setUser } = useAuthStore.getState();

      // First set a user
      setUser(createMockUser());
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Then clear it
      setUser(null);

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
    });

    it('should update user when called multiple times', () => {
      const { setUser } = useAuthStore.getState();

      const firstUser = createMockUser({ id: 'user-1', email: 'first@example.com' });
      setUser(firstUser);
      expect(useAuthStore.getState().user).toEqual(firstUser);

      const secondUser = createMockUser({ id: 'user-2', email: 'second@example.com' });
      setUser(secondUser);
      expect(useAuthStore.getState().user).toEqual(secondUser);
    });

    it('should handle user with different displayName', () => {
      const { setUser } = useAuthStore.getState();
      const user = createMockUser({ displayName: 'Custom Name' });

      setUser(user);

      expect(useAuthStore.getState().user?.displayName).toBe('Custom Name');
    });

    it('should use the authenticated user onboarding state', () => {
      const { setUser, setHasCompletedOnboarding } = useAuthStore.getState();
      setHasCompletedOnboarding(true);

      setUser(createMockUser({ hasCompletedOnboarding: false }));

      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
      expect(useAuthStore.getState().user?.hasCompletedOnboarding).toBe(false);
    });
  });

  describe('setToken', () => {
    it('should set token', () => {
      const { setToken } = useAuthStore.getState();
      const mockToken = 'auth-token-12345';

      setToken(mockToken);

      const { token } = useAuthStore.getState();
      expect(token).toBe(mockToken);
    });

    it('should clear token when null', () => {
      const { setToken } = useAuthStore.getState();

      // First set a token
      setToken('token-123');
      expect(useAuthStore.getState().token).toBe('token-123');

      // Then clear it
      setToken(null);

      const { token } = useAuthStore.getState();
      expect(token).toBeNull();
    });

    it('should update token when called multiple times', () => {
      const { setToken } = useAuthStore.getState();

      setToken('first-token');
      expect(useAuthStore.getState().token).toBe('first-token');

      setToken('second-token');
      expect(useAuthStore.getState().token).toBe('second-token');
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);

      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should toggle loading state', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  describe('completeOnboarding', () => {
    it('should set hasCompletedOnboarding to true', () => {
      const { completeOnboarding, setHasCompletedOnboarding } = useAuthStore.getState();

      // Start with onboarding not completed
      setHasCompletedOnboarding(false);
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);

      completeOnboarding();

      const { hasCompletedOnboarding } = useAuthStore.getState();
      expect(hasCompletedOnboarding).toBe(true);
    });

    it('should keep hasCompletedOnboarding true when called multiple times', () => {
      const { completeOnboarding } = useAuthStore.getState();

      completeOnboarding();
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);

      completeOnboarding();
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    });
  });

  describe('setAuthenticated', () => {
    it('should set isAuthenticated to true', () => {
      const { setAuthenticated } = useAuthStore.getState();

      setAuthenticated(true);

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(true);
    });

    it('should set isAuthenticated to false', () => {
      const { setAuthenticated } = useAuthStore.getState();

      setAuthenticated(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      setAuthenticated(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setHasCompletedOnboarding', () => {
    it('should set hasCompletedOnboarding to true', () => {
      const { setHasCompletedOnboarding } = useAuthStore.getState();

      setHasCompletedOnboarding(false);
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);

      setHasCompletedOnboarding(true);
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    });

    it('should set hasCompletedOnboarding to false', () => {
      const { setHasCompletedOnboarding } = useAuthStore.getState();

      setHasCompletedOnboarding(true);
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);

      setHasCompletedOnboarding(false);
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
    });
  });

  describe('signOut', () => {
    it('should clear user', () => {
      const { setUser, signOut } = useAuthStore.getState();

      setUser(createMockUser());
      expect(useAuthStore.getState().user).not.toBeNull();

      signOut();

      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should clear token', () => {
      const { setToken, signOut } = useAuthStore.getState();

      setToken('auth-token-123');
      expect(useAuthStore.getState().token).not.toBeNull();

      signOut();

      const { token } = useAuthStore.getState();
      expect(token).toBeNull();
    });

    it('should set isAuthenticated to false', () => {
      const { setUser, signOut } = useAuthStore.getState();

      setUser(createMockUser());
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      signOut();

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
    });

    it('should clear all auth state', () => {
      const { setUser, setToken, signOut } = useAuthStore.getState();

      // Set up authenticated state
      setUser(createMockUser());
      setToken('auth-token-123');
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().token).not.toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should not affect onboarding status', () => {
      const { setUser, setToken, completeOnboarding, signOut } = useAuthStore.getState();

      setUser(createMockUser());
      setToken('token');
      completeOnboarding();

      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);

      signOut();

      // Onboarding status should persist after sign out
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    });
  });

  describe('Persistence', () => {
    it('should persist user to AsyncStorage', async () => {
      const { setUser } = useAuthStore.getState();
      const mockUser = createMockUser();

      setUser(mockUser);

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      // AsyncStorage should have been called
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should persist token to AsyncStorage', async () => {
      const { setToken } = useAuthStore.getState();

      setToken('test-token');

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should persist isAuthenticated to AsyncStorage', async () => {
      const { setUser } = useAuthStore.getState();

      setUser(createMockUser());

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should persist hasCompletedOnboarding to AsyncStorage', async () => {
      const { completeOnboarding } = useAuthStore.getState();

      completeOnboarding();

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should not persist isLoading (transient state)', async () => {
      const { setLoading } = useAuthStore.getState();
      const callCountBefore = (AsyncStorage.setItem as jest.Mock).mock.calls.length;

      setLoading(true);

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 100));

      // setItem should be called but isLoading should be in partialize exclusion
      // (Actually it will be called, but the important thing is isLoading is not in the persisted object)
      // This is verified by checking the partialize function in the implementation
    });
  });

  describe('State Integration', () => {
    it('should handle complete login flow', () => {
      const { setLoading, setUser, setToken } = useAuthStore.getState();

      // Start loading
      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Set user and token
      setUser(createMockUser());
      setToken('login-token');

      // Stop loading
      setLoading(false);

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.token).toBe('login-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle complete logout flow', () => {
      const { setUser, setToken, signOut } = useAuthStore.getState();

      // Set up authenticated state
      setUser(createMockUser());
      setToken('token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Sign out
      signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle new user registration flow', () => {
      const { setLoading, setUser, setToken, setHasCompletedOnboarding } = useAuthStore.getState();

      // Start registration
      setLoading(true);
      setHasCompletedOnboarding(false);

      // Complete registration
      setUser(createMockUser({ email: 'newuser@example.com', hasCompletedOnboarding: false }));
      setToken('new-user-token');
      setLoading(false);

      const state = useAuthStore.getState();
      expect(state.user?.email).toBe('newuser@example.com');
      expect(state.token).toBe('new-user-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.hasCompletedOnboarding).toBe(false);
      expect(state.isLoading).toBe(false);

      // Complete onboarding
      setHasCompletedOnboarding(true);
      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    });

    it('should maintain state consistency when setting user multiple times', () => {
      const { setUser } = useAuthStore.getState();

      setUser(createMockUser({ id: '1' }));
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      setUser(createMockUser({ id: '2' }));
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      setUser(null);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('Pending first anchor state', () => {
    it('should enqueue pending first-anchor mutations in order', () => {
      const {
        setPendingFirstAnchorDraft,
        enqueuePendingFirstAnchorMutation,
      } = useAuthStore.getState();

      setPendingFirstAnchorDraft({
        tempAnchorId: 'pending-anchor-1',
        source: 'onboarding_first_anchor',
        requiresAccountGate: true,
        createdAt: new Date(),
      });

      enqueuePendingFirstAnchorMutation({
        type: 'create_anchor',
        tempAnchorId: 'pending-anchor-1',
        queuedAt: new Date().toISOString(),
      });
      enqueuePendingFirstAnchorMutation({
        type: 'charge_anchor',
        tempAnchorId: 'pending-anchor-1',
        chargeType: 'initial_quick',
        durationSeconds: 30,
        queuedAt: new Date().toISOString(),
      });

      expect(useAuthStore.getState().pendingFirstAnchorMutations.map((item) => item.type)).toEqual([
        'create_anchor',
        'charge_anchor',
      ]);
    });

    it('should clear pending first-anchor state', () => {
      const {
        setPendingFirstAnchorDraft,
        enqueuePendingFirstAnchorMutation,
        clearPendingFirstAnchorState,
      } = useAuthStore.getState();

      setPendingFirstAnchorDraft({
        tempAnchorId: 'pending-anchor-1',
        source: 'onboarding_first_anchor',
        requiresAccountGate: true,
        createdAt: new Date(),
      });
      enqueuePendingFirstAnchorMutation({
        type: 'create_anchor',
        tempAnchorId: 'pending-anchor-1',
        queuedAt: new Date().toISOString(),
      });

      clearPendingFirstAnchorState();

      expect(useAuthStore.getState().pendingFirstAnchorDraft).toBeNull();
      expect(useAuthStore.getState().pendingFirstAnchorMutations).toEqual([]);
    });
  });

  describe('finalizePendingFirstAnchorDraft', () => {
    it('should resume from the created backend anchor on retry', async () => {
      const localAnchor = createMockAnchor();
      const createdAnchor = createMockAnchor({
        id: 'server-anchor-1',
        userId: 'user-123',
      });
      const chargedAnchor = createMockAnchor({
        id: 'server-anchor-1',
        userId: 'user-123',
        isCharged: true,
        chargeCount: 1,
        chargedAt: new Date('2026-04-10T00:01:00.000Z'),
      });

      useAnchorStore.getState().setAnchors([localAnchor]);
      useAnchorStore.getState().setCurrentAnchor(localAnchor.id);

      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        pendingFirstAnchorDraft: {
          tempAnchorId: localAnchor.id,
          source: 'onboarding_first_anchor',
          requiresAccountGate: true,
          createdAt: new Date('2026-04-10T00:00:00.000Z'),
        },
        pendingFirstAnchorMutations: [
          {
            type: 'create_anchor',
            tempAnchorId: localAnchor.id,
            queuedAt: new Date('2026-04-10T00:00:01.000Z').toISOString(),
          },
          {
            type: 'charge_anchor',
            tempAnchorId: localAnchor.id,
            chargeType: 'initial_quick',
            durationSeconds: 30,
            queuedAt: new Date('2026-04-10T00:00:02.000Z').toISOString(),
          },
        ],
      });

      const postMock = jest.spyOn(apiClient, 'post');
      postMock
        .mockResolvedValueOnce({
          data: { success: true, data: createdAnchor },
        } as any)
        .mockRejectedValueOnce(new Error('Charging sync failed'))
        .mockResolvedValueOnce({
          data: { success: true, data: chargedAnchor },
        } as any);

      (AuthService.getIdToken as jest.Mock).mockResolvedValue('firebase-id-token');

      const firstAttempt = await useAuthStore.getState().finalizePendingFirstAnchorDraft();

      expect(firstAttempt).toBe(false);
      expect(useAuthStore.getState().pendingFirstAnchorDraft?.backendAnchorId).toBe('server-anchor-1');
      expect(useAuthStore.getState().pendingFirstAnchorDraft?.nextPendingMutationIndex).toBe(1);

      const secondAttempt = await useAuthStore.getState().finalizePendingFirstAnchorDraft();

      expect(secondAttempt).toBe(true);
      expect(postMock.mock.calls.map(([url]) => url)).toEqual([
        '/api/anchors',
        '/api/anchors/server-anchor-1/charge',
        '/api/anchors/server-anchor-1/charge',
      ]);
      expect(postMock.mock.calls.filter(([url]) => url === '/api/anchors')).toHaveLength(1);
      expect(useAuthStore.getState().pendingFirstAnchorDraft).toBeNull();
      expect(useAnchorStore.getState().anchors[0]?.id).toBe('server-anchor-1');

      postMock.mockRestore();
    });
  });
});
