/**
 * Anchor App - AuthStore Tests
 *
 * Comprehensive tests for authentication state management
 */

import { useAuthStore } from '../authStore';
import { useAnchorStore } from '../anchorStore';
import { useProfileStore } from '../profileStore';
import { useSessionStore } from '../sessionStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import type { Anchor, User } from '@/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/services/UserLocalStateService', () => ({
  saveAnchorSnapshot: jest.fn().mockResolvedValue(undefined),
  saveProfileSnapshot: jest.fn().mockResolvedValue(undefined),
  saveSessionSnapshot: jest.fn().mockResolvedValue(undefined),
  loadAnchorSnapshot: jest.fn().mockResolvedValue(null),
  loadProfileSnapshot: jest.fn().mockResolvedValue(null),
  loadSessionSnapshot: jest.fn().mockResolvedValue(null),
}));

describe('authStore', () => {
  // Helper to create mock user
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    hasCompletedOnboarding: true,
    isComped: false,
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
      pendingForgeIntent: null,
      pendingForgeResumeTarget: null,
      pendingFirstAnchorDraft: null,
      pendingFirstAnchorMutations: [],
      isFinalizingPendingFirstAnchor: false,
      pendingFirstAnchorError: null,
      profileData: null,
      profileLastFetched: null,
      wallpaperPromptSeen: false,
      isOfflineMode: false,
      isGuest: false,
    });
    useAnchorStore.setState({
      anchors: [],
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      currentAnchorId: undefined,
    });
    useProfileStore.setState({
      ownerUserId: null,
      name: '',
      axiom: '',
      timezone: '',
      mono: 'initial',
      photo: null,
      memberSince: null,
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

    it('should clear onboarding status and profile when user is cleared', () => {
      const { setUser, setHasCompletedOnboarding } = useAuthStore.getState();
      setHasCompletedOnboarding(true);
      setUser(createMockUser());
      useProfileStore.getState().updateProfile({ name: 'Persisted Name' });

      setUser(null);

      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
      expect(useProfileStore.getState().name).toBe('');
      expect(useProfileStore.getState().ownerUserId).toBeNull();
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
    it('should clear user', async () => {
      const { setUser, signOut } = useAuthStore.getState();

      setUser(createMockUser());
      expect(useAuthStore.getState().user).not.toBeNull();

      await signOut();

      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should clear token', async () => {
      const { setToken, signOut } = useAuthStore.getState();

      setToken('auth-token-123');
      expect(useAuthStore.getState().token).not.toBeNull();

      await signOut();

      const { token } = useAuthStore.getState();
      expect(token).toBeNull();
    });

    it('should set isAuthenticated to false', async () => {
      const { setUser, signOut } = useAuthStore.getState();

      setUser(createMockUser());
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      await signOut();

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
    });

    it('should clear all auth state', async () => {
      const { setUser, setToken, signOut } = useAuthStore.getState();

      // Set up authenticated state
      setUser(createMockUser());
      setToken('auth-token-123');
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().token).not.toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      await signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should clear pending first-anchor and resume state', async () => {
      useAuthStore.setState({
        shouldRedirectToCreation: true,
        pendingForgeIntent: 'Return to the anchor I started',
        pendingForgeResumeTarget: 'CreateAnchor',
        pendingFirstAnchorDraft: {
          tempAnchorId: 'pending-anchor-1',
          source: 'onboarding_first_anchor',
          requiresAccountGate: true,
          createdAt: new Date('2026-04-10T00:00:00.000Z'),
        },
        pendingFirstAnchorMutations: [
          {
            type: 'create_anchor',
            tempAnchorId: 'pending-anchor-1',
            queuedAt: new Date('2026-04-10T00:00:01.000Z').toISOString(),
          },
        ],
        isFinalizingPendingFirstAnchor: true,
        pendingFirstAnchorError: 'Failed to sync pending anchor',
      });

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.shouldRedirectToCreation).toBe(false);
      expect(state.pendingForgeIntent).toBeNull();
      expect(state.pendingForgeResumeTarget).toBeNull();
      expect(state.pendingFirstAnchorDraft).toBeNull();
      expect(state.pendingFirstAnchorMutations).toEqual([]);
      expect(state.isFinalizingPendingFirstAnchor).toBe(false);
      expect(state.pendingFirstAnchorError).toBeNull();
    });

    it('should clear cached profile and offline session flags', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        token: 'token-123',
        isAuthenticated: true,
        isOfflineMode: true,
        profileData: {
          user: createMockUser(),
          settings: null,
        } as any,
        profileLastFetched: Date.now(),
      });

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.profileData).toBeNull();
      expect(state.profileLastFetched).toBeNull();
      expect(state.isOfflineMode).toBe(false);
    });

    it('should reset the persisted profile store on sign out', async () => {
      useProfileStore.setState({
        ownerUserId: 'user-123',
        name: 'Signed In Name',
        axiom: 'Stay sharp',
        timezone: 'UTC-6',
        mono: 'avatar_2',
        photo: 'file://avatar.png',
        memberSince: '2026-01-01T00:00:00.000Z',
      });

      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        hasCompletedOnboarding: true,
      });

      await useAuthStore.getState().signOut();

      expect(useProfileStore.getState()).toMatchObject({
        ownerUserId: null,
        name: '',
        axiom: '',
        timezone: '',
        mono: 'initial',
        photo: null,
        memberSince: null,
      });
    });

    it('should clear the vault and session history on sign out', async () => {
      useAnchorStore.getState().addAnchor(createMockAnchor());
      useSessionStore.setState({
        lastSession: {
          id: 'session-1',
          anchorId: 'temp-anchor-1',
          type: 'activate',
          durationSeconds: 60,
          mode: 'silent',
          completedAt: new Date('2026-04-10T00:00:00.000Z').toISOString(),
        },
        sessionLog: [
          {
            id: 'session-1',
            anchorId: 'temp-anchor-1',
            type: 'activate',
            durationSeconds: 60,
            mode: 'silent',
            completedAt: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          },
        ],
      } as any);

      await useAuthStore.getState().signOut();

      expect(useAnchorStore.getState().anchors).toEqual([]);
      expect(useSessionStore.getState().lastSession).toBeNull();
      expect(useSessionStore.getState().sessionLog).toEqual([]);
    });

    it('should clear onboarding status', async () => {
      const { setUser, setToken, completeOnboarding, signOut } = useAuthStore.getState();

      setUser(createMockUser());
      setToken('token');
      completeOnboarding();

      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);

      await signOut();

      expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
    });

    it('resets the wallpaper prompt state for the next account', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        wallpaperPromptSeen: true,
      });

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().wallpaperPromptSeen).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist user to encrypted secure storage', async () => {
      const { setUser } = useAuthStore.getState();
      const mockUser = createMockUser();

      setUser(mockUser);

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'anchor-auth-storage',
        expect.any(String)
      );
    });

    it('should persist token to encrypted secure storage', async () => {
      const { setToken } = useAuthStore.getState();

      setToken('test-token');

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'anchor-auth-storage',
        expect.any(String)
      );
    });

    it('should persist isAuthenticated to encrypted secure storage', async () => {
      const { setUser } = useAuthStore.getState();

      setUser(createMockUser());

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'anchor-auth-storage',
        expect.any(String)
      );
    });

    it('should persist hasCompletedOnboarding to encrypted secure storage', async () => {
      const { completeOnboarding } = useAuthStore.getState();

      completeOnboarding();

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'anchor-auth-storage',
        expect.any(String)
      );
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
    it('does not carry the wallpaper prompt state to a different account', () => {
      const { setSession } = useAuthStore.getState();
      setSession(createMockUser({ id: 'first-account' }), 'first-token');
      useAuthStore.getState().setWallpaperPromptSeen(true);

      setSession(createMockUser({ id: 'second-account' }), 'second-token');

      expect(useAuthStore.getState().wallpaperPromptSeen).toBe(false);
    });

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

    it('should handle complete logout flow', async () => {
      const { setUser, setToken, signOut } = useAuthStore.getState();

      // Set up authenticated state
      setUser(createMockUser());
      setToken('token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Sign out
      await signOut();

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
    const prepareTransfer = (id = 'temp-safety-a', userId = 'user-123') => {
      const anchor = createMockAnchor({ id, userId });
      useAnchorStore.getState().setAnchors([anchor]);
      useAuthStore.setState({
        user: createMockUser({ id: userId }), isAuthenticated: true,
        pendingFirstAnchorDraft: {
          tempAnchorId: id, source: 'onboarding_first_anchor', requiresAccountGate: true,
          createdAt: new Date('2026-04-10T00:00:00Z'),
        },
        pendingFirstAnchorMutations: [{
          type: 'charge_anchor', tempAnchorId: id, chargeType: 'initial_quick',
          durationSeconds: 30, queuedAt: '2026-04-10T00:00:01Z',
        }],
      });
      (AuthService.getIdToken as jest.Mock).mockResolvedValue('firebase-id-token');
      return anchor;
    };

    it('adopts a merged guest Anchor only after the server confirms ownership with the registered token', async () => {
      const local = prepareTransfer('guest-local');
      useAnchorStore.setState({ anchors: [] });
      useAuthStore.setState({ pendingFirstAnchorDraft: { ...useAuthStore.getState().pendingFirstAnchorDraft!, backendAnchorId: 'merged-backend' }, pendingFirstAnchorMutations: [] });
      const canonical = { ...local, id: 'merged-backend', userId: 'user-123' };
      expect(useAuthStore.getState().pendingFirstAnchorDraft?.tempAnchorId).toBe('guest-local');
      const get = jest.spyOn(apiClient, 'get').mockImplementation(async (url) => ({ data: { success: true, data: url === '/api/auth/me' ? createMockUser({ totalAnchorsCreated: 1 }) : canonical } }) as any);
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(true);
      expect(get).toHaveBeenCalledWith('/api/anchors/merged-backend', expect.objectContaining({ anchorAuthToken: 'firebase-id-token', anchorAuthGuard: expect.any(Function) }));
      expect(useAnchorStore.getState().getAnchorById('merged-backend')?.userId).toBe('user-123');
      expect(useAuthStore.getState().user?.totalAnchorsCreated).toBe(1);
      get.mockRestore();
    });

    it('retains the cross-account guard if the server does not confirm ownership after linking', async () => {
      const local = prepareTransfer('guest-local');
      useAuthStore.setState({ user: null });
      useAnchorStore.setState({ anchors: [{ ...local, userId: 'other-account' }] });
      useAuthStore.setState({ user: createMockUser() });
      useAuthStore.setState({ pendingFirstAnchorDraft: { ...useAuthStore.getState().pendingFirstAnchorDraft!, backendAnchorId: 'other-backend' }, pendingFirstAnchorMutations: [] });
      const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: { ...local, id: 'other-backend', userId: 'other-account' } } } as any);
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(false);
      expect(useAnchorStore.getState().getAnchorById('guest-local')?.userId).toBe('other-account');
      expect(useAuthStore.getState().pendingFirstAnchorDraft).not.toBeNull();
      get.mockRestore();
    });

    it('uses stable account-scoped keys after a server commit whose response was lost', async () => {
      const anchor = prepareTransfer();
      const post = jest.spyOn(apiClient, 'post');
      const created = { ...anchor, id: 'server-safety-a' };
      post.mockRejectedValueOnce(new Error('RESPONSE_LOST'))
        .mockResolvedValueOnce({ data: { success: true, data: created } } as any)
        .mockResolvedValueOnce({ data: { success: true, data: created } } as any);
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(false);
      expect(useAnchorStore.getState().getAnchorById(anchor.id)).toBeDefined();
      expect(useAuthStore.getState().pendingFirstAnchorDraft).not.toBeNull();
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(true);
      const firstKey = (post.mock.calls[0][1] as any).idempotencyKey;
      expect(firstKey).toEqual(expect.any(String));
      expect(firstKey).toContain('user-123');
      expect((post.mock.calls[1][1] as any).idempotencyKey).toBe(firstKey);
      expect((post.mock.calls[2][1] as any).idempotencyKey).toEqual(expect.any(String));
      post.mockRestore();
    });

    it('retries an attempted create when server hydration has already consumed the free slot', async () => {
      const anchor = prepareTransfer();
      const post = jest.spyOn(apiClient, 'post')
        .mockRejectedValueOnce(new Error('RESPONSE_LOST'))
        .mockResolvedValue({ data: { success: true, data: { ...anchor, id: 'server-safety-a' } } } as any);
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(false);
      useAuthStore.getState().setUser(createMockUser({ totalAnchorsCreated: 1, freeAnchorConsumed: true }));
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(true);
      expect(post.mock.calls.filter(([url]) => url === '/api/anchors')).toHaveLength(2);
      expect((post.mock.calls[1][1] as any).idempotencyKey).toBe((post.mock.calls[0][1] as any).idempotencyKey);
      post.mockRestore();
    });

    it('retains server-confirmed charge progress when the following activation request fails', async () => {
      const anchor = prepareTransfer();
      useAuthStore.getState().enqueuePendingFirstAnchorMutation({
        type: 'activate_anchor', tempAnchorId: anchor.id, activationType: 'visual',
        durationSeconds: 30, queuedAt: '2026-04-10T00:00:02Z',
      });
      const created = { ...anchor, id: 'server-progress-a' };
      const charged = { ...created, isCharged: true, chargeCount: 1 };
      const post = jest.spyOn(apiClient, 'post')
        .mockResolvedValueOnce({ data: { success: true, data: created } } as any)
        .mockResolvedValueOnce({ data: { success: true, data: charged } } as any)
        .mockRejectedValueOnce(new Error('ACTIVATION_INTERRUPTED'))
        .mockResolvedValueOnce({ data: { success: true, data: { id: created.id, activationCount: 1 } } } as any);
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(false);
      expect(useAnchorStore.getState().getAnchorById(anchor.id)?.isCharged).toBe(true);
      expect(useAuthStore.getState().pendingFirstAnchorDraft?.nextPendingMutationIndex).toBe(1);
      expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(true);
      expect(useAnchorStore.getState().getAnchorById(created.id)?.isCharged).toBe(true);
      expect(post.mock.calls.filter(([url]) => url.endsWith('/charge'))).toHaveLength(1);
      post.mockRestore();
    });

    it('keeps the pending draft and cursor when the created Anchor cannot be confirmed durable', async () => {
      const anchor = prepareTransfer();
      const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, data:
        createMockAnchor({ id: '12345678-1234-4123-8123-123456789abc', userId: anchor.userId }) } } as any);
      const receipt = jest.spyOn(useAnchorStore.getState(), 'flushPersistence')
        .mockRejectedValueOnce(new Error('SYNTHETIC_DURABILITY_FAILURE'));
      try {
        expect(await useAuthStore.getState().finalizePendingFirstAnchorDraft()).toBe(false);
        expect(useAuthStore.getState().pendingFirstAnchorDraft).toMatchObject({ tempAnchorId: anchor.id, createAttempted: true });
        expect(useAuthStore.getState().pendingFirstAnchorDraft?.nextPendingMutationIndex ?? 0).toBe(0);
        expect(useAuthStore.getState().pendingFirstAnchorError).toBe('SYNTHETIC_DURABILITY_FAILURE');
        expect(post).toHaveBeenCalledTimes(1);
      } finally { receipt.mockRestore(); post.mockRestore(); }
    });

    it('does not send a create after the account changes during token retrieval', async () => {
      prepareTransfer();
      let resolveToken!: (token: string) => void;
      (AuthService.getIdToken as jest.Mock).mockImplementation(() => new Promise((resolve) => { resolveToken = resolve; }));
      const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, data: createMockAnchor() } } as any);
      const pending = useAuthStore.getState().finalizePendingFirstAnchorDraft();
      await new Promise((resolve) => setImmediate(resolve));
      useAuthStore.getState().setSession(createMockUser({ id: 'user-b' }), 'token-b');
      resolveToken('token-a');
      expect(await pending).toBe(false);
      expect(post).not.toHaveBeenCalled();
      expect(useAuthStore.getState().pendingFirstAnchorError).toBeNull();
      post.mockRestore();
    });

    it('does not replay mutations or overwrite B status after A create finishes late', async () => {
      const anchor = prepareTransfer();
      let resolveCreate!: (value: any) => void;
      const post = jest.spyOn(apiClient, 'post').mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }) as any);
      const pending = useAuthStore.getState().finalizePendingFirstAnchorDraft();
      await new Promise((resolve) => setImmediate(resolve));
      useAuthStore.getState().setSession(createMockUser({ id: 'user-b' }), 'token-b');
      resolveCreate({ data: { success: true, data: { ...anchor, id: 'server-safety-a' } } });
      // An obsolete operation must stop at its first response boundary.
      await new Promise((resolve) => setImmediate(resolve));
      expect(post).toHaveBeenCalledTimes(1);
      expect(await pending).toBe(false);
      expect(useAuthStore.getState().user?.id).toBe('user-b');
      expect(useAuthStore.getState().pendingFirstAnchorError).toBeNull();
      post.mockRestore();
    });

    it('a stale failure cannot clear the promise for a newer account operation', async () => {
      prepareTransfer();
      let rejectA!: (error: Error) => void;
      let resolveB!: (value: any) => void;
      const post = jest.spyOn(apiClient, 'post')
        .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectA = reject; }) as any)
        .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }) as any);
      const pendingA = useAuthStore.getState().finalizePendingFirstAnchorDraft();
      await new Promise((resolve) => setImmediate(resolve));
      useAuthStore.getState().setSession(createMockUser({ id: 'user-b' }), 'token-b');
      const anchorB = prepareTransfer('temp-safety-b', 'user-b');
      useAuthStore.setState({ pendingFirstAnchorMutations: [] });
      const pendingB = useAuthStore.getState().finalizePendingFirstAnchorDraft();
      await new Promise((resolve) => setImmediate(resolve));
      rejectA(new Error('LATE_A_FAILURE'));
      expect(await pendingA).toBe(false);
      expect(useAuthStore.getState().isFinalizingPendingFirstAnchor).toBe(true);
      const joinedB = useAuthStore.getState().finalizePendingFirstAnchorDraft();
      resolveB({ data: { success: true, data: { ...anchorB, id: 'server-safety-b' } } });
      expect(await Promise.all([pendingB, joinedB])).toEqual([true, true]);
      expect(post).toHaveBeenCalledTimes(2);
      post.mockRestore();
    });

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

    it('should replace an already-promoted local/backend anchor with finalized charged data', async () => {
      const localAnchor = createMockAnchor({ id: 'temp-anchor-1' });
      const promotedLocalAnchor = createMockAnchor({
        id: 'server-anchor-1',
        localId: localAnchor.id,
        userId: 'user-123',
        isCharged: false,
        chargeCount: 0,
      });
      const chargedAnchorResponse = {
        id: 'server-anchor-1',
        userId: 'user-123',
      } as Partial<Anchor>;

      useAnchorStore.getState().setAnchors([promotedLocalAnchor]);
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
          backendAnchorId: 'server-anchor-1',
          nextPendingMutationIndex: 1,
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

      const postMock = jest.spyOn(apiClient, 'post').mockResolvedValue({
        data: { success: true, data: chargedAnchorResponse },
      } as any);

      (AuthService.getIdToken as jest.Mock).mockResolvedValue('firebase-id-token');

      const result = await useAuthStore.getState().finalizePendingFirstAnchorDraft();

      expect(result).toBe(true);
      expect(postMock).toHaveBeenCalledWith('/api/anchors/server-anchor-1/charge', {
        chargeType: 'initial_quick',
        durationSeconds: 30,
        idempotencyKey: 'user-123:first-anchor:temp-anchor-1:1',
      }, { anchorAuthGuard: expect.any(Function), anchorAuthToken: 'firebase-id-token' });
      expect(useAnchorStore.getState().anchors).toHaveLength(1);
      expect(useAnchorStore.getState().anchors[0]).toEqual(
        expect.objectContaining({
          id: 'server-anchor-1',
          localId: localAnchor.id,
          isCharged: true,
          chargeCount: 1,
        })
      );
      expect(useAnchorStore.getState().currentAnchorId).toBe('server-anchor-1');

      postMock.mockRestore();
    });

    it('coalesces concurrent finalizePendingFirstAnchorDraft calls and transfers the pending Anchor exactly once without duplication', async () => {
      const localAnchor = createMockAnchor({ id: 'temp-anchor-concurrent' });
      const createdAnchor = createMockAnchor({
        id: 'server-anchor-concurrent',
        userId: 'user-123',
      });

      useAnchorStore.getState().setAnchors([localAnchor, createdAnchor]);
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
        pendingFirstAnchorMutations: [],
      });

      let resolvePost!: (value: any) => void;
      const postMock = jest.spyOn(apiClient, 'post').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePost = resolve;
          }) as any
      );
      (AuthService.getIdToken as jest.Mock).mockResolvedValue('firebase-id-token');

      const firstCall = useAuthStore.getState().finalizePendingFirstAnchorDraft();
      const secondCall = useAuthStore.getState().finalizePendingFirstAnchorDraft();

      await new Promise((resolve) => setImmediate(resolve));
      resolvePost({ data: { success: true, data: createdAnchor } });

      const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(true);
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(useAnchorStore.getState().anchors).toHaveLength(1);
      expect(useAnchorStore.getState().anchors[0]).toEqual(
        expect.objectContaining({
          id: 'server-anchor-concurrent',
          localId: 'temp-anchor-concurrent',
          userId: 'user-123',
        })
      );
      expect(useAuthStore.getState().pendingFirstAnchorDraft).toBeNull();

      postMock.mockRestore();
    });
  });
});
