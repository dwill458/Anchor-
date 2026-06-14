import { apiClient, fetchCompleteProfile } from '@/services/ApiClient';
import {
  loadAnchorSnapshot,
  loadProfileSnapshot,
  loadSessionSnapshot,
} from '@/services/UserLocalStateService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Anchor, ApiResponse, ProfileData, User, UserSettings } from '@/types';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { buildPrimingHistoryEntry, type PrimingHistoryEntry } from '@/utils/primingAnalytics';
import { logger } from '@/utils/logger';

function normalizeDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeAnchor(anchor: Anchor): Anchor {
  return {
    ...anchor,
    createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
    updatedAt: normalizeDate(anchor.updatedAt) ?? new Date(),
    chargedAt: normalizeDate(anchor.chargedAt),
    firstChargedAt: normalizeDate(anchor.firstChargedAt),
    ignitedAt: normalizeDate(anchor.ignitedAt),
    lastActivatedAt: normalizeDate(anchor.lastActivatedAt),
    releasedAt: normalizeDate(anchor.releasedAt),
    archivedAt: normalizeDate(anchor.archivedAt),
  };
}

function normalizeUser(user: User): User {
  return {
    ...user,
    isComped: user.isComped === true,
    createdAt: normalizeDate(user.createdAt) ?? new Date(),
    lastStabilizeAt: normalizeDate(user.lastStabilizeAt),
    stabilizesTotal: user.stabilizesTotal ?? 0,
    stabilizeStreakDays: user.stabilizeStreakDays ?? 0,
    settings: user.settings ? normalizeUserSettings(user.settings) : user.settings,
  };
}

function normalizeUserSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    updatedAt: normalizeDate(settings.updatedAt) ?? new Date(),
  };
}

function applyProfileSettings(settings?: UserSettings | null): void {
  if (!settings) {
    return;
  }

  const normalized = normalizeUserSettings(settings);
  useSettingsStore.setState((current) => ({
    ...current,
    focusSessionMode: normalized.focusSessionMode ?? current.focusSessionMode,
    focusSessionDuration: normalized.focusSessionDuration ?? current.focusSessionDuration,
    focusSessionAudio: normalized.focusSessionAudio ?? current.focusSessionAudio,
    primeSessionDuration: normalized.primeSessionDuration ?? current.primeSessionDuration,
    primeSessionAudio: normalized.primeSessionAudio ?? current.primeSessionAudio,
  }));
}

function normalizeProfileData(profileData: ProfileData): ProfileData {
  return {
    ...profileData,
    user: normalizeUser(profileData.user),
    activeAnchors: profileData.activeAnchors.map((anchor) => ({
      ...anchor,
      createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
    })),
  };
}

type ExportActivation = {
  id: string;
  anchorId: string;
  activationType: 'visual' | 'mantra' | 'deep';
  durationSeconds?: number | null;
  activatedAt: string;
};

type AccountExportResponse = {
  success: boolean;
  data?: {
    account?: {
      anchors?: Anchor[];
      activations?: ExportActivation[];
    };
  };
};

function mapExportActivationsToPrimingHistory(activations: ExportActivation[]): PrimingHistoryEntry[] {
  return activations
    .map((activation) => {
      const type = activation.activationType === 'deep' ? 'reinforce' : 'activate';
      return buildPrimingHistoryEntry({
        id: activation.id,
        anchorId: activation.anchorId,
        type,
        completedAt: activation.activatedAt,
      });
    })
    .filter((entry): entry is PrimingHistoryEntry => entry !== null);
}

interface HydrateOptions {
  skipAnchorRefresh?: boolean;
}

class AuthHydrationService {
  async hydrateAuthenticatedData(options: HydrateOptions = {}): Promise<void> {
    const authStore = useAuthStore.getState();
    const fallbackUserId = authStore.user?.id ?? null;
    const [profileResult, anchorsResult, exportResult] = await Promise.allSettled([
      fetchCompleteProfile(),
      apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
        params: {
          limit: 100,
          orderBy: 'updatedAt',
          order: 'desc',
        },
      }),
      apiClient.get<AccountExportResponse>('/api/auth/me/export'),
    ]);

    let normalizedProfileData: ProfileData | null = null;
    let remoteAnchors: Anchor[] = [];
    let exportAnchors: Anchor[] = [];
    let primingHistory: PrimingHistoryEntry[] = [];
    let resolvedUserId = fallbackUserId;

    if (profileResult.status === 'fulfilled') {
      normalizedProfileData = normalizeProfileData(profileResult.value);
      resolvedUserId = normalizedProfileData.user.id;
      authStore.setUser(normalizedProfileData.user);
      useAuthStore.setState({
        profileData: normalizedProfileData,
        profileLastFetched: Date.now(),
        hasCompletedOnboarding: Boolean(normalizedProfileData.user.hasCompletedOnboarding),
        isOfflineMode: false,
      });
      useProfileStore.getState().syncFromUser(normalizedProfileData.user);
      applyProfileSettings(normalizedProfileData.user.settings);
    } else {
      logger.warn('[AuthHydrationService] Profile hydration failed', profileResult.reason);
    }

    if (anchorsResult.status === 'fulfilled') {
      remoteAnchors = Array.isArray(anchorsResult.value.data?.data)
        ? anchorsResult.value.data.data.map(normalizeAnchor)
        : [];
    } else {
      logger.warn('[AuthHydrationService] Anchor hydration failed', anchorsResult.reason);
    }

    if (exportResult.status === 'fulfilled') {
      const exportAccount = exportResult.value.data?.data?.account;
      exportAnchors = Array.isArray(exportAccount?.anchors)
        ? exportAccount.anchors
          .filter((anchor): anchor is Anchor => anchor != null && typeof anchor.id === 'string')
          .map(normalizeAnchor)
        : [];
      primingHistory = mapExportActivationsToPrimingHistory(
        exportAccount?.activations ?? []
      );
    } else {
      logger.warn('[AuthHydrationService] Account export hydration failed', exportResult.reason);
    }

    const anchorSnapshot = resolvedUserId ? await loadAnchorSnapshot(resolvedUserId) : null;
    const profileSnapshot = resolvedUserId ? await loadProfileSnapshot(resolvedUserId) : null;
    if (profileSnapshot) {
      useProfileStore.getState().updateProfile({
        ...profileSnapshot,
        ownerUserId: resolvedUserId,
      });
    }

    if (!options.skipAnchorRefresh) {
      const anchorStore = useAnchorStore.getState();
      const preservedLocalAnchors = anchorStore.anchors.filter(
        (anchor) => !isBackendAnchorId(anchor.id)
      );
      const normalizedSnapshotAnchors = (anchorSnapshot?.anchors ?? []).map(normalizeAnchor);
      const shouldUseExportAnchors =
        exportAnchors.length > 0 &&
        (anchorsResult.status === 'rejected' || remoteAnchors.length === 0);
      const shouldUseAnchorSnapshot =
        !shouldUseExportAnchors &&
        normalizedSnapshotAnchors.length > 0 &&
        (
          anchorsResult.status === 'rejected' ||
          (
            remoteAnchors.length === 0 &&
            (
              (normalizedProfileData?.user.totalAnchorsCreated ?? 0) > 0 ||
              (authStore.user?.totalAnchorsCreated ?? 0) > 0
            )
          )
        );

      const restoredAnchors = shouldUseExportAnchors
        ? exportAnchors
        : shouldUseAnchorSnapshot
          ? normalizedSnapshotAnchors
          : remoteAnchors;
      const nextAnchors = [...restoredAnchors, ...preservedLocalAnchors];

      remoteAnchors = restoredAnchors;
      anchorStore.setAnchors(nextAnchors);

      if (shouldUseExportAnchors && nextAnchors.length > 0) {
        anchorStore.setCurrentAnchor(nextAnchors[0].id);
      }

      if (shouldUseAnchorSnapshot && anchorSnapshot?.currentAnchorId) {
        anchorStore.setCurrentAnchor(anchorSnapshot.currentAnchorId);
      }

      if (!shouldUseExportAnchors && !shouldUseAnchorSnapshot && anchorsResult.status === 'fulfilled') {
        anchorStore.markSynced();
      }
    }

    if (normalizedProfileData) {
      const totalActivations = Math.max(
        normalizedProfileData.user.totalActivations,
        primingHistory.length
      );
      useSessionStore.getState().hydrateFromBackend({
        totalActivations,
        currentStreak: normalizedProfileData.user.currentStreak,
        anchors: remoteAnchors,
        primingHistory,
      });
    }

    const sessionSnapshot = resolvedUserId ? await loadSessionSnapshot(resolvedUserId) : null;
    if (sessionSnapshot) {
      const sessionState = useSessionStore.getState();
      const snapshotPrimingCount = Array.isArray(sessionSnapshot.primingHistory)
        ? sessionSnapshot.primingHistory.length
        : 0;
      const currentPrimingCount = Array.isArray(sessionState.primingHistory)
        ? sessionState.primingHistory.length
        : 0;

      if (
        sessionState.totalSessionsCount < sessionSnapshot.totalSessionsCount ||
        currentPrimingCount < snapshotPrimingCount
      ) {
        useSessionStore.setState(sessionSnapshot as Partial<typeof sessionState>);
      }
    }

    const restoredFromRemote = normalizedProfileData != null || anchorsResult.status === 'fulfilled';
    const restoredFromSnapshot =
      anchorSnapshot != null || profileSnapshot != null || sessionSnapshot != null;

    if (!restoredFromRemote && !restoredFromSnapshot) {
      const failureReasons = [
        profileResult.status === 'rejected' ? profileResult.reason : null,
        anchorsResult.status === 'rejected' ? anchorsResult.reason : null,
      ].filter(Boolean);
      throw failureReasons[0] instanceof Error
        ? failureReasons[0]
        : new Error('Authenticated hydration failed.');
    }

    useAuthStore.getState().computeStreak();
  }

  /**
   * Self-healing thread/progress restore. Re-fetches the account export and
   * rehydrates the session store (priming history → thread counts/strength)
   * directly, so screens that show progress never depend solely on launch-time
   * hydration. Returns true when priming history was restored.
   */
  async rehydrateSessionFromExport(): Promise<boolean> {
    try {
      const exportResult = await apiClient.get<AccountExportResponse>('/api/auth/me/export');
      const exportAccount = exportResult.data?.data?.account;
      const primingHistory = mapExportActivationsToPrimingHistory(
        exportAccount?.activations ?? []
      );

      if (primingHistory.length === 0) {
        return false;
      }

      const user = useAuthStore.getState().user;
      const anchors = useAnchorStore.getState().anchors;
      const totalActivations = Math.max(user?.totalActivations ?? 0, primingHistory.length);

      useSessionStore.getState().hydrateFromBackend({
        totalActivations,
        currentStreak: user?.currentStreak ?? 0,
        anchors,
        primingHistory,
      });
      return true;
    } catch (error) {
      logger.warn('[AuthHydrationService] Session rehydrate from export failed', error);
      return false;
    }
  }
}

export default new AuthHydrationService();
