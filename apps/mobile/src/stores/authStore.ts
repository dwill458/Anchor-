/**
 * Anchor App - Authentication Store
 *
 * Global state management for authentication using Zustand.
 * Handles user session, onboarding status, and auth state persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types';

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

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  completeOnboarding: () => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setOnboardingSegment: (segment: OnboardingSegment) => void;
  signOut: () => void;
}

/**
 * Authentication store with persistence
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
      onboardingSegment: null,

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

      signOut: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
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
      }),
    }
  )
);
