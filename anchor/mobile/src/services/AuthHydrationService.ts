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
import type {
  Anchor,
  ApiResponse,
  ProfileData,
  User,
  UserSettings,
} from '@/types';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import {
  buildPrimingHistoryEntry,
  type PrimingHistoryEntry,
} from '@/utils/primingAnalytics';
import { logger } from '@/utils/logger';
import { initializeProgressionMilestonesFromStores } from '@/utils/progressionMilestones';
import { applyRemoteSessionAudioPreferences } from '@/services/SessionAudioPreferencesService';
import type {
  PracticeMode,
  PracticeSessionRecord,
  VisualizationScene,
} from '@/types/practice';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';

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
    settings: user.settings
      ? normalizeUserSettings(user.settings)
      : user.settings,
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
    focusSessionDuration:
      normalized.focusSessionDuration ?? current.focusSessionDuration,
    focusSessionAudio:
      normalized.focusSessionAudio ?? current.focusSessionAudio,
    primeSessionDuration:
      normalized.primeSessionDuration ?? current.primeSessionDuration,
    visualizeSessionDuration:
      normalized.visualizeSessionDuration === 60 ||
      normalized.visualizeSessionDuration === 300
        ? normalized.visualizeSessionDuration
        : normalized.visualizeSessionDuration === 180
          ? 180
          : current.visualizeSessionDuration,
    primeSessionAudio:
      normalized.primeSessionAudio ?? current.primeSessionAudio,
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
  clientEventId?: string | null;
  anchorId: string;
  activationType: 'visual' | 'mantra' | 'deep';
  durationSeconds?: number | null;
  activatedAt: string;
};

type ExportCharge = {
  id: string;
  clientEventId?: string | null;
  anchorId: string;
  chargeType: 'initial_quick' | 'initial_deep' | 'recharge';
  durationSeconds?: number | null;
  completed?: boolean;
  chargedAt: string;
};

type ExportBurnedAnchor = {
  id: string;
  originalAnchorId: string;
  userId: string;
  intentionText: string;
  category: string;
  distilledLetters: string[];
  baseSigilSvg?: string | null;
  enhancedImageUrl?: string | null;
  activationCount: number;
  activationHistory?: unknown;
  chargeHistory?: unknown;
  createdAt: string;
  burnedAt: string;
};

type AccountExportResponse = {
  success: boolean;
  data?: {
    exportVersion?: number;
    account?: {
      anchors?: Anchor[];
      activations?: unknown;
      charges?: unknown;
      practiceSessions?: unknown;
      visualizationScenes?: unknown;
    };
    burnedAnchors?: unknown;
  };
};

function hasCompleteProgressionExport(
  data: AccountExportResponse['data'],
): data is NonNullable<AccountExportResponse['data']> & {
  exportVersion: number;
  account: { anchors: Anchor[]; activations: unknown[]; charges: unknown[] };
  burnedAnchors: unknown[];
} {
  return Boolean(
    data &&
    typeof data.exportVersion === 'number' &&
    data.exportVersion >= 2 &&
    data.account &&
    Array.isArray(data.account.anchors) &&
    Array.isArray(data.account.activations) &&
    Array.isArray(data.account.charges) &&
    Array.isArray(data.burnedAnchors),
  );
}

function hasLegacyPracticeExport(
  data: AccountExportResponse['data'],
): data is NonNullable<AccountExportResponse['data']> & {
  account: { anchors?: Anchor[]; activations: unknown[]; charges?: unknown[] };
} {
  return Boolean(
    data &&
    (data.exportVersion == null || data.exportVersion < 2) &&
    data.account &&
    Array.isArray(data.account.activations),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function readExportActivations(value: unknown): ExportActivation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is ExportActivation => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.id === 'string' &&
      (entry.clientEventId == null ||
        typeof entry.clientEventId === 'string') &&
      typeof entry.anchorId === 'string' &&
      (entry.activationType === 'visual' ||
        entry.activationType === 'mantra' ||
        entry.activationType === 'deep') &&
      isValidDateString(entry.activatedAt)
    );
  });
}

function readExportCharges(value: unknown): ExportCharge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is ExportCharge => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.id === 'string' &&
      (entry.clientEventId == null ||
        typeof entry.clientEventId === 'string') &&
      typeof entry.anchorId === 'string' &&
      (entry.chargeType === 'initial_quick' ||
        entry.chargeType === 'initial_deep' ||
        entry.chargeType === 'recharge') &&
      (entry.completed === undefined || typeof entry.completed === 'boolean') &&
      isValidDateString(entry.chargedAt)
    );
  });
}

function readExportBurnedAnchors(value: unknown): ExportBurnedAnchor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is ExportBurnedAnchor => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.id === 'string' &&
      typeof entry.originalAnchorId === 'string' &&
      typeof entry.userId === 'string' &&
      typeof entry.intentionText === 'string' &&
      typeof entry.category === 'string' &&
      Array.isArray(entry.distilledLetters) &&
      entry.distilledLetters.every((letter) => typeof letter === 'string') &&
      typeof entry.activationCount === 'number' &&
      Number.isFinite(entry.activationCount) &&
      isValidDateString(entry.createdAt) &&
      isValidDateString(entry.burnedAt)
    );
  });
}

function readCanonicalPracticeSessions(
  value: unknown,
  accountId: string,
): PracticeSessionRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      !isValidDateString(entry.startedAt) ||
      !isValidDateString(entry.completedAt)
    )
      return [];
    const practiceMode = entry.practiceMode as PracticeMode;
    if (
      !['focus', 'deep_prime', 'visualize', 'stabilize'].includes(practiceMode)
    )
      return [];
    if (
      typeof entry.plannedDurationSeconds !== 'number' ||
      typeof entry.completedDurationSeconds !== 'number'
    )
      return [];
    return [
      {
        id: entry.id,
        accountId,
        anchorId: typeof entry.anchorId === 'string' ? entry.anchorId : null,
        anchorLocalId:
          typeof entry.anchorLocalId === 'string' ? entry.anchorLocalId : null,
        anchorServerId:
          typeof entry.anchorServerIdSnapshot === 'string'
            ? entry.anchorServerIdSnapshot
            : null,
        practiceMode,
        plannedDurationSeconds: entry.plannedDurationSeconds,
        completedDurationSeconds: entry.completedDurationSeconds,
        completionStatus: 'completed' as const,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        guidanceVoice:
          entry.guidanceVoice === 'male' || entry.guidanceVoice === 'none'
            ? entry.guidanceVoice
            : 'female',
        backgroundAudio:
          entry.backgroundAudio === 'off'
            ? ('off' as const)
            : ('ambient' as const),
        sceneSnapshot:
          typeof entry.sceneSnapshot === 'string' ? entry.sceneSnapshot : null,
        nextAction:
          typeof entry.nextAction === 'string' ? entry.nextAction : null,
        clientVersion:
          typeof entry.clientVersion === 'string' ? entry.clientVersion : null,
        syncState: 'synced' as const,
      },
    ];
  });
}

function readVisualizationScenes(
  value: unknown,
  accountId: string,
): VisualizationScene[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.anchorId !== 'string' ||
      typeof entry.currentText !== 'string' ||
      typeof entry.originalSuggestion !== 'string' ||
      !isValidDateString(entry.clientUpdatedAt)
    )
      return [];
    return [
      {
        id: typeof entry.id === 'string' ? entry.id : undefined,
        accountId,
        anchorId: entry.anchorId,
        anchorLocalId: null,
        currentText: entry.currentText,
        originalSuggestion: entry.originalSuggestion,
        generationSource:
          entry.generationSource === 'gemini' ||
          entry.generationSource === 'user_edited'
            ? entry.generationSource
            : 'deterministic_fallback',
        generationVersion:
          typeof entry.generationVersion === 'string'
            ? entry.generationVersion
            : 'scene-v1',
        clientUpdatedAt: entry.clientUpdatedAt,
        createdAt: isValidDateString(entry.createdAt)
          ? entry.createdAt
          : undefined,
        updatedAt: isValidDateString(entry.updatedAt)
          ? entry.updatedAt
          : undefined,
        syncState: 'synced' as const,
      },
    ];
  });
}

function mergeLegacyAndCanonicalHistory(
  legacy: PrimingHistoryEntry[],
  canonical: PracticeSessionRecord[],
): PrimingHistoryEntry[] {
  const result = new Map<string, PrimingHistoryEntry>();
  canonical
    .filter((session) => session.practiceMode !== 'stabilize')
    .forEach((session) => {
      const anchorId =
        session.anchorId ?? session.anchorLocalId ?? session.anchorServerId;
      if (!anchorId) return;
      const entry = buildPrimingHistoryEntry({
        id: session.id,
        anchorId,
        type:
          session.practiceMode === 'focus'
            ? 'activate'
            : session.practiceMode === 'visualize'
              ? 'visualize'
              : 'reinforce',
        completedAt: session.completedAt,
      });
      if (entry) result.set(entry.id, entry);
    });
  legacy.forEach((entry) => {
    if (result.has(entry.id)) return;
    const duplicate = Array.from(result.values()).some(
      (candidate) =>
        candidate.anchorId === entry.anchorId &&
        candidate.type === entry.type &&
        Math.abs(
          new Date(candidate.completedAt).getTime() -
            new Date(entry.completedAt).getTime(),
        ) <= 5000,
    );
    if (!duplicate) result.set(entry.id, entry);
  });
  return Array.from(result.values()).sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
}

function buildPracticeHistory(
  activations: ExportActivation[],
  charges: ExportCharge[],
): PrimingHistoryEntry[] {
  // The first /activate transaction also writes an initial_quick Charge with
  // the exact same anchor/timestamp. Treat that pair as one practice event.
  const activationEventKeys = new Set(
    activations.map(
      (activation) => `${activation.anchorId}:${activation.activatedAt}`,
    ),
  );
  const activationClientEventIds = new Set(
    activations
      .map((activation) => activation.clientEventId)
      .filter((id): id is string => Boolean(id)),
  );
  const entries = new Map<string, PrimingHistoryEntry>();

  activations.forEach((activation) => {
    const entry = buildPrimingHistoryEntry({
      id: activation.clientEventId || activation.id,
      anchorId: activation.anchorId,
      type: activation.activationType === 'deep' ? 'reinforce' : 'activate',
      completedAt: activation.activatedAt,
    });
    if (entry) entries.set(entry.id, entry);
  });

  charges.forEach((charge) => {
    if (
      charge.completed === false ||
      (charge.clientEventId != null &&
        activationClientEventIds.has(charge.clientEventId)) ||
      activationEventKeys.has(`${charge.anchorId}:${charge.chargedAt}`)
    ) {
      return;
    }

    const entry = buildPrimingHistoryEntry({
      id: charge.clientEventId || charge.id,
      anchorId: charge.anchorId,
      type: 'reinforce',
      completedAt: charge.chargedAt,
    });
    if (entry) entries.set(entry.id, entry);
  });

  return Array.from(entries.values()).sort(
    (left, right) =>
      new Date(right.completedAt).getTime() -
      new Date(left.completedAt).getTime(),
  );
}

function readBurnedPracticeHistory(burnedAnchor: ExportBurnedAnchor): {
  activations: ExportActivation[];
  charges: ExportCharge[];
} {
  return {
    activations: readExportActivations(burnedAnchor.activationHistory).filter(
      (activation) => activation.anchorId === burnedAnchor.originalAnchorId,
    ),
    charges: readExportCharges(burnedAnchor.chargeHistory).filter(
      (charge) => charge.anchorId === burnedAnchor.originalAnchorId,
    ),
  };
}

function mapBurnedAnchorToArchive(burnedAnchor: ExportBurnedAnchor): Anchor {
  const { activations, charges } = readBurnedPracticeHistory(burnedAnchor);
  const practiceHistory = buildPracticeHistory(activations, charges);
  const completedCharges = charges.filter(
    (charge) => charge.completed !== false,
  );
  const chargeDates = completedCharges
    .map((charge) => normalizeDate(charge.chargedAt))
    .filter((date): date is Date => date != null)
    .sort((left, right) => left.getTime() - right.getTime());
  const latestPracticeAt = normalizeDate(practiceHistory[0]?.completedAt);
  const burnedAt = normalizeDate(burnedAnchor.burnedAt) ?? new Date();

  return {
    id: burnedAnchor.originalAnchorId,
    userId: burnedAnchor.userId,
    intentionText: burnedAnchor.intentionText,
    category: burnedAnchor.category as Anchor['category'],
    distilledLetters: burnedAnchor.distilledLetters,
    baseSigilSvg: burnedAnchor.baseSigilSvg ?? '',
    enhancedImageUrl: burnedAnchor.enhancedImageUrl ?? undefined,
    structureVariant: 'balanced',
    isCharged: burnedAnchor.activationCount > 0 || practiceHistory.length > 0,
    chargeCount: completedCharges.length,
    chargedAt: chargeDates[chargeDates.length - 1],
    firstChargedAt: chargeDates[0],
    // Keep the backend field's literal activation-only meaning. Lifetime
    // practice totals are derived from normalized activation + charge history.
    activationCount: burnedAnchor.activationCount,
    lastActivatedAt: latestPracticeAt,
    isReleased: true,
    releasedAt: burnedAt,
    archivedAt: burnedAt,
    createdAt: normalizeDate(burnedAnchor.createdAt) ?? burnedAt,
    updatedAt: burnedAt,
  };
}

interface HydrateOptions {
  skipAnchorRefresh?: boolean;
}

class AuthHydrationService {
  async hydrateAuthenticatedData(options: HydrateOptions = {}): Promise<void> {
    const authStore = useAuthStore.getState();
    let expectedUserId = authStore.user?.id ?? null;
    const isCurrentAccount = () => {
      const currentUserId = useAuthStore.getState().user?.id ?? null;
      return expectedUserId
        ? currentUserId === expectedUserId
        : currentUserId == null;
    };
    const [profileResult, anchorsResult, exportResult] =
      await Promise.allSettled([
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

    if (!isCurrentAccount()) return;

    let normalizedProfileData: ProfileData | null = null;
    let remoteAnchors: Anchor[] = [];
    let exportAnchors: Anchor[] = [];
    let archivedAnchors: Anchor[] = [];
    let exportedBurnedAnchors: ExportBurnedAnchor[] = [];
    let primingHistory: PrimingHistoryEntry[] = [];
    let canonicalPracticeHistory: PracticeSessionRecord[] = [];
    let resolvedUserId = expectedUserId;

    if (profileResult.status === 'fulfilled') {
      normalizedProfileData = normalizeProfileData(profileResult.value);
      if (!isCurrentAccount()) return;
      if (expectedUserId && normalizedProfileData.user.id !== expectedUserId)
        return;
      expectedUserId = normalizedProfileData.user.id;
      resolvedUserId = normalizedProfileData.user.id;
      authStore.setUser(normalizedProfileData.user);
      useAuthStore.setState({
        profileData: normalizedProfileData,
        profileLastFetched: Date.now(),
        hasCompletedOnboarding: Boolean(
          normalizedProfileData.user.hasCompletedOnboarding,
        ),
        isOfflineMode: false,
      });
      useProfileStore.getState().syncFromUser(normalizedProfileData.user);
      applyProfileSettings(normalizedProfileData.user.settings);
      applyRemoteSessionAudioPreferences(
        normalizedProfileData.user.id,
        normalizedProfileData.user.settings,
      );
      // Trial clock + server expiry are synced centrally by authStore.setUser above.
    } else {
      logger.warn(
        '[AuthHydrationService] Profile hydration failed',
        profileResult.reason,
      );
    }

    if (!expectedUserId || !isCurrentAccount()) {
      throw new Error(
        'Authenticated hydration requires a stable account owner.',
      );
    }

    if (anchorsResult.status === 'fulfilled') {
      remoteAnchors = Array.isArray(anchorsResult.value.data?.data)
        ? anchorsResult.value.data.data.map(normalizeAnchor)
        : [];
    } else {
      logger.warn(
        '[AuthHydrationService] Anchor hydration failed',
        anchorsResult.reason,
      );
    }

    const exportData =
      exportResult.status === 'fulfilled'
        ? exportResult.value.data?.data
        : undefined;
    const hasCompleteExport = hasCompleteProgressionExport(exportData);
    const hasLegacyExport = hasLegacyPracticeExport(exportData);
    const hasInvalidV2Export = Boolean(
      exportData &&
      typeof exportData.exportVersion === 'number' &&
      exportData.exportVersion >= 2 &&
      !hasCompleteExport,
    );
    if (hasCompleteExport || hasLegacyExport) {
      const exportAccount = exportData?.account;
      exportAnchors = Array.isArray(exportAccount?.anchors)
        ? exportAccount.anchors
            .filter(
              (anchor): anchor is Anchor =>
                anchor != null && typeof anchor.id === 'string',
            )
            .map(normalizeAnchor)
        : [];
      exportedBurnedAnchors = hasCompleteExport
        ? readExportBurnedAnchors(exportData.burnedAnchors).filter(
            (burnedAnchor) =>
              resolvedUserId == null || burnedAnchor.userId === resolvedUserId,
          )
        : [];
      archivedAnchors = exportedBurnedAnchors.map(mapBurnedAnchorToArchive);

      const liveActivations = readExportActivations(exportAccount?.activations);
      const liveCharges = readExportCharges(exportAccount?.charges ?? []);
      const burnedPractice = exportedBurnedAnchors.reduce<{
        activations: ExportActivation[];
        charges: ExportCharge[];
      }>(
        (history, burnedAnchor) => {
          const burnedHistory = readBurnedPracticeHistory(burnedAnchor);
          history.activations.push(...burnedHistory.activations);
          history.charges.push(...burnedHistory.charges);
          return history;
        },
        { activations: [], charges: [] },
      );
      primingHistory = buildPracticeHistory(
        [...liveActivations, ...burnedPractice.activations],
        [...liveCharges, ...burnedPractice.charges],
      );
      if (resolvedUserId) {
        canonicalPracticeHistory = readCanonicalPracticeSessions(
          exportAccount?.practiceSessions,
          resolvedUserId,
        );
        primingHistory = mergeLegacyAndCanonicalHistory(
          primingHistory,
          canonicalPracticeHistory,
        );
        const sceneStore = useVisualizationSceneStore.getState();
        sceneStore.bindAccount(resolvedUserId);
        readVisualizationScenes(
          exportAccount?.visualizationScenes,
          resolvedUserId,
        ).forEach((scene) => sceneStore.setScene(scene));
      }
    } else {
      logger.warn(
        '[AuthHydrationService] Account export hydration failed or was incomplete',
        exportResult.status === 'rejected' ? exportResult.reason : undefined,
      );
    }

    const anchorSnapshot = resolvedUserId
      ? await loadAnchorSnapshot(resolvedUserId)
      : null;
    const profileSnapshot = resolvedUserId
      ? await loadProfileSnapshot(resolvedUserId)
      : null;
    if (!isCurrentAccount()) return;
    if (profileSnapshot) {
      useProfileStore.getState().updateProfile({
        ...profileSnapshot,
        ownerUserId: resolvedUserId,
      });
    }

    if (!options.skipAnchorRefresh) {
      const anchorStore = useAnchorStore.getState();
      const preservedLocalAnchors = anchorStore.anchors.filter(
        (anchor) => !isBackendAnchorId(anchor.id),
      );
      const burnedOriginalAnchorIds = new Set(
        exportedBurnedAnchors.map(
          (burnedAnchor) => burnedAnchor.originalAnchorId,
        ),
      );
      // A device snapshot may predate a server-confirmed burn. Never let that
      // stale active record resurrect an archived anchor during hydration.
      const normalizedSnapshotAnchors = (anchorSnapshot?.anchors ?? [])
        .map(normalizeAnchor)
        .filter((anchor) => !burnedOriginalAnchorIds.has(anchor.id));
      const shouldUseExportAnchors =
        (hasCompleteExport || hasLegacyExport) &&
        exportAnchors.length > 0 &&
        (anchorsResult.status === 'rejected' || remoteAnchors.length === 0);
      const shouldUseAnchorSnapshot =
        !hasInvalidV2Export &&
        !shouldUseExportAnchors &&
        normalizedSnapshotAnchors.length > 0 &&
        (anchorsResult.status === 'rejected' ||
          (remoteAnchors.length === 0 &&
            ((normalizedProfileData?.user.totalAnchorsCreated ?? 0) > 0 ||
              (authStore.user?.totalAnchorsCreated ?? 0) > 0)));

      const restoredAnchors = shouldUseExportAnchors
        ? exportAnchors
        : shouldUseAnchorSnapshot
          ? normalizedSnapshotAnchors
          : remoteAnchors;
      const nextAnchors = [
        ...restoredAnchors,
        ...archivedAnchors,
        ...preservedLocalAnchors,
      ];

      remoteAnchors = restoredAnchors;
      anchorStore.setAnchors(nextAnchors);

      if (shouldUseExportAnchors && nextAnchors.length > 0) {
        anchorStore.setCurrentAnchor(
          nextAnchors.find(
            (anchor) =>
              !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt,
          )?.id,
        );
      }

      if (shouldUseAnchorSnapshot && anchorSnapshot?.currentAnchorId) {
        anchorStore.setCurrentAnchor(anchorSnapshot.currentAnchorId);
      }

      const currentAnchor = nextAnchors.find(
        (anchor) => anchor.id === useAnchorStore.getState().currentAnchorId,
      );
      if (
        !currentAnchor ||
        currentAnchor.isReleased ||
        currentAnchor.releasedAt ||
        currentAnchor.archivedAt
      ) {
        anchorStore.setCurrentAnchor(
          restoredAnchors.find(
            (anchor) =>
              !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt,
          )?.id,
        );
      }

      if (
        !shouldUseExportAnchors &&
        !shouldUseAnchorSnapshot &&
        anchorsResult.status === 'fulfilled'
      ) {
        anchorStore.markSynced();
      }
    } else if (archivedAnchors.length > 0) {
      // Pending first-anchor finalization may skip active-anchor refresh, but
      // server-confirmed releases must still participate in lifetime Rank.
      const anchorStore = useAnchorStore.getState();
      const burnedIds = new Set(archivedAnchors.map((anchor) => anchor.id));
      anchorStore.setAnchors([
        ...anchorStore.anchors.filter((anchor) => !burnedIds.has(anchor.id)),
        ...archivedAnchors,
      ]);
    }

    const hydratedUser =
      normalizedProfileData?.user ?? useAuthStore.getState().user;
    if (
      hydratedUser ||
      primingHistory.length > 0 ||
      archivedAnchors.length > 0
    ) {
      const exportedLifetimeCount = [
        ...remoteAnchors,
        ...archivedAnchors,
      ].reduce((total, anchor) => total + (anchor.activationCount ?? 0), 0);
      const totalActivations = Math.max(
        hydratedUser?.totalActivations ?? 0,
        primingHistory.length,
        exportedLifetimeCount,
      );
      useSessionStore.getState().hydrateFromBackend({
        totalActivations,
        currentStreak: hydratedUser?.currentStreak ?? 0,
        anchors: remoteAnchors,
        primingHistory,
        practiceHistory: canonicalPracticeHistory,
      });
    }

    const sessionSnapshot = resolvedUserId
      ? await loadSessionSnapshot(resolvedUserId)
      : null;
    if (!isCurrentAccount()) return;
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
        useSessionStore.setState(
          sessionSnapshot as Partial<typeof sessionState>,
        );
      }
    }

    const restoredFromRemote =
      normalizedProfileData != null || anchorsResult.status === 'fulfilled';
    const restoredFromSnapshot =
      anchorSnapshot != null ||
      profileSnapshot != null ||
      sessionSnapshot != null;

    if (!restoredFromRemote && !restoredFromSnapshot) {
      const failureReasons = [
        profileResult.status === 'rejected' ? profileResult.reason : null,
        anchorsResult.status === 'rejected' ? anchorsResult.reason : null,
      ].filter(Boolean);
      throw failureReasons[0] instanceof Error
        ? failureReasons[0]
        : new Error('Authenticated hydration failed.');
    }

    if (!isCurrentAccount()) return;
    useAuthStore.getState().computeStreak();
    await initializeProgressionMilestonesFromStores();
  }

  /**
   * Self-healing thread/progress restore. Re-fetches the account export and
   * rehydrates the session store (priming history → thread counts/strength)
   * directly, so screens that show progress never depend solely on launch-time
   * hydration. Returns true when server progression was restored.
   */
  async rehydrateSessionFromExport(): Promise<boolean> {
    try {
      const initiatingUserId = useAuthStore.getState().user?.id;
      if (!initiatingUserId) return false;
      const exportResult = await apiClient.get<AccountExportResponse>(
        '/api/auth/me/export',
      );
      const exportData = exportResult.data?.data;
      if (
        useAuthStore.getState().user?.id !== initiatingUserId ||
        (!hasCompleteProgressionExport(exportData) &&
          !hasLegacyPracticeExport(exportData))
      ) {
        return false;
      }
      const exportAccount = exportData.account;
      const user = useAuthStore.getState().user;
      const burnedAnchors = readExportBurnedAnchors(
        exportData.burnedAnchors ?? [],
      ).filter(
        (burnedAnchor) => user?.id == null || burnedAnchor.userId === user.id,
      );
      const burnedPractice = burnedAnchors.reduce<{
        activations: ExportActivation[];
        charges: ExportCharge[];
      }>(
        (history, burnedAnchor) => {
          const burnedHistory = readBurnedPracticeHistory(burnedAnchor);
          history.activations.push(...burnedHistory.activations);
          history.charges.push(...burnedHistory.charges);
          return history;
        },
        { activations: [], charges: [] },
      );
      const legacyPrimingHistory = buildPracticeHistory(
        [
          ...readExportActivations(exportAccount?.activations),
          ...burnedPractice.activations,
        ],
        [
          ...readExportCharges(exportAccount?.charges),
          ...burnedPractice.charges,
        ],
      );
      const canonicalPracticeHistory = readCanonicalPracticeSessions(
        exportAccount?.practiceSessions,
        initiatingUserId,
      );
      const sceneStore = useVisualizationSceneStore.getState();
      sceneStore.bindAccount(initiatingUserId);
      readVisualizationScenes(
        exportAccount?.visualizationScenes,
        initiatingUserId,
      ).forEach((scene) => sceneStore.setScene(scene));
      const primingHistory = mergeLegacyAndCanonicalHistory(
        legacyPrimingHistory,
        canonicalPracticeHistory,
      );
      const exportedLifetimeCount = [
        ...(Array.isArray(exportAccount?.anchors) ? exportAccount.anchors : []),
        ...burnedAnchors,
      ].reduce(
        (total, anchor) =>
          total +
          (typeof anchor?.activationCount === 'number' &&
          Number.isFinite(anchor.activationCount)
            ? anchor.activationCount
            : 0),
        0,
      );
      const totalActivations = Math.max(
        user?.totalActivations ?? 0,
        primingHistory.length,
        exportedLifetimeCount,
      );

      if (totalActivations === 0) {
        return false;
      }

      const anchors = useAnchorStore.getState().anchors;

      useSessionStore.getState().hydrateFromBackend({
        totalActivations,
        currentStreak: user?.currentStreak ?? 0,
        anchors,
        primingHistory,
        practiceHistory: canonicalPracticeHistory,
      });
      return true;
    } catch (error) {
      logger.warn(
        '[AuthHydrationService] Session rehydrate from export failed',
        error,
      );
      return false;
    }
  }
}

export default new AuthHydrationService();
