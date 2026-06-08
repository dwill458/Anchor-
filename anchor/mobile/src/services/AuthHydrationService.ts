import { apiClient, fetchCompleteProfile } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
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

function normalizeAnchor(anchor: Anchor): Anchor {
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
    const [profileData, anchorsResponse, exportResponse] = await Promise.all([
      fetchCompleteProfile(),
      apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
        params: {
          limit: 100,
          orderBy: 'updatedAt',
          order: 'desc',
        },
      }),
      apiClient.get<AccountExportResponse>('/api/auth/me/export').catch((error) => {
        logger.warn('[AuthHydrationService] Account export hydration failed', error);
        return null;
      }),
    ]);

    const normalizedProfileData = normalizeProfileData(profileData);
    const remoteAnchors = Array.isArray(anchorsResponse.data?.data)
      ? anchorsResponse.data.data.map(normalizeAnchor)
      : [];
    const primingHistory = mapExportActivationsToPrimingHistory(
      exportResponse?.data?.data?.account?.activations ?? []
    );

    const authStore = useAuthStore.getState();
    authStore.setUser(normalizedProfileData.user);
    useAuthStore.setState({
      profileData: normalizedProfileData,
      profileLastFetched: Date.now(),
      hasCompletedOnboarding: Boolean(normalizedProfileData.user.hasCompletedOnboarding),
      isOfflineMode: false,
    });
    applyProfileSettings(normalizedProfileData.user.settings);

    if (!options.skipAnchorRefresh) {
      const anchorStore = useAnchorStore.getState();
      const preservedLocalAnchors = anchorStore.anchors.filter(
        (anchor) => !isBackendAnchorId(anchor.id)
      );
      anchorStore.setAnchors([...remoteAnchors, ...preservedLocalAnchors]);
      anchorStore.markSynced();
    }

    useSessionStore.getState().hydrateFromBackend({
      totalActivations: normalizedProfileData.user.totalActivations,
      currentStreak: normalizedProfileData.user.currentStreak,
      anchors: remoteAnchors,
      primingHistory,
    });

    useAuthStore.getState().computeStreak();
  }
}

export default new AuthHydrationService();
