import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { ApiResponse, ProfileData, User } from '@/types';
import { apiClient, fetchCompleteProfile } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import { useAnchorStore } from '@/stores/anchorStore';
import { calculateStreak } from '@/utils/streakHelpers';
import { applyStabilizeCompletion, toDateOrNull } from '@/utils/stabilizeStats';

/**
 * Hybrid storage engine that selectively routes sensitive data to SecureStore
 */
const SECURE_KEYS = ['token'];

const hybridStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const baseData = await AsyncStorage.getItem(name);
    if (!baseData) return null;

    try {
      const parsed = JSON.parse(baseData);

      // Hydrate secure keys from SecureStore
      for (const key of SECURE_KEYS) {
        const securedValue = await SecureStore.getItemAsync(`${name}_${key}`);
        if (securedValue) {
          parsed.state[key] = securedValue;
        }
      }

      return JSON.stringify(parsed);
    } catch (error) {
      console.error('Failed to parse auth storage data:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const parsed = JSON.parse(value);
      const state = { ...parsed.state };

      // Extract and save secure keys to SecureStore
      for (const key of SECURE_KEYS) {
        if (state[key]) {
          await SecureStore.setItemAsync(`${name}_${key}`, state[key]);
          delete state[key]; // Don't save in AsyncStorage
        } else {
          await SecureStore.deleteItemAsync(`${name}_${key}`);
        }
      }

      // Save the sanitized state in AsyncStorage
      await AsyncStorage.setItem(name, JSON.stringify({ ...parsed, state }));
    } catch (error) {
      console.error('Failed to save auth storage data:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
    for (const key of SECURE_KEYS) {
      await SecureStore.deleteItemAsync(`${name}_${key}`);
    }
  },
};

/**
 * Onboarding segment type
 */
export type OnboardingSegment = 'athlete' | 'entrepreneur' | 'wellness';

/**
 * Authentication state interface
 */
interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  onboardingSegment: OnboardingSegment | null;
  shouldRedirectToCreation: boolean;
  anchorCount: number;

  // NEW: Profile caching fields
  profileData: ProfileData | null;
  profileLastFetched: number | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  completeOnboarding: () => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setOnboardingSegment: (segment: OnboardingSegment) => void;
  setShouldRedirectToCreation: (should: boolean) => void;
  incrementAnchorCount: () => void;
  signOut: () => void;

  // NEW: Profile actions
  fetchProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearProfile: () => void;

  // Streak
  computeStreak: () => void;

  // Stabilize (Practice)
  recordStabilize: (anchorId: string) => Promise<{
    sameDay: boolean;
    reset: boolean;
    incremented: boolean;
  }>;
}

/**
 * Authentication store with hybrid persistence (AsyncStorage + SecureStore)
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
      onboardingSegment: null,
      shouldRedirectToCreation: false,
      anchorCount: 0,

      // NEW: Profile caching initial state
      profileData: null,
      profileLastFetched: null,

      // Actions
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setToken: (token) =>
        set({
          token,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      completeOnboarding: () =>
        set({
          hasCompletedOnboarding: true,
        }),

      setAuthenticated: (isAuthenticated) =>
        set({
          isAuthenticated,
        }),

      setHasCompletedOnboarding: (hasCompletedOnboarding) =>
        set({
          hasCompletedOnboarding,
        }),

      setOnboardingSegment: (onboardingSegment) =>
        set({
          onboardingSegment,
        }),

      setShouldRedirectToCreation: (shouldRedirectToCreation) =>
        set({
          shouldRedirectToCreation,
        }),

      incrementAnchorCount: () =>
        set((state) => ({
          anchorCount: state.anchorCount + 1,
        })),

      // NEW: Fetch profile with 5-minute cache TTL
      fetchProfile: async () => {
        try {
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
          const { profileLastFetched } = get();
          const now = Date.now();

          // Return cached data if still fresh
          if (profileLastFetched && (now - profileLastFetched) < CACHE_DURATION) {
            return;
          }

          const profileData = await fetchCompleteProfile();
          set({
            profileData,
            profileLastFetched: now,
            user: profileData.user, // Keep user in sync
          });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          throw error;
        }
      },

      // NEW: Force refresh profile (bypasses cache)
      refreshProfile: async () => {
        set({ profileLastFetched: null }); // Invalidate cache
        await get().fetchProfile();
      },

      // NEW: Clear profile data (on logout)
      clearProfile: () => {
        set({ profileData: null, profileLastFetched: null });
      },

      computeStreak: () => {
        const { user } = get();
        if (!user) return;

        const anchors = useAnchorStore.getState().anchors;

        // Use lastActivatedAt per anchor as the activation proxy (no full
        // activation history is stored client-side).
        const activationProxies = anchors
          .filter((a) => a.lastActivatedAt != null)
          .map((a) => ({ createdAt: a.lastActivatedAt as Date }));

        const { currentStreak, longestStreak } = calculateStreak(activationProxies);

        set((state) => ({
          user: state.user
            ? { ...state.user, currentStreak, longestStreak }
            : null,
        }));
      },

      recordStabilize: async (anchorId: string) => {
        const { user } = get();
        if (!user) {
          return { sameDay: false, reset: false, incremented: false };
        }

        const now = new Date();
        const lastStabilizeAt = toDateOrNull(user.lastStabilizeAt);

        const prev = {
          stabilizesTotal: user.stabilizesTotal ?? 0,
          stabilizeStreakDays: user.stabilizeStreakDays ?? 0,
          lastStabilizeAt,
        };

        const { next, flags } = applyStabilizeCompletion(prev, now);

        // Optimistic local update
        set((state) => ({
          user: state.user
            ? {
              ...state.user,
              stabilizesTotal: next.stabilizesTotal,
              stabilizeStreakDays: next.stabilizeStreakDays,
              lastStabilizeAt: next.lastStabilizeAt ?? undefined,
            }
            : null,
          profileData: state.profileData
            ? {
              ...state.profileData,
              user: {
                ...state.profileData.user,
                stabilizesTotal: next.stabilizesTotal,
                stabilizeStreakDays: next.stabilizeStreakDays,
                lastStabilizeAt: next.lastStabilizeAt ?? undefined,
              },
            }
            : null,
        }));

        try {
          const token = await AuthService.getIdToken();
          const isMockToken = typeof token === 'string' && token.startsWith('mock-');

          if (isMockToken) {
            return flags;
          }

          const response = await apiClient.post<ApiResponse<User>>('/api/practice/stabilize', {
            anchorId,
            completedAt: now.toISOString(),
            timezoneOffsetMinutes: now.getTimezoneOffset(),
            lastStabilizeTimezoneOffsetMinutes: lastStabilizeAt
              ? lastStabilizeAt.getTimezoneOffset()
              : null,
            stabilizeStreakDaysClient: next.stabilizeStreakDays,
          });

          const updatedUser = response.data?.data;
          if (response.data?.success && updatedUser) {
            const normalizedUpdatedUser: User = {
              ...updatedUser,
              createdAt: toDateOrNull(updatedUser.createdAt) ?? user.createdAt,
              stabilizesTotal: updatedUser.stabilizesTotal ?? next.stabilizesTotal,
              stabilizeStreakDays: updatedUser.stabilizeStreakDays ?? next.stabilizeStreakDays,
              lastStabilizeAt: toDateOrNull(updatedUser.lastStabilizeAt) ?? undefined,
            };

            set((state) => ({
              user: state.user ? { ...state.user, ...normalizedUpdatedUser } : normalizedUpdatedUser,
              profileData: state.profileData
                ? { ...state.profileData, user: { ...state.profileData.user, ...normalizedUpdatedUser } }
                : state.profileData,
            }));
          }
        } catch (error) {
          console.warn('Failed to sync stabilize stats, saved locally only:', error);
        }

        return flags;
      },

      signOut: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          anchorCount: 0,
          profileData: null,
          profileLastFetched: null,
        }),
    }),
    {
      name: 'anchor-auth-storage',
      storage: createJSONStorage(() => hybridStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recompute streak immediately after store hydrates from disk
          state.computeStreak();
        }
      },

      // Only persist certain fields
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingSegment: state.onboardingSegment,
        shouldRedirectToCreation: state.shouldRedirectToCreation,
        anchorCount: state.anchorCount,
        profileData: state.profileData,
        profileLastFetched: state.profileLastFetched,
      }),
    }
  )
);
