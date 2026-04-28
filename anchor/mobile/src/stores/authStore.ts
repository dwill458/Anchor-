import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type {
  Anchor,
  ApiResponse,
  PendingFirstAnchorDraft,
  PendingFirstAnchorMutation,
  ProfileData,
  User,
} from '@/types';
import { apiClient, fetchCompleteProfile } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import { useAnchorStore } from '@/stores/anchorStore';
import { calculateStreak } from '@/utils/streakHelpers';
import {
  createDeveloperMasterUser,
  DEVELOPER_MASTER_ACCOUNT_TOKEN,
} from '@/utils/developerMasterAccount';
import { logger } from '@/utils/logger';

type StabilizeStats = {
  stabilizesTotal: number;
  stabilizeStreakDays: number;
  lastStabilizeAt: Date | null;
};

type StabilizeCompletionFlags = {
  sameDay: boolean;
  reset: boolean;
  incremented: boolean;
};

const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDayDiffLocal = (now: Date, last: Date | string | null | undefined): number | null => {
  const lastDate = toDateOrNull(last);
  if (!lastDate) return null;

  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const lastDay = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate()
  ).getTime();
  const diff = Math.round((nowDay - lastDay) / 86400000);
  return diff < 0 ? 0 : diff;
};

const applyStabilizeCompletion = (
  prev: StabilizeStats,
  now: Date = new Date()
): { next: StabilizeStats; flags: StabilizeCompletionFlags } => {
  const diff = getDayDiffLocal(now, prev.lastStabilizeAt);
  const sameDay = diff === 0;
  const reset = diff !== null && diff > 1;

  let nextStreakDays = prev.stabilizeStreakDays;
  if (diff === null) {
    nextStreakDays = 1;
  } else if (sameDay) {
    nextStreakDays = Math.max(1, prev.stabilizeStreakDays);
  } else if (diff === 1) {
    nextStreakDays = prev.stabilizeStreakDays + 1;
  } else {
    nextStreakDays = 1;
  }

  return {
    next: {
      stabilizesTotal: prev.stabilizesTotal + 1,
      stabilizeStreakDays: nextStreakDays,
      lastStabilizeAt: now,
    },
    flags: {
      sameDay,
      reset,
      incremented: true,
    },
  };
};

/**
 * Hybrid storage engine that selectively routes sensitive data to SecureStore
 */
const SECURE_KEYS = ['token'];

const createClearedPendingFirstAnchorState = () => ({
  shouldRedirectToCreation: false,
  pendingForgeIntent: null,
  pendingForgeResumeTarget: null,
  pendingFirstAnchorDraft: null,
  pendingFirstAnchorMutations: [] as PendingFirstAnchorMutation[],
  isFinalizingPendingFirstAnchor: false,
  pendingFirstAnchorError: null,
});

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
      logger.error('Failed to parse auth storage data:', error);
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
      logger.error('Failed to save auth storage data:', error);
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

function normalizeAnchorDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function normalizeAnchor(anchor: Anchor): Anchor {
  return {
    ...anchor,
    createdAt: normalizeAnchorDate(anchor.createdAt) ?? new Date(),
    updatedAt: normalizeAnchorDate(anchor.updatedAt) ?? new Date(),
    chargedAt: normalizeAnchorDate(anchor.chargedAt),
    firstChargedAt: normalizeAnchorDate(anchor.firstChargedAt),
    ignitedAt: normalizeAnchorDate(anchor.ignitedAt),
    lastActivatedAt: normalizeAnchorDate(anchor.lastActivatedAt),
    releasedAt: normalizeAnchorDate(anchor.releasedAt),
    archivedAt: normalizeAnchorDate(anchor.archivedAt),
  };
}

function buildAnchorCreatePayload(anchor: Anchor) {
  return {
    intentionText: anchor.intentionText,
    category: anchor.category,
    distilledLetters: anchor.distilledLetters,
    baseSigilSvg: anchor.baseSigilSvg,
    structureVariant: anchor.structureVariant,
    reinforcedSigilSvg: anchor.reinforcedSigilSvg,
    reinforcementMetadata: anchor.reinforcementMetadata,
    enhancedImageUrl: anchor.enhancedImageUrl,
    enhancementMetadata: anchor.enhancementMetadata,
    mantraText: anchor.mantraText,
    mantraPronunciation: anchor.mantraPronunciation,
    mantraAudioUrl: anchor.mantraAudioUrl,
  };
}

function getNextPendingMutationIndex(
  mutations: PendingFirstAnchorMutation[],
  startIndex: number
): number {
  let nextIndex = startIndex;

  while (nextIndex < mutations.length && mutations[nextIndex]?.type === 'create_anchor') {
    nextIndex += 1;
  }

  return nextIndex;
}

function isMockAuthToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && (token === 'mock-jwt-token' || token.startsWith('mock-'));
}

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
  pendingForgeIntent: string | null;
  pendingForgeResumeTarget: string | null;
  pendingFirstAnchorDraft: PendingFirstAnchorDraft | null;
  pendingFirstAnchorMutations: PendingFirstAnchorMutation[];
  isFinalizingPendingFirstAnchor: boolean;
  pendingFirstAnchorError: string | null;

  // NEW: Profile caching fields
  profileData: ProfileData | null;
  profileLastFetched: number | null;

  // Offline mode
  isOfflineMode: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSession: (user: User, token: string) => void;
  completeOnboarding: () => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setOnboardingSegment: (segment: OnboardingSegment) => void;
  setShouldRedirectToCreation: (should: boolean) => void;
  incrementAnchorCount: () => void;
  enableDeveloperMasterAccount: () => void;
  setPendingForgeIntent: (intent: string | null) => void;
  clearPendingForgeIntent: () => void;
  setPendingForgeResumeTarget: (target: string | null) => void;
  clearPendingForgeResumeTarget: () => void;
  setPendingFirstAnchorDraft: (draft: PendingFirstAnchorDraft | null) => void;
  enqueuePendingFirstAnchorMutation: (mutation: PendingFirstAnchorMutation) => void;
  clearPendingFirstAnchorState: () => void;
  clearPendingFirstAnchorError: () => void;
  finalizePendingFirstAnchorDraft: () => Promise<boolean>;
  setOfflineMode: (offline: boolean) => void;
  signOut: () => void;

  // NEW: Profile actions
  fetchProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearProfile: () => void;

  // Streak
  computeStreak: () => void;

  // Wallpaper prompt
  wallpaperPromptSeen: boolean;
  setWallpaperPromptSeen: (seen: boolean) => void;

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
      pendingForgeIntent: null,
      pendingForgeResumeTarget: null,
      pendingFirstAnchorDraft: null,
      pendingFirstAnchorMutations: [],
      isFinalizingPendingFirstAnchor: false,
      pendingFirstAnchorError: null,

      // NEW: Profile caching initial state
      profileData: null,
      profileLastFetched: null,
      wallpaperPromptSeen: false,
      isOfflineMode: false,

      // Actions
      setUser: (user) =>
        set((state) => {
          const hasCompletedOnboarding = user
            ? Boolean(user.hasCompletedOnboarding)
            : state.hasCompletedOnboarding;

          return {
            user: user
              ? {
                ...user,
                hasCompletedOnboarding,
              }
              : null,
            isAuthenticated: !!user,
            hasCompletedOnboarding,
          };
        }),

      setToken: (token) =>
        set({
          token,
        }),

      setSession: (user, token) =>
        set(() => {
          const hasCompletedOnboarding = Boolean(user.hasCompletedOnboarding);

          return {
            user: {
              ...user,
              hasCompletedOnboarding,
            },
            token,
            isAuthenticated: true,
            hasCompletedOnboarding,
            isLoading: false,
          };
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

      enableDeveloperMasterAccount: () =>
        set((state) => ({
          user: createDeveloperMasterUser({
            hasCompletedOnboarding: state.hasCompletedOnboarding,
            totalAnchorsCreated: Math.max(
              state.anchorCount,
              state.user?.totalAnchorsCreated ?? 0
            ),
            totalActivations: state.user?.totalActivations ?? 0,
            currentStreak: state.user?.currentStreak ?? 0,
            longestStreak: state.user?.longestStreak ?? 0,
            stabilizesTotal: state.user?.stabilizesTotal ?? 0,
            stabilizeStreakDays: state.user?.stabilizeStreakDays ?? 0,
            lastStabilizeAt: state.user?.lastStabilizeAt,
            createdAt: state.user?.createdAt ?? new Date(),
          }),
          token: DEVELOPER_MASTER_ACCOUNT_TOKEN,
          isAuthenticated: true,
          isLoading: false,
          profileData: null,
          profileLastFetched: null,
        })),

      setPendingForgeIntent: (pendingForgeIntent) =>
        set({
          pendingForgeIntent,
        }),

      clearPendingForgeIntent: () =>
        set({
          pendingForgeIntent: null,
        }),

      setPendingForgeResumeTarget: (pendingForgeResumeTarget) =>
        set({
          pendingForgeResumeTarget,
        }),

      clearPendingForgeResumeTarget: () =>
        set({
          pendingForgeResumeTarget: null,
        }),

      setPendingFirstAnchorDraft: (pendingFirstAnchorDraft) =>
        set({
          pendingFirstAnchorDraft,
          pendingFirstAnchorError: null,
        }),

      enqueuePendingFirstAnchorMutation: (mutation) =>
        set((state) => ({
          pendingFirstAnchorMutations: [...state.pendingFirstAnchorMutations, mutation],
        })),

      clearPendingFirstAnchorState: () =>
        set({
          ...createClearedPendingFirstAnchorState(),
        }),

      clearPendingFirstAnchorError: () =>
        set({
          pendingFirstAnchorError: null,
        }),

      setOfflineMode: (isOfflineMode) =>
        set({ isOfflineMode }),

      setWallpaperPromptSeen: (wallpaperPromptSeen) =>
        set({ wallpaperPromptSeen }),

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
          const hasCompletedOnboarding = Boolean(profileData.user.hasCompletedOnboarding);
          set({
            profileData,
            profileLastFetched: now,
            user: {
              ...profileData.user,
              hasCompletedOnboarding,
            },
            hasCompletedOnboarding,
          });
        } catch (error) {
          logger.error('Failed to fetch profile:', error);
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

      finalizePendingFirstAnchorDraft: async () => {
        const {
          pendingFirstAnchorDraft,
          pendingFirstAnchorMutations,
          isFinalizingPendingFirstAnchor,
          user,
        } = get();

        if (!pendingFirstAnchorDraft) {
          return true;
        }

        if (isFinalizingPendingFirstAnchor) {
          return false;
        }

        set({
          isFinalizingPendingFirstAnchor: true,
          pendingFirstAnchorError: null,
        });

        try {
          const anchorStore = useAnchorStore.getState();
          const localAnchor = anchorStore.getAnchorById(pendingFirstAnchorDraft.tempAnchorId);
          const relevantMutations = pendingFirstAnchorMutations.filter(
            (mutation) => mutation.tempAnchorId === pendingFirstAnchorDraft.tempAnchorId
          );

          if (!localAnchor) {
            throw new Error('Your first anchor draft could not be found.');
          }

          const idToken = await AuthService.getIdToken();

          // Mock auth cannot reach the real backend. Clear the gate and keep the
          // locally created anchor so development and tests remain usable.
          if (isMockAuthToken(idToken)) {
            if (user?.id && localAnchor.userId !== user.id) {
              anchorStore.updateAnchor(localAnchor.id, { userId: user.id });
            }

            set((state) => ({
              pendingFirstAnchorDraft: null,
              pendingFirstAnchorMutations: [],
              isFinalizingPendingFirstAnchor: false,
              pendingFirstAnchorError: null,
              user: state.user
                ? {
                  ...state.user,
                  totalAnchorsCreated: state.user.totalAnchorsCreated + 1,
                }
                : state.user,
              profileData: state.profileData
                ? {
                  ...state.profileData,
                  user: {
                    ...state.profileData.user,
                    totalAnchorsCreated: state.profileData.user.totalAnchorsCreated + 1,
                  },
                }
                : state.profileData,
            }));

            return true;
          }

          const persistPendingDraftProgress = (updates: Partial<PendingFirstAnchorDraft>) => {
            set((state) => ({
              pendingFirstAnchorDraft:
                state.pendingFirstAnchorDraft?.tempAnchorId === pendingFirstAnchorDraft.tempAnchorId
                  ? {
                    ...state.pendingFirstAnchorDraft,
                    ...updates,
                  }
                  : state.pendingFirstAnchorDraft,
            }));
          };

          let backendAnchorId = pendingFirstAnchorDraft.backendAnchorId;
          let nextPendingMutationIndex = pendingFirstAnchorDraft.nextPendingMutationIndex ?? 0;
          let finalizedAnchor = normalizeAnchor(
            backendAnchorId
              ? ({
                ...localAnchor,
                id: backendAnchorId,
              } as Anchor)
              : localAnchor
          );

          if (!backendAnchorId) {
            const createResponse = await apiClient.post<ApiResponse<Anchor>>(
              '/api/anchors',
              buildAnchorCreatePayload(localAnchor)
            );

            if (!createResponse.data?.success || !createResponse.data.data?.id) {
              throw new Error('We could not save your first anchor yet.');
            }

            backendAnchorId = createResponse.data.data.id;
            nextPendingMutationIndex = getNextPendingMutationIndex(relevantMutations, 0);
            finalizedAnchor = normalizeAnchor({
              ...localAnchor,
              ...createResponse.data.data,
              id: backendAnchorId,
            } as Anchor);

            persistPendingDraftProgress({
              backendAnchorId,
              nextPendingMutationIndex,
            });
          }

          for (let index = nextPendingMutationIndex; index < relevantMutations.length; index += 1) {
            const mutation = relevantMutations[index];

            if (mutation.type === 'create_anchor') {
              nextPendingMutationIndex = index + 1;
              persistPendingDraftProgress({ nextPendingMutationIndex });
              continue;
            }

            if (mutation.type === 'charge_anchor') {
              const chargeResponse = await apiClient.post<ApiResponse<Anchor>>(
                `/api/anchors/${finalizedAnchor.id}/charge`,
                {
                  chargeType: mutation.chargeType,
                  durationSeconds: mutation.durationSeconds,
                }
              );

              if (!chargeResponse.data?.success || !chargeResponse.data.data) {
                throw new Error('Your first anchor was created, but charging did not sync.');
              }

              finalizedAnchor = normalizeAnchor({
                ...finalizedAnchor,
                ...chargeResponse.data.data,
              } as Anchor);
              nextPendingMutationIndex = index + 1;
              persistPendingDraftProgress({ nextPendingMutationIndex });
              continue;
            }

            if (mutation.type === 'activate_anchor') {
              const activationResponse = await apiClient.post<ApiResponse<Anchor>>(
                `/api/anchors/${finalizedAnchor.id}/activate`,
                {
                  activationType: mutation.activationType,
                  durationSeconds: mutation.durationSeconds,
                }
              );

              if (!activationResponse.data?.success || !activationResponse.data.data) {
                throw new Error('Your first anchor was created, but activation did not sync.');
              }

              finalizedAnchor = normalizeAnchor({
                ...finalizedAnchor,
                ...activationResponse.data.data,
              } as Anchor);
              nextPendingMutationIndex = index + 1;
              persistPendingDraftProgress({ nextPendingMutationIndex });
            }
          }

          const nextAnchors = anchorStore.anchors.map((anchor) =>
            anchor.id === pendingFirstAnchorDraft.tempAnchorId ? finalizedAnchor : anchor
          );
          anchorStore.setAnchors(nextAnchors);

          if (anchorStore.currentAnchorId === pendingFirstAnchorDraft.tempAnchorId) {
            anchorStore.setCurrentAnchor(finalizedAnchor.id);
          }

          set((state) => ({
            pendingFirstAnchorDraft: null,
            pendingFirstAnchorMutations: [],
            isFinalizingPendingFirstAnchor: false,
            pendingFirstAnchorError: null,
            user: state.user
              ? {
                ...state.user,
                totalAnchorsCreated: state.user.totalAnchorsCreated + 1,
              }
              : state.user,
            profileData: state.profileData
              ? {
                ...state.profileData,
                user: {
                  ...state.profileData.user,
                  totalAnchorsCreated: state.profileData.user.totalAnchorsCreated + 1,
                },
              }
              : state.profileData,
          }));

          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'We could not finish saving your first anchor.';

          logger.warn('Failed to finalize first anchor draft', error);
          set({
            isFinalizingPendingFirstAnchor: false,
            pendingFirstAnchorError: message,
          });
          return false;
        }
      },

      computeStreak: () => {
        const { user } = get();
        if (!user) return;

        const anchors = useAnchorStore.getState().anchors;

        // If anchors haven't hydrated yet (empty store) but the user already
        // has a persisted streak, skip — computing against [] would reset the
        // streak to 0 incorrectly. computeStreak will run again after the next
        // session when anchors are fully loaded.
        if (anchors.length === 0 && (user.currentStreak ?? 0) > 0) return;

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
          const isMockToken = isMockAuthToken(token);

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
          logger.warn('Failed to sync stabilize stats, saved locally only:', error);
        }

        return flags;
      },

      signOut: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isOfflineMode: false,
          anchorCount: 0,
          profileData: null,
          profileLastFetched: null,
          ...createClearedPendingFirstAnchorState(),
        }),
    }),
    {
      name: 'anchor-auth-storage',
      storage: createJSONStorage(() => hybridStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // One-shot navigation flags should never survive an app restart.
          state.setShouldRedirectToCreation(false);
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
        anchorCount: state.anchorCount,
        pendingFirstAnchorDraft: state.pendingFirstAnchorDraft,
        pendingFirstAnchorMutations: state.pendingFirstAnchorMutations,
        profileData: state.profileData,
        profileLastFetched: state.profileLastFetched,
        wallpaperPromptSeen: state.wallpaperPromptSeen,
      }),
    }
  )
);
