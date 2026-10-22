import { apiClient, fetchCompleteProfile } from "@/services/ApiClient";
import { localContentFingerprint, localRecoveryCopy } from './anchorReconciliation';
import {
  loadAnchorSnapshot,
  loadProfileSnapshot,
  loadSessionSnapshot,
} from "@/services/UserLocalStateService";
import { useAnchorStore } from "@/stores/anchorStore";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSessionStore } from "@/stores/sessionStore";
import { sqlCipherEnabled } from '@/storage/sqlcipher/persistence';
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  Anchor,
  ApiResponse,
  ProfileData,
  User,
  UserSettings,
} from "@/types";
import { isBackendAnchorId } from "@/services/BackendAnchorService";
import {
  buildPrimingHistoryEntry,
  type PrimingHistoryEntry,
} from "@/utils/primingAnalytics";
import { logger } from "@/utils/logger";
import { HomeStartupProfiler } from "@/utils/homeStartupProfiler";
import { isAnchorV2Enabled } from "@/config/v2FeatureFlag";
import { prefetchHomeStartupData } from "@/services/v2/homeStartupPrefetch";
import { applyRemoteSessionAudioPreferences } from "@/services/SessionAudioPreferencesService";
import type {
  PracticeSessionRecord,
  VisualizationScene,
} from "@/types/practice";
import {
  normalizePracticeMode,
  type PracticeCompletionSource,
} from "@/types/practice";
import {
  getCompletionTimeContext,
  isValidLocalDateKey,
  PRACTICE_SESSION_SCHEMA_VERSION,
} from "@/utils/practiceTime";
import { useVisualizationSceneStore } from "@/stores/visualizationSceneStore";
import { AnalyticsEvents, AnalyticsService } from "@/services/AnalyticsService";

const reportedPracticeMigrations = new Set<string>();

function reportPracticeMigration(
  accountId: string,
  outcome: "completed" | "failed",
  properties: Record<string, string | number | boolean>,
): void {
  const key = `${accountId}:${outcome}`;
  if (reportedPracticeMigrations.has(key)) return;
  reportedPracticeMigrations.add(key);
  AnalyticsService.track(
    outcome === "completed"
      ? AnalyticsEvents.PRACTICE_DATA_MIGRATION_COMPLETED
      : AnalyticsEvents.PRACTICE_DATA_MIGRATION_FAILED,
    { migration_version: PRACTICE_SESSION_SCHEMA_VERSION, ...properties },
  );
}

function normalizeDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const anchorsWithMissingUpdatedAt = new WeakSet<Anchor>();

function isMarkedMissingUpdatedAt(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { __missingUpdatedAt?: boolean }).__missingUpdatedAt === true,
  );
}

function createMissingUpdatedAtDate(fallback?: Date): Date {
  const date = new Date(fallback ? fallback.getTime() : Date.now());
  Object.defineProperty(date, "__missingUpdatedAt", {
    value: true,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(date, "toJSON", {
    value: () => null,
    enumerable: false,
    configurable: true,
  });
  return date;
}

function markAnchorMissingUpdatedAt(anchor: Anchor, fallback?: Date): Anchor {
  const updatedAt = isMarkedMissingUpdatedAt(anchor.updatedAt)
    ? anchor.updatedAt
    : createMissingUpdatedAtDate(normalizeDate(anchor.updatedAt) ?? fallback);
  const marked: Anchor =
    anchor.updatedAt === updatedAt ? anchor : { ...anchor, updatedAt };
  if ("__missingUpdatedAt" in marked) {
    delete (marked as { __missingUpdatedAt?: boolean }).__missingUpdatedAt;
  }
  anchorsWithMissingUpdatedAt.add(marked);
  Object.defineProperty(marked, "__missingUpdatedAt", {
    value: true,
    enumerable: false,
    configurable: true,
  });
  return marked;
}

export function normalizeAnchor(anchor: Anchor): Anchor {
  const rawUpdatedAt = isMarkedMissingUpdatedAt(anchor.updatedAt)
    ? undefined
    : normalizeDate(anchor.updatedAt);
  const hadMissingUpdatedAt =
    !rawUpdatedAt ||
    anchorsWithMissingUpdatedAt.has(anchor) ||
    isMarkedMissingUpdatedAt(anchor) ||
    isMarkedMissingUpdatedAt(anchor.updatedAt);
  const createdAt = normalizeDate(anchor.createdAt) ?? new Date();
  const fallbackUpdatedAt = normalizeDate(anchor.updatedAt) ?? createdAt;
  const releasedAt = normalizeDate(anchor.releasedAt);
  const archivedAt =
    normalizeDate(anchor.archivedAt) ??
    ((anchor as { isArchived?: boolean }).isArchived === true
      ? (releasedAt ?? rawUpdatedAt ?? createdAt)
      : undefined);
  const isReleased =
    anchor.isReleased === true ||
    Boolean(releasedAt || archivedAt) ||
    anchor.isReleased;
  const normalized: Anchor = {
    ...anchor,
    createdAt,
    updatedAt: hadMissingUpdatedAt
      ? createMissingUpdatedAtDate(fallbackUpdatedAt)
      : rawUpdatedAt,
    chargedAt: normalizeDate(anchor.chargedAt),
    firstChargedAt: normalizeDate(anchor.firstChargedAt),
    ignitedAt: normalizeDate(anchor.ignitedAt),
    lastActivatedAt: normalizeDate(anchor.lastActivatedAt),
    ...(isReleased !== undefined ? { isReleased } : {}),
    releasedAt,
    archivedAt,
  };
  if ("__missingUpdatedAt" in normalized) {
    delete (normalized as { __missingUpdatedAt?: boolean }).__missingUpdatedAt;
  }
  if (hadMissingUpdatedAt) {
    markAnchorMissingUpdatedAt(normalized, fallbackUpdatedAt);
  }
  return normalized;
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
      normalized.visualizeSessionDuration === 600
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
  activationType: "visual" | "mantra" | "deep";
  durationSeconds?: number | null;
  activatedAt: string;
};

type ExportCharge = {
  id: string;
  clientEventId?: string | null;
  anchorId: string;
  chargeType: "initial_quick" | "initial_deep" | "recharge";
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
  data: AccountExportResponse["data"],
): data is NonNullable<AccountExportResponse["data"]> & {
  exportVersion: number;
  account: { anchors: Anchor[]; activations: unknown[]; charges: unknown[] };
  burnedAnchors: unknown[];
} {
  return Boolean(
    data &&
    typeof data.exportVersion === "number" &&
    data.exportVersion >= 2 &&
    data.account &&
    Array.isArray(data.account.anchors) &&
    Array.isArray(data.account.activations) &&
    Array.isArray(data.account.charges) &&
    Array.isArray(data.burnedAnchors),
  );
}

function hasLegacyPracticeExport(
  data: AccountExportResponse["data"],
): data is NonNullable<AccountExportResponse["data"]> & {
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
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function readExportActivations(value: unknown): ExportActivation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is ExportActivation => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.id === "string" &&
      (entry.clientEventId == null ||
        typeof entry.clientEventId === "string") &&
      typeof entry.anchorId === "string" &&
      (entry.activationType === "visual" ||
        entry.activationType === "mantra" ||
        entry.activationType === "deep") &&
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
      typeof entry.id === "string" &&
      (entry.clientEventId == null ||
        typeof entry.clientEventId === "string") &&
      typeof entry.anchorId === "string" &&
      (entry.chargeType === "initial_quick" ||
        entry.chargeType === "initial_deep" ||
        entry.chargeType === "recharge") &&
      (entry.completed === undefined || typeof entry.completed === "boolean") &&
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
      typeof entry.id === "string" &&
      typeof entry.originalAnchorId === "string" &&
      typeof entry.userId === "string" &&
      typeof entry.intentionText === "string" &&
      typeof entry.category === "string" &&
      Array.isArray(entry.distilledLetters) &&
      entry.distilledLetters.every((letter) => typeof letter === "string") &&
      typeof entry.activationCount === "number" &&
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
      typeof entry.id !== "string" ||
      !isValidDateString(entry.startedAt) ||
      !isValidDateString(entry.completedAt)
    )
      return [];
    const practiceMode = normalizePracticeMode(entry.practiceMode);
    if (!practiceMode) return [];
    if (
      typeof entry.plannedDurationSeconds !== "number" ||
      typeof entry.completedDurationSeconds !== "number"
    )
      return [];
    const completedAt = entry.completedAt;
    const timeContext = getCompletionTimeContext(new Date(completedAt));
    const completionSource: PracticeCompletionSource = [
      "practice_screen",
      "anchor_detail",
      "notification",
      "widget",
      "deep_link",
      "restored",
      "unknown",
    ].includes(String(entry.completionSource))
      ? (entry.completionSource as PracticeCompletionSource)
      : "restored";
    return [
      {
        id: entry.id,
        accountId,
        anchorId: typeof entry.anchorId === "string" ? entry.anchorId : null,
        anchorLocalId:
          typeof entry.anchorLocalId === "string" ? entry.anchorLocalId : null,
        anchorServerId:
          typeof entry.anchorServerIdSnapshot === "string"
            ? entry.anchorServerIdSnapshot
            : null,
        practiceMode,
        plannedDurationSeconds: entry.plannedDurationSeconds,
        completedDurationSeconds: entry.completedDurationSeconds,
        completionStatus: "completed" as const,
        startedAt: entry.startedAt,
        completedAt,
        localDateKey:
          typeof entry.localDateKey === "string" &&
          isValidLocalDateKey(entry.localDateKey)
            ? entry.localDateKey
            : timeContext.localDateKey,
        timeZone:
          typeof entry.timeZone === "string" && entry.timeZone.length <= 100
            ? entry.timeZone
            : timeContext.timeZone,
        utcOffsetMinutesAtCompletion:
          typeof entry.utcOffsetMinutesAtCompletion === "number" &&
          Number.isInteger(entry.utcOffsetMinutesAtCompletion)
            ? entry.utcOffsetMinutesAtCompletion
            : timeContext.utcOffsetMinutesAtCompletion,
        completionSource,
        schemaVersion:
          typeof entry.schemaVersion === "number" &&
          Number.isInteger(entry.schemaVersion)
            ? entry.schemaVersion
            : PRACTICE_SESSION_SCHEMA_VERSION,
        legacyType:
          typeof entry.legacyType === "string" ? entry.legacyType : null,
        guidanceVoice:
          entry.guidanceVoice === "male" || entry.guidanceVoice === "none"
            ? entry.guidanceVoice
            : "female",
        backgroundAudio:
          entry.backgroundAudio === "off"
            ? ("off" as const)
            : ("ambient" as const),
        sceneSnapshot:
          typeof entry.sceneSnapshot === "string" ? entry.sceneSnapshot : null,
        nextAction:
          typeof entry.nextAction === "string" ? entry.nextAction : null,
        clientVersion:
          typeof entry.clientVersion === "string" ? entry.clientVersion : null,
        metadata: isRecord(entry.metadata) ? entry.metadata : undefined,
        syncState: "synced" as const,
      },
    ];
  });
}

/**
 * Accounts whose practice history predates the canonical practice ledger
 * (commit 7cb8f97) have real sessions in legacy activations/charges that the
 * backend export never backfilled into `practiceSessions`. Thread Strength
 * reads exclusively from canonical `practiceHistory`, so without this those
 * accounts' export-restored history is permanently invisible there even
 * though `primingHistory` (legacy) has it. Mirrors the on-device v3->v4
 * persist migration in sessionStore.ts, but for server-restored data that
 * never went through that local migration.
 *
 * Focus/Deep Prime sessions recorded after the ledger shipped are
 * dual-written to both `practiceSession` and the legacy activation/charge
 * tables (see backend practice.ts), so they surface in `entries` too. Id
 * dedup can't catch that — the two rows have different ids for the same
 * event — so this matches the same anchor/type within a few seconds of an
 * existing canonical entry, the same proximity check
 * `mergeLegacyAndCanonicalHistory` uses in the other direction.
 */
function synthesizeCanonicalFromLegacyPriming(
  entries: PrimingHistoryEntry[],
  accountId: string,
  existingCanonical: PracticeSessionRecord[],
): PracticeSessionRecord[] {
  const legacyTypeOf = (mode: PracticeSessionRecord["practiceMode"]) =>
    mode === "deep_prime" ? "reinforce" : mode === "visualize" ? "visualize" : "activate";
  return entries.flatMap((entry) => {
    const hasCanonicalCounterpart = existingCanonical.some(
      (candidate) =>
        candidate.anchorId === entry.anchorId &&
        legacyTypeOf(candidate.practiceMode) === entry.type &&
        Math.abs(
          new Date(candidate.completedAt).getTime() -
            new Date(entry.completedAt).getTime(),
        ) <= 5000,
    );
    if (hasCanonicalCounterpart) return [];
    const practiceMode =
      entry.type === "reinforce"
        ? "deep_prime"
        : entry.type === "visualize"
          ? "visualize"
          : "focus";
    const durationSeconds =
      entry.type === "reinforce" ? 120 : entry.type === "visualize" ? 180 : 30;
    return [
      {
        id: entry.id,
        accountId,
        anchorId: entry.anchorId,
        anchorLocalId: null,
        anchorServerId: entry.anchorId,
        practiceMode,
        plannedDurationSeconds: durationSeconds,
        completedDurationSeconds: durationSeconds,
        completionStatus: "completed" as const,
        startedAt: entry.completedAt,
        completedAt: entry.completedAt,
        ...getCompletionTimeContext(new Date(entry.completedAt)),
        completionSource: "restored" as const,
        schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
        legacyType: entry.type,
        guidanceVoice: "none" as const,
        backgroundAudio: "off" as const,
        sceneSnapshot: null,
        nextAction: null,
        clientVersion: null,
        syncState: "synced" as const,
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
      typeof entry.anchorId !== "string" ||
      typeof entry.currentText !== "string" ||
      typeof entry.originalSuggestion !== "string" ||
      !isValidDateString(entry.clientUpdatedAt)
    )
      return [];
    return [
      {
        id: typeof entry.id === "string" ? entry.id : undefined,
        accountId,
        anchorId: entry.anchorId,
        anchorLocalId: null,
        currentText: entry.currentText,
        originalSuggestion: entry.originalSuggestion,
        generationSource:
          entry.generationSource === "gemini" ||
          entry.generationSource === "user_edited"
            ? entry.generationSource
            : "deterministic_fallback",
        generationVersion:
          typeof entry.generationVersion === "string"
            ? entry.generationVersion
            : "scene-v1",
        clientUpdatedAt: entry.clientUpdatedAt,
        createdAt: isValidDateString(entry.createdAt)
          ? entry.createdAt
          : undefined,
        updatedAt: isValidDateString(entry.updatedAt)
          ? entry.updatedAt
          : undefined,
        syncState: "synced" as const,
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
    .filter((session) => session.practiceMode !== "release")
    .forEach((session) => {
      const anchorId =
        session.anchorId ?? session.anchorLocalId ?? session.anchorServerId;
      if (!anchorId) return;
      const entry = buildPrimingHistoryEntry({
        id: session.id,
        anchorId,
        type:
          session.practiceMode === "focus"
            ? "activate"
            : session.practiceMode === "visualize"
              ? "visualize"
              : "reinforce",
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
      type: activation.activationType === "deep" ? "reinforce" : "activate",
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
      type: "reinforce",
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
    category: burnedAnchor.category as Anchor["category"],
    distilledLetters: burnedAnchor.distilledLetters,
    baseSigilSvg: burnedAnchor.baseSigilSvg ?? "",
    enhancedImageUrl: burnedAnchor.enhancedImageUrl ?? undefined,
    structureVariant: "balanced",
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

const GUEST_USER_IDS = new Set([
  "guest",
  "guest-user",
  "user-local",
  "local-user",
]);

type PendingFirstAnchorDraftState = ReturnType<
  typeof useAuthStore.getState
>["pendingFirstAnchorDraft"];

function isGuestOwnedAnchor(anchor: Anchor): boolean {
  if (anchor.userId && GUEST_USER_IDS.has(anchor.userId)) {
    return true;
  }
  return (
    anchor.id.startsWith("pending-first-anchor-") ||
    Boolean(anchor.localId?.startsWith("pending-first-anchor-"))
  );
}

function isAuthorizedPendingFirstAnchorTransfer(
  anchor: Anchor,
  pendingFirstAnchorDraft: PendingFirstAnchorDraftState,
): boolean {
  if (!pendingFirstAnchorDraft) {
    return false;
  }
  const matchesTempId =
    Boolean(pendingFirstAnchorDraft.tempAnchorId) &&
    (anchor.id === pendingFirstAnchorDraft.tempAnchorId ||
      anchor.localId === pendingFirstAnchorDraft.tempAnchorId);
  const matchesBackendId =
    Boolean(pendingFirstAnchorDraft.backendAnchorId) &&
    (anchor.id === pendingFirstAnchorDraft.backendAnchorId ||
      anchor.localId === pendingFirstAnchorDraft.backendAnchorId);
  return matchesTempId || matchesBackendId;
}

function canPreserveAnchorForUser(params: {
  anchor: Anchor;
  ownerUserId?: string | null;
  pendingFirstAnchorDraft?: PendingFirstAnchorDraftState;
}): boolean {
  const { anchor, ownerUserId, pendingFirstAnchorDraft } = params;
  if (isGuestOwnedAnchor(anchor)) {
    return isAuthorizedPendingFirstAnchorTransfer(
      anchor,
      pendingFirstAnchorDraft ?? null,
    );
  }
  if (ownerUserId && anchor.userId === ownerUserId) {
    return true;
  }
  return false;
}

function hasMissingUpdatedAt(anchor: Anchor): boolean {
  if (anchorsWithMissingUpdatedAt.has(anchor)) {
    return true;
  }
  if (
    isMarkedMissingUpdatedAt(anchor) ||
    isMarkedMissingUpdatedAt(anchor.updatedAt)
  ) {
    return true;
  }
  return !normalizeDate(anchor.updatedAt);
}

function getAnchorTimestampMs(anchor: Anchor): number {
  if (hasMissingUpdatedAt(anchor)) {
    return Number.NaN;
  }
  const parsed = normalizeDate(anchor.updatedAt)?.getTime() ?? Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function mergeAnchorWithNewerLocalState(
  remoteAnchor: Anchor,
  localAnchors: Anchor[],
  pendingFirstAnchorDraft?: PendingFirstAnchorDraftState,
  priorEvidence = new Map<string, Anchor['localReconciliation']>(),
): Anchor {
  const matchesPendingBackendDraft = Boolean(
    pendingFirstAnchorDraft?.backendAnchorId &&
      pendingFirstAnchorDraft.tempAnchorId &&
      remoteAnchor.id === pendingFirstAnchorDraft.backendAnchorId,
  );
  const localMatch = localAnchors.find(
    (local) =>
      local.id === remoteAnchor.id ||
      (remoteAnchor.localId != null && local.id === remoteAnchor.localId) ||
      (local.localId != null && local.localId === remoteAnchor.id) ||
      (matchesPendingBackendDraft &&
        (local.id === pendingFirstAnchorDraft?.tempAnchorId ||
          local.localId === pendingFirstAnchorDraft?.tempAnchorId)),
  );
  if (!localMatch) {
    return remoteAnchor;
  }

  const remoteIsReleased = Boolean(
    remoteAnchor.isReleased ||
      remoteAnchor.releasedAt ||
      remoteAnchor.archivedAt,
  );
  const localHasMissingUpdatedAt = hasMissingUpdatedAt(localMatch);
  const localUpdatedAt = getAnchorTimestampMs(localMatch);
  const remoteUpdatedAt = getAnchorTimestampMs(remoteAnchor);
  const evidence = localMatch.localReconciliation;
  // Evidence is captured before this hydration. Fast-list/export reads within one
  // request cannot turn an unresolved local copy into an acknowledged sync.
  const previous = priorEvidence.get(localMatch.id);
  const changedSinceObservation = Boolean(localHasMissingUpdatedAt && previous?.observedLocalFingerprint &&
    previous.observedLocalFingerprint !== localContentFingerprint(localMatch));
  const observedAt = previous?.observedServerUpdatedAt
    ? new Date(previous.observedServerUpdatedAt).getTime() : Number.NaN;
  const canAdvanceUnknownRevision = localHasMissingUpdatedAt && !remoteIsReleased &&
    !matchesPendingBackendDraft && !evidence?.pendingLocalMutation && !changedSinceObservation &&
    Number.isFinite(remoteUpdatedAt) && Number.isFinite(observedAt) && remoteUpdatedAt > observedAt &&
    previous?.observedLocalFingerprint === localContentFingerprint(localMatch);
  if (canAdvanceUnknownRevision) {
    return {
      ...remoteAnchor,
      localId: remoteAnchor.localId ?? localMatch.localId,
      ...(localMatch.evolvedFrom ? { evolvedFrom: localMatch.evolvedFrom } : {}),
      localReconciliation: { recoveryCopy: evidence?.recoveryCopy ?? localRecoveryCopy(localMatch) },
    };
  }
  const shouldKeepLocalState =
    (!remoteIsReleased && Boolean(evidence?.pendingLocalMutation || changedSinceObservation)) ||
    !Number.isFinite(localUpdatedAt) ||
    !Number.isFinite(remoteUpdatedAt) ||
    localUpdatedAt >= remoteUpdatedAt;

  if (shouldKeepLocalState) {
    const definedLocalEntries = Object.entries(localMatch).filter(
      ([, value]) => value !== undefined,
    );
    const localLastActivatedMs =
      normalizeDate(localMatch.lastActivatedAt)?.getTime() ?? Number.NaN;
    const remoteLastActivatedMs =
      normalizeDate(remoteAnchor.lastActivatedAt)?.getTime() ?? Number.NaN;
    const resolvedLastActivatedAt =
      Number.isFinite(localLastActivatedMs) &&
      Number.isFinite(remoteLastActivatedMs)
        ? localLastActivatedMs >= remoteLastActivatedMs
          ? normalizeDate(localMatch.lastActivatedAt)
          : normalizeDate(remoteAnchor.lastActivatedAt)
        : (normalizeDate(localMatch.lastActivatedAt) ??
          normalizeDate(remoteAnchor.lastActivatedAt));
    const fallbackUpdatedAt =
      normalizeDate(remoteAnchor.updatedAt) ??
      normalizeDate(localMatch.createdAt) ??
      remoteAnchor.createdAt;
    const resolvedUpdatedAt = localHasMissingUpdatedAt
      ? createMissingUpdatedAtDate(fallbackUpdatedAt)
      : (normalizeDate(localMatch.updatedAt) ?? remoteAnchor.updatedAt);

    const merged: Anchor = {
      ...remoteAnchor,
      ...Object.fromEntries(definedLocalEntries),
      id: remoteAnchor.id,
      userId: remoteAnchor.userId || localMatch.userId,
      localId:
        remoteAnchor.localId ??
        localMatch.localId ??
        (matchesPendingBackendDraft
          ? pendingFirstAnchorDraft?.tempAnchorId
          : undefined),
      updatedAt: resolvedUpdatedAt,
      isCharged: Boolean(remoteAnchor.isCharged || localMatch.isCharged),
      chargedAt:
        normalizeDate(localMatch.chargedAt) ??
        normalizeDate(remoteAnchor.chargedAt),
      firstChargedAt:
        normalizeDate(remoteAnchor.firstChargedAt) ??
        normalizeDate(localMatch.firstChargedAt),
      ignitedAt:
        normalizeDate(localMatch.ignitedAt) ??
        normalizeDate(remoteAnchor.ignitedAt),
      lastActivatedAt: resolvedLastActivatedAt,
      activationCount: Math.max(
        remoteAnchor.activationCount ?? 0,
        localMatch.activationCount ?? 0,
      ),
      chargeCount: Math.max(
        remoteAnchor.chargeCount ?? 0,
        localMatch.chargeCount ?? 0,
      ),
      ...(remoteIsReleased
        ? {
            isReleased: true,
            releasedAt:
              normalizeDate(remoteAnchor.releasedAt) ??
              normalizeDate(localMatch.releasedAt) ??
              normalizeDate(remoteAnchor.archivedAt),
            archivedAt:
              normalizeDate(remoteAnchor.archivedAt) ??
              normalizeDate(localMatch.archivedAt) ??
              normalizeDate(remoteAnchor.releasedAt),
          }
        : {}),
    };

    if (localHasMissingUpdatedAt && !remoteIsReleased) {
      merged.localReconciliation = {
        ...evidence,
        ...(changedSinceObservation ? { pendingLocalMutation: true } : {}),
        recoveryCopy: evidence?.recoveryCopy ?? localRecoveryCopy(localMatch),
        ...(Number.isFinite(remoteUpdatedAt) ? {
          observedServerUpdatedAt: new Date(Math.max(remoteUpdatedAt, Number.isFinite(observedAt) ? observedAt : remoteUpdatedAt)).toISOString(),
          observedLocalFingerprint: localContentFingerprint(merged),
        } : {}),
      };
      return markAnchorMissingUpdatedAt(merged, fallbackUpdatedAt);
    }

    return merged;
  }

  return { ...remoteAnchor, ...(evidence ? { localReconciliation: evidence } : {}) };
}

function selectPreservedLocalAnchors(params: {
  currentAnchors: Anchor[];
  committedAnchors: Anchor[];
  burnedOriginalAnchorIds?: Set<string>;
  initialBackendAnchorIds: Set<string>;
  ownerUserId?: string | null;
  pendingFirstAnchorDraft?: PendingFirstAnchorDraftState;
}): Anchor[] {
  const {
    currentAnchors,
    committedAnchors,
    burnedOriginalAnchorIds,
    initialBackendAnchorIds,
    ownerUserId,
    pendingFirstAnchorDraft,
  } = params;
  const committedIds = new Set<string>();
  for (const anchor of committedAnchors) {
    committedIds.add(anchor.id);
    if (anchor.localId) {
      committedIds.add(anchor.localId);
    }
  }
  if (
    pendingFirstAnchorDraft?.backendAnchorId &&
    pendingFirstAnchorDraft.tempAnchorId &&
    committedIds.has(pendingFirstAnchorDraft.backendAnchorId)
  ) {
    committedIds.add(pendingFirstAnchorDraft.tempAnchorId);
  }

  return currentAnchors.filter((anchor) => {
    if (committedIds.has(anchor.id)) {
      return false;
    }
    if (anchor.localId && committedIds.has(anchor.localId)) {
      return false;
    }
    if (burnedOriginalAnchorIds?.has(anchor.id)) {
      return false;
    }
    if (anchor.localId && burnedOriginalAnchorIds?.has(anchor.localId)) {
      return false;
    }
    if (
      !canPreserveAnchorForUser({
        anchor,
        ownerUserId,
        pendingFirstAnchorDraft,
      })
    ) {
      return false;
    }
    if (!isBackendAnchorId(anchor.id)) {
      return true;
    }
    // Preserve backend-ID anchors created locally while hydration was in flight.
    if (!initialBackendAnchorIds.has(anchor.id)) {
      return true;
    }
    return false;
  });
}

interface HydrateOptions {
  skipAnchorRefresh?: boolean;
}

class AuthHydrationService {
  private latestHydrationId = 0;

  async hydrateAuthenticatedData(options: HydrateOptions = {}): Promise<void> {
    const hydrationId = ++this.latestHydrationId;
    const authStore = useAuthStore.getState();
    let expectedUserId = authStore.user?.id ?? null;
    const initialToken = authStore.token ?? null;
    let initialAccountRevision = authStore.accountRevision;
    if (expectedUserId) {
      const currentAnchorStore = useAnchorStore.getState();
      currentAnchorStore.bindAccount(expectedUserId, authStore.pendingFirstAnchorDraft?.tempAnchorId);
      const sanitizedAnchors = currentAnchorStore.anchors.filter((anchor) =>
        canPreserveAnchorForUser({
          anchor,
          ownerUserId: expectedUserId,
          pendingFirstAnchorDraft: authStore.pendingFirstAnchorDraft,
        }),
      );
      if (sanitizedAnchors.length !== currentAnchorStore.anchors.length) {
        currentAnchorStore.setAnchors(sanitizedAnchors);
        if (
          currentAnchorStore.currentAnchorId &&
          !sanitizedAnchors.some(
            (anchor) =>
              anchor.id === currentAnchorStore.currentAnchorId ||
              anchor.localId === currentAnchorStore.currentAnchorId,
          )
        ) {
          currentAnchorStore.setCurrentAnchor(sanitizedAnchors[0]?.id);
        }
      }
    }
    const initialBackendAnchorIds = new Set(
      useAnchorStore
        .getState()
        .anchors.filter((anchor) => isBackendAnchorId(anchor.id))
        .map((anchor) => anchor.id),
    );
    const priorReconciliationEvidence = new Map(useAnchorStore.getState().anchors.map(
      (anchor) => [anchor.id, anchor.localReconciliation] as const,
    ));
    if (!options.skipAnchorRefresh) {
      useAnchorStore.setState({ isLoading: true, remoteAnchorState: 'loading', error: null });
    }
    const isCurrentAccount = () => {
      if (this.latestHydrationId !== hydrationId) {
        return false;
      }
      const currentAuth = useAuthStore.getState();
      if (currentAuth.accountRevision !== initialAccountRevision) return false;
      if (initialToken && currentAuth.token && currentAuth.token !== initialToken) {
        return false;
      }
      const currentUserId = currentAuth.user?.id ?? null;
      return expectedUserId
        ? currentUserId === expectedUserId
        : currentUserId == null;
    };
    const profileRequest = fetchCompleteProfile();
    const anchorSpan = HomeStartupProfiler.start("anchors_request");
    const anchorsRequest = apiClient.get<ApiResponse<Anchor[]>>("/api/anchors", {
      params: { limit: 100, orderBy: "updatedAt", order: "desc" },
    }).then((response) => {
      const responseAnchors = response.data?.data;
      if (!Array.isArray(responseAnchors)) {
        anchorSpan({ ok: false, responseShapeValid: false });
        if (isCurrentAccount() && !options.skipAnchorRefresh) {
          useAnchorStore.setState({ isLoading: false, remoteAnchorState: 'error', error: 'Unable to load your Anchors.' });
        }
        throw new Error('Anchor response did not contain an authoritative list.');
      }

      const currentPendingFirstAnchorDraft =
        useAuthStore.getState().pendingFirstAnchorDraft;
      const fastAnchors = responseAnchors
        .map(normalizeAnchor)
        .filter((anchor) =>
          canPreserveAnchorForUser({
            anchor,
            ownerUserId: expectedUserId,
            pendingFirstAnchorDraft: currentPendingFirstAnchorDraft,
          }),
        );
      anchorSpan({ ok: true, anchorCount: fastAnchors.length });
      if (expectedUserId && isCurrentAccount() && !options.skipAnchorRefresh) {
        const anchorStore = useAnchorStore.getState();
        if (fastAnchors.length > 0) {
          const mergedFastAnchors = fastAnchors.map((anchor) =>
            mergeAnchorWithNewerLocalState(
              anchor,
              anchorStore.anchors,
              currentPendingFirstAnchorDraft,
              priorReconciliationEvidence,
            ),
          );
          const preservedLocalAnchors = selectPreservedLocalAnchors({
            currentAnchors: anchorStore.anchors,
            committedAnchors: mergedFastAnchors,
            initialBackendAnchorIds,
            ownerUserId: expectedUserId,
            pendingFirstAnchorDraft: currentPendingFirstAnchorDraft,
          });
          const nextAnchors = [...mergedFastAnchors, ...preservedLocalAnchors];
          anchorStore.setAnchors(nextAnchors);
          const activeAnchors = nextAnchors.filter((anchor) => !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt);
          const selectedAnchor = activeAnchors.find((anchor) =>
            anchor.id === anchorStore.currentAnchorId || anchor.localId === anchorStore.currentAnchorId
          ) ?? activeAnchors[0];
          if (selectedAnchor && selectedAnchor.id !== anchorStore.currentAnchorId) {
            anchorStore.setCurrentAnchor(selectedAnchor.id);
          }
          if (activeAnchors.length > 0) {
            useAnchorStore.setState({ isLoading: false, remoteAnchorState: 'confirmed', error: null });
          }
          HomeStartupProfiler.mark('anchors_early_committed', { anchorCount: nextAnchors.length, activeAnchorCount: activeAnchors.length });
          if (
            selectedAnchor &&
            isAnchorV2Enabled(
              process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
              __DEV__,
              process.env.EXPO_PUBLIC_APP_ENV,
            )
          ) {
            prefetchHomeStartupData(selectedAnchor.id);
          }
        }
      }
      return response;
    }, (error: unknown) => {
      anchorSpan({ ok: false });
      if (expectedUserId && isCurrentAccount() && !options.skipAnchorRefresh) {
        useAnchorStore.setState({
          isLoading: false,
          remoteAnchorState: 'error',
          error: error instanceof Error ? error.message : 'Unable to load your Anchors.',
        });
      }
      throw error;
    });
    const exportSpan = HomeStartupProfiler.start("account_export_request");
    const exportRequest = apiClient.get<AccountExportResponse>("/api/auth/me/export").then((response) => {
      exportSpan({ ok: true });
      return response;
    }, (error: unknown) => {
      exportSpan({ ok: false });
      throw error;
    });
    const profileSpan = HomeStartupProfiler.start("profile_request");
    const timedProfileRequest = profileRequest.then((response) => {
      profileSpan({ ok: true });
      return response;
    }, (error: unknown) => {
      profileSpan({ ok: false });
      throw error;
    });

    const [profileResult, anchorsResult, exportResult] =
      await Promise.allSettled([timedProfileRequest, anchorsRequest, exportRequest]);

    if (!isCurrentAccount()) return;

    let normalizedProfileData: ProfileData | null = null;
    let remoteAnchors: Anchor[] = [];
    let exportAnchors: Anchor[] = [];
    let archivedAnchors: Anchor[] = [];
    let exportedBurnedAnchors: ExportBurnedAnchor[] = [];
    let primingHistory: PrimingHistoryEntry[] = [];
    let canonicalPracticeHistory: PracticeSessionRecord[] = [];
    let resolvedUserId = expectedUserId;

    if (profileResult.status === "fulfilled") {
      normalizedProfileData = normalizeProfileData(profileResult.value);
      if (!isCurrentAccount()) return;
      if (expectedUserId && normalizedProfileData.user.id !== expectedUserId)
        return;
      expectedUserId = normalizedProfileData.user.id;
      resolvedUserId = normalizedProfileData.user.id;
      authStore.setUser(normalizedProfileData.user);
      // This invocation may establish the owner from its profile response.
      initialAccountRevision = useAuthStore.getState().accountRevision;
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
        "[AuthHydrationService] Profile hydration failed",
        profileResult.reason,
      );
    }

    if (!expectedUserId || !isCurrentAccount()) {
      throw new Error(
        "Authenticated hydration requires a stable account owner.",
      );
    }

    const activePendingFirstAnchorDraft =
      useAuthStore.getState().pendingFirstAnchorDraft;

    if (anchorsResult.status === "fulfilled") {
      remoteAnchors = Array.isArray(anchorsResult.value.data?.data)
        ? anchorsResult.value.data.data
            .map(normalizeAnchor)
            .filter((anchor) =>
              canPreserveAnchorForUser({
                anchor,
                ownerUserId: resolvedUserId,
                pendingFirstAnchorDraft: activePendingFirstAnchorDraft,
              }),
            )
        : [];
      HomeStartupProfiler.mark("anchors_response_decoded", { anchorCount: remoteAnchors.length });
    } else {
      logger.warn(
        "[AuthHydrationService] Anchor hydration failed",
        anchorsResult.reason,
      );
    }

    const exportData =
      exportResult.status === "fulfilled"
        ? exportResult.value.data?.data
        : undefined;
    const exportAccountOwnerId =
      typeof (exportData?.account as { id?: unknown } | undefined)?.id ===
      "string"
        ? (exportData?.account as { id: string }).id
        : undefined;
    const isForeignExportAccount = Boolean(
      exportAccountOwnerId &&
        resolvedUserId &&
        exportAccountOwnerId !== resolvedUserId,
    );
    const hasCompleteExport =
      !isForeignExportAccount && hasCompleteProgressionExport(exportData);
    const hasLegacyExport =
      !isForeignExportAccount && hasLegacyPracticeExport(exportData);
    const hasInvalidV2Export = Boolean(
      !isForeignExportAccount &&
        exportData &&
        typeof exportData.exportVersion === "number" &&
        exportData.exportVersion >= 2 &&
        !hasCompleteExport,
    );
    if (hasCompleteExport || hasLegacyExport) {
      const exportAccount = exportData?.account;
      const allExportAnchors = Array.isArray(exportAccount?.anchors)
        ? exportAccount.anchors
            .filter(
              (anchor): anchor is Anchor =>
                anchor != null && typeof anchor.id === "string",
            )
            .map(normalizeAnchor)
            .filter((anchor) =>
              canPreserveAnchorForUser({
                anchor,
                ownerUserId: resolvedUserId,
                pendingFirstAnchorDraft: activePendingFirstAnchorDraft,
              }),
            )
        : [];
      const releasedExportAnchors = allExportAnchors.filter((anchor) =>
        Boolean(anchor.isReleased || anchor.releasedAt || anchor.archivedAt),
      );
      exportAnchors = allExportAnchors.filter(
        (anchor) =>
          !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt,
      );
      exportedBurnedAnchors = hasCompleteExport
        ? readExportBurnedAnchors(exportData.burnedAnchors).filter(
            (burnedAnchor) =>
              resolvedUserId == null || burnedAnchor.userId === resolvedUserId,
          )
        : [];
      const mappedBurnedAnchors = exportedBurnedAnchors.map(
        mapBurnedAnchorToArchive,
      );
      const archivedById = new Map<string, Anchor>();
      for (const archived of mappedBurnedAnchors) {
        archivedById.set(archived.id, archived);
      }
      for (const released of releasedExportAnchors) {
        if (!archivedById.has(released.id)) {
          archivedById.set(released.id, released);
        }
      }
      archivedAnchors = Array.from(archivedById.values());

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
        canonicalPracticeHistory = [
          ...canonicalPracticeHistory,
          ...synthesizeCanonicalFromLegacyPriming(
            primingHistory,
            resolvedUserId,
            canonicalPracticeHistory,
          ),
        ];
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
        "[AuthHydrationService] Account export hydration failed or was incomplete",
        exportResult.status === "rejected" ? exportResult.reason : undefined,
      );
      if (resolvedUserId) {
        reportPracticeMigration(resolvedUserId, "failed", {
          reason: hasInvalidV2Export
            ? "incomplete_v2_export"
            : exportResult.status === "rejected"
              ? "export_request_failed"
              : "unsupported_export",
          export_version:
            exportData && typeof exportData.exportVersion === "number"
              ? exportData.exportVersion
              : 0,
        });
      }
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
      const previousAnchorError = anchorStore.error;
      const burnedOriginalAnchorIds = new Set<string>([
        ...exportedBurnedAnchors.map(
          (burnedAnchor) => burnedAnchor.originalAnchorId,
        ),
        ...archivedAnchors.map((anchor) => anchor.id),
      ]);
      remoteAnchors = remoteAnchors.filter(
        (anchor) => !burnedOriginalAnchorIds.has(anchor.id),
      );
      exportAnchors = exportAnchors.filter(
        (anchor) => !burnedOriginalAnchorIds.has(anchor.id),
      );
      const authoritativeServerIds = new Set<string>([
        ...remoteAnchors.map((anchor) => anchor.id),
        ...exportAnchors.map((anchor) => anchor.id),
      ]);
      // A device snapshot may predate a server-confirmed burn or deletion.
      // Never let a stale active record resurrect a retired/deleted anchor.
      const normalizedSnapshotAnchors = (anchorSnapshot?.anchors ?? [])
        .map(normalizeAnchor)
        .filter(
          (anchor) =>
            !burnedOriginalAnchorIds.has(anchor.id) &&
            !(anchor.localId && burnedOriginalAnchorIds.has(anchor.localId)) &&
            canPreserveAnchorForUser({
              anchor,
              ownerUserId: resolvedUserId,
              pendingFirstAnchorDraft: activePendingFirstAnchorDraft,
            }) &&
            !(
              anchorsResult.status === "fulfilled" &&
              hasCompleteExport &&
              isBackendAnchorId(anchor.id) &&
              !authoritativeServerIds.has(anchor.id)
            ),
        );
      const shouldUseExportAnchors =
        (hasCompleteExport || hasLegacyExport) &&
        exportAnchors.length > 0 &&
        (anchorsResult.status === "rejected" || remoteAnchors.length === 0);
      const shouldUseAnchorSnapshot =
        !hasInvalidV2Export &&
        !shouldUseExportAnchors &&
        normalizedSnapshotAnchors.length > 0 &&
        (anchorsResult.status === "rejected" ||
          (remoteAnchors.length === 0 &&
            ((normalizedProfileData?.user.totalAnchorsCreated ?? 0) > 0 ||
              (authStore.user?.totalAnchorsCreated ?? 0) > 0)));
      const shouldKeepExistingBackendAnchors =
        anchorsResult.status === "rejected" &&
        !shouldUseExportAnchors &&
        !shouldUseAnchorSnapshot;
      const fallbackExistingBackendAnchors = shouldKeepExistingBackendAnchors
        ? anchorStore.anchors.filter(
            (anchor) =>
              isBackendAnchorId(anchor.id) &&
              !burnedOriginalAnchorIds.has(anchor.id) &&
              !(anchor.localId && burnedOriginalAnchorIds.has(anchor.localId)) &&
              canPreserveAnchorForUser({
                anchor,
                ownerUserId: resolvedUserId,
                pendingFirstAnchorDraft: activePendingFirstAnchorDraft,
              }),
          )
        : [];

      const baseRestoredAnchors = shouldUseExportAnchors
        ? exportAnchors
        : shouldUseAnchorSnapshot
          ? normalizedSnapshotAnchors
          : shouldKeepExistingBackendAnchors
            ? fallbackExistingBackendAnchors
            : remoteAnchors;
      const restoredAnchors = baseRestoredAnchors.map((anchor) =>
        mergeAnchorWithNewerLocalState(
          anchor,
          anchorStore.anchors,
          activePendingFirstAnchorDraft,
          priorReconciliationEvidence,
        ),
      );
      const preservedLocalAnchors = selectPreservedLocalAnchors({
        currentAnchors: anchorStore.anchors,
        committedAnchors: [...restoredAnchors, ...archivedAnchors],
        burnedOriginalAnchorIds,
        initialBackendAnchorIds,
        ownerUserId: resolvedUserId,
        pendingFirstAnchorDraft: activePendingFirstAnchorDraft,
      });
      const nextAnchors = [
        ...restoredAnchors,
        ...archivedAnchors,
        ...preservedLocalAnchors,
      ];

      remoteAnchors = restoredAnchors;
      anchorStore.setAnchors(nextAnchors);
      HomeStartupProfiler.mark("anchors_committed", { anchorCount: nextAnchors.length, activeAnchorCount: nextAnchors.filter((anchor) => !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt).length });

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

      const previousCurrentAnchorId = useAnchorStore.getState().currentAnchorId;
      const currentAnchor = nextAnchors.find(
        (anchor) =>
          anchor.id === previousCurrentAnchorId ||
          (previousCurrentAnchorId != null &&
            anchor.localId === previousCurrentAnchorId),
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
          )?.id ??
            nextAnchors.find(
              (anchor) =>
                !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt,
            )?.id,
        );
      } else if (currentAnchor.id !== previousCurrentAnchorId) {
        anchorStore.setCurrentAnchor(currentAnchor.id);
      }

      if (
        !shouldUseExportAnchors &&
        !shouldUseAnchorSnapshot &&
        anchorsResult.status === "fulfilled"
      ) {
        anchorStore.markSynced();
      }

      if (shouldKeepExistingBackendAnchors) {
        useAnchorStore.setState({
          isLoading: false,
          remoteAnchorState: "error",
          error:
            previousAnchorError ??
            (anchorsResult.reason instanceof Error
              ? anchorsResult.reason.message
              : "Unable to load your Anchors."),
        });
      } else if (
        anchorsResult.status === "fulfilled" ||
        shouldUseExportAnchors ||
        shouldUseAnchorSnapshot
      ) {
        useAnchorStore.setState({
          isLoading: false,
          remoteAnchorState: "confirmed",
          error: null,
        });
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
      const strengthSpan = HomeStartupProfiler.start('thread_strength_hydration_calculation', { sessionCount: canonicalPracticeHistory.length });
      useSessionStore.getState().hydrateFromBackend({
        accountId: resolvedUserId ?? undefined,
        totalActivations,
        currentStreak: hydratedUser?.currentStreak ?? 0,
        anchors: remoteAnchors,
        primingHistory,
        practiceHistory: canonicalPracticeHistory,
      });
      strengthSpan({ strengthKnown: useSessionStore.getState().threadStrength !== null });
      HomeStartupProfiler.mark("progress_snapshot_committed", { sessionCount: canonicalPracticeHistory.length, primingCount: primingHistory.length });
      if (resolvedUserId) {
        reportPracticeMigration(resolvedUserId, "completed", {
          canonical_session_count: canonicalPracticeHistory.length,
          restored_history_count: primingHistory.length,
          included_released_anchors: archivedAnchors.length > 0,
        });
      }
    }

    const sessionSnapshotSpan = HomeStartupProfiler.start("session_snapshot_read");
    const sessionSnapshot = resolvedUserId
      ? await loadSessionSnapshot(resolvedUserId)
      : null;
    sessionSnapshotSpan({ found: Boolean(sessionSnapshot) });
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
      if (sqlCipherEnabled()) {
        const current = useSessionStore.getState().practiceHistory;
        const merged = new Map((sessionSnapshot.practiceHistory ?? []).map((event) => [event.id, event]));
        for (const event of current) if (event.accountId === resolvedUserId) merged.set(event.id, event);
        useSessionStore.setState({ practiceHistory: [...merged.values()].filter((event) => event.accountId === resolvedUserId) });
      }
    }

    const restoredFromRemote =
      normalizedProfileData != null || anchorsResult.status === "fulfilled";
    const restoredFromSnapshot =
      anchorSnapshot != null ||
      profileSnapshot != null ||
      sessionSnapshot != null;

    if (!restoredFromRemote && !restoredFromSnapshot) {
      const failureReasons = [
        profileResult.status === "rejected" ? profileResult.reason : null,
        anchorsResult.status === "rejected" ? anchorsResult.reason : null,
      ].filter(Boolean);
      throw failureReasons[0] instanceof Error
        ? failureReasons[0]
        : new Error("Authenticated hydration failed.");
    }

    if (!isCurrentAccount()) return;
    useAuthStore.getState().computeStreak();
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
        "/api/auth/me/export",
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
      let canonicalPracticeHistory = readCanonicalPracticeSessions(
        exportAccount?.practiceSessions,
        initiatingUserId,
      );
      canonicalPracticeHistory = [
        ...canonicalPracticeHistory,
        ...synthesizeCanonicalFromLegacyPriming(
          legacyPrimingHistory,
          initiatingUserId,
          canonicalPracticeHistory,
        ),
      ];
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
          (typeof anchor?.activationCount === "number" &&
          Number.isFinite(anchor.activationCount)
            ? anchor.activationCount
            : 0),
        0,
      );
      const totalActivations = Math.max(
        user?.totalActivations ?? 0,
        primingHistory.length,
        exportedLifetimeCount,
        canonicalPracticeHistory.length,
      );

      if (totalActivations === 0) {
        return false;
      }

      const anchors = useAnchorStore.getState().anchors;

      useSessionStore.getState().hydrateFromBackend({
        accountId: initiatingUserId,
        totalActivations,
        currentStreak: user?.currentStreak ?? 0,
        anchors,
        primingHistory,
        practiceHistory: canonicalPracticeHistory,
      });
      return true;
    } catch (error) {
      logger.warn(
        "[AuthHydrationService] Session rehydrate from export failed",
        error,
      );
      return false;
    }
  }
}

export default new AuthHydrationService();
