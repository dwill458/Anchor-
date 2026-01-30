/**
 * Anchor App - Authentication Store
 *
 * Global state management for authentication using Zustand.
 * Handles user session, onboarding status, and auth state persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, ProfileData } from '@/types';
import { fetchCompleteProfile } from '@/services/ApiClient';

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
}

/**
 * Authentication store with persistence
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
      storage: createJSONStorage(() => AsyncStorage),
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
