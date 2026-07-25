import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MILESTONE_DEFINITIONS,
  isMilestoneId,
  markMilestoneId,
  rankMilestoneId,
  type MarkMilestoneId,
  type MilestoneId,
  type RankMilestoneId,
} from '@/constants/milestones';
import { readSecureValue, writeSecureValue } from '@/stores/encryptedPersistStorage';
import {
  getEarnedMarkNames,
  getEarnedRankNames,
  getCurrentRank,
  type MarkName,
  type RankMetrics,
  type RankName,
} from '@/utils/progression';
import { toProgressionLocalDateString } from '@/utils/progressionTimezone';
import { hash32FNV1a } from '@/utils/hash';
import { logger } from '@/utils/logger';

const LEGACY_MILESTONE_KEY = 'anchor-milestone-dates';
const MILESTONE_LEDGER_PREFIX = 'anchor-milestones-v2';
export const DEVICE_LOCAL_MILESTONE_SCOPE = 'device-local';
export const MILESTONE_LEDGER_VERSION = 2;
export const PROGRESSION_BASELINE_VERSION = 1;
const PRE_LAUNCH_SENTINEL = 'pre-launch';

export interface MilestoneDates {
  rank: Partial<Record<RankName, string>>;
  mark: Partial<Record<MarkName, string>>;
}

export interface MilestoneRecordResult {
  rank: RankName[];
  mark: MarkName[];
  persistence: 'persisted' | 'unchanged' | 'failed';
}

export type MilestoneAwardStatus = 'pending' | 'shown' | 'dismissed';

export interface MilestoneAward {
  id: RankMilestoneId | MarkMilestoneId;
  definitionVersion: number;
  category: 'rank' | 'mark';
  name: RankName | MarkName;
  awardedAt: string;
  awardedLocalDate: string;
  status: MilestoneAwardStatus;
  shownAt?: string;
  dismissedAt?: string;
  sourceEventId?: string;
  presentation: {
    primeCount?: number;
    rankName?: RankName;
    markIndex?: number;
  };
}

export interface MilestoneLedger {
  version: typeof MILESTONE_LEDGER_VERSION;
  revision: number;
  scopeId: string;
  awards: Partial<Record<MilestoneId, MilestoneAward>>;
  outbox: Array<RankMilestoneId | MarkMilestoneId>;
  opaqueAwards?: Record<string, unknown>;
  opaqueOutbox?: unknown[];
  legacyMigratedAt?: string;
  progressionBaselineVersion?: number;
}

export type MilestoneBackfillResult = 'persisted' | 'unchanged' | 'failed';

export interface MilestoneRecordOptions {
  scopeId?: string;
  timezone?: string | null;
  sourceEventId?: string;
}

const EMPTY_MILESTONE_DATES: MilestoneDates = {
  rank: {},
  mark: {},
};

const listeners = new Set<() => void>();
let mutationChain: Promise<void> = Promise.resolve();

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Best-effort only.
    }
  });
}

function normalizedScopeId(scopeId?: string): string {
  return scopeId?.trim() || DEVICE_LOCAL_MILESTONE_SCOPE;
}

function isRankOrMarkMilestoneId(
  value: unknown
): value is RankMilestoneId | MarkMilestoneId {
  if (!isMilestoneId(value)) return false;
  const category = MILESTONE_DEFINITIONS[value].category;
  return category === 'rank' || category === 'mark';
}

export function getMilestoneLedgerStorageKey(scopeId?: string): string {
  const normalized = normalizedScopeId(scopeId);
  return `${MILESTONE_LEDGER_PREFIX}:${hash32FNV1a(normalized).toString(16)}`;
}

function emptyLedger(scopeId: string): MilestoneLedger {
  return {
    version: MILESTONE_LEDGER_VERSION,
    revision: 0,
    scopeId,
    awards: {},
    outbox: [],
  };
}

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationChain.catch(() => undefined).then(operation);
  mutationChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function sanitizeAward(id: MilestoneId, value: unknown): MilestoneAward | null {
  const definition = MILESTONE_DEFINITIONS[id];
  if (
    (definition.category !== 'rank' && definition.category !== 'mark') ||
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const raw = value as Partial<MilestoneAward>;
  const status: MilestoneAwardStatus =
    raw.status === 'pending' || raw.status === 'dismissed' ? raw.status : 'shown';
  const presentation: Partial<MilestoneAward['presentation']> =
    raw.presentation && typeof raw.presentation === 'object' ? raw.presentation : {};

  return {
    id: id as RankMilestoneId | MarkMilestoneId,
    definitionVersion:
      typeof raw.definitionVersion === 'number' ? raw.definitionVersion : definition.version,
    category: raw.category === definition.category ? raw.category : definition.category,
    name:
      typeof raw.name === 'string'
        ? (raw.name as RankName | MarkName)
        : (definition.name as RankName | MarkName),
    awardedAt: typeof raw.awardedAt === 'string' ? raw.awardedAt : PRE_LAUNCH_SENTINEL,
    awardedLocalDate:
      typeof raw.awardedLocalDate === 'string'
        ? raw.awardedLocalDate
        : PRE_LAUNCH_SENTINEL,
    status,
    shownAt: typeof raw.shownAt === 'string' ? raw.shownAt : undefined,
    dismissedAt: typeof raw.dismissedAt === 'string' ? raw.dismissedAt : undefined,
    sourceEventId: typeof raw.sourceEventId === 'string' ? raw.sourceEventId : undefined,
    presentation: {
      primeCount:
        typeof presentation.primeCount === 'number' ? presentation.primeCount : undefined,
      rankName:
        typeof presentation.rankName === 'string'
          ? (presentation.rankName as RankName)
          : undefined,
      markIndex:
        typeof presentation.markIndex === 'number' ? presentation.markIndex : undefined,
    },
  };
}

function sanitizeLedger(value: unknown, scopeId: string): MilestoneLedger {
  if (!value || typeof value !== 'object') {
    return emptyLedger(scopeId);
  }

  const raw = value as Partial<MilestoneLedger>;
  if (raw.version !== MILESTONE_LEDGER_VERSION) {
    throw new Error(`Unsupported milestone ledger version: ${String(raw.version)}`);
  }
  if (raw.scopeId !== scopeId) {
    throw new Error('Milestone ledger scope mismatch');
  }

  const awards: MilestoneLedger['awards'] = {};
  const opaqueAwards: Record<string, unknown> = {};
  const existingOpaqueAwards =
    raw.opaqueAwards &&
    typeof raw.opaqueAwards === 'object' &&
    !Array.isArray(raw.opaqueAwards)
      ? raw.opaqueAwards
      : {};
  if (raw.awards && typeof raw.awards === 'object' && !Array.isArray(raw.awards)) {
    for (const [id, awardValue] of Object.entries(raw.awards)) {
      if (!isRankOrMarkMilestoneId(id)) {
        opaqueAwards[id] = awardValue;
        continue;
      }
      const award = sanitizeAward(id, awardValue);
      if (award) awards[id] = award;
    }
  }

  const outbox: MilestoneLedger['outbox'] = [];
  const seen = new Set<MilestoneId>();
  const requestedOutbox = Array.isArray(raw.outbox) ? raw.outbox : [];
  const opaqueOutbox = Array.isArray(raw.opaqueOutbox) ? [...raw.opaqueOutbox] : [];
  for (const id of requestedOutbox) {
    if (!isRankOrMarkMilestoneId(id)) {
      opaqueOutbox.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    const award = awards[id];
    if (!award || award.status !== 'pending') continue;
    seen.add(id);
    outbox.push(id as RankMilestoneId | MarkMilestoneId);
  }
  for (const [id, award] of Object.entries(awards)) {
    if (award?.status !== 'pending' || seen.has(id as MilestoneId)) continue;
    seen.add(id as MilestoneId);
    outbox.push(id as RankMilestoneId | MarkMilestoneId);
  }

  return {
    version: MILESTONE_LEDGER_VERSION,
    revision:
      typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0
        ? raw.revision
        : 0,
    scopeId,
    awards,
    outbox,
    opaqueAwards:
      Object.keys(opaqueAwards).length > 0 || raw.opaqueAwards
        ? { ...existingOpaqueAwards, ...opaqueAwards }
        : undefined,
    opaqueOutbox: opaqueOutbox.length > 0 ? opaqueOutbox : undefined,
    legacyMigratedAt:
      typeof raw.legacyMigratedAt === 'string' ? raw.legacyMigratedAt : undefined,
    progressionBaselineVersion:
      typeof raw.progressionBaselineVersion === 'number'
        ? raw.progressionBaselineVersion
        : undefined,
  };
}

async function writeLedger(ledger: MilestoneLedger): Promise<void> {
  const nextLedger = { ...ledger, revision: ledger.revision + 1 };
  const slot = nextLedger.revision % 2 === 0 ? 'a' : 'b';
  const key = `${getMilestoneLedgerStorageKey(ledger.scopeId)}:${slot}`;
  await writeSecureValue(key, JSON.stringify(nextLedger));
  const verification = await readSecureValue(key);
  if (
    !verification ||
    sanitizeLedger(JSON.parse(verification), ledger.scopeId).revision !== nextLedger.revision
  ) {
    throw new Error('Milestone ledger verification failed');
  }
  Object.assign(ledger, nextLedger);
  notifyListeners();
}

function legacyAward(
  id: RankMilestoneId | MarkMilestoneId,
  date: string
): MilestoneAward {
  const definition = MILESTONE_DEFINITIONS[id];
  return {
    id,
    definitionVersion: definition.version,
    category: definition.category as 'rank' | 'mark',
    name: definition.name as RankName | MarkName,
    awardedAt: date === PRE_LAUNCH_SENTINEL ? PRE_LAUNCH_SENTINEL : `${date}T00:00:00.000Z`,
    awardedLocalDate: date,
    status: 'shown',
    presentation: {},
  };
}

async function migrateLegacyLedger(scopeId: string): Promise<MilestoneLedger> {
  if (scopeId === DEVICE_LOCAL_MILESTONE_SCOPE) {
    return emptyLedger(scopeId);
  }

  const legacyRaw = await AsyncStorage.getItem(LEGACY_MILESTONE_KEY);
  if (!legacyRaw) {
    return emptyLedger(scopeId);
  }

  // The v1 key was device-global and contained no trustworthy owner. On a
  // shared device, assigning it to the first account after upgrade would leak
  // one person's history into another account. Discard it and let the verified
  // account establish a metrics-based pre-launch baseline instead.
  logger.warn('[milestoneTracking] Discarding unowned legacy milestone dates');
  await AsyncStorage.removeItem(LEGACY_MILESTONE_KEY);
  const ledger = emptyLedger(scopeId);
  ledger.legacyMigratedAt = new Date().toISOString();
  return ledger;
}

async function readLedger(
  scopeId: string,
  options: { allowLegacyMigration?: boolean } = {}
): Promise<MilestoneLedger> {
  const baseKey = getMilestoneLedgerStorageKey(scopeId);
  const stored = await Promise.all([
    readSecureValue(`${baseKey}:a`),
    readSecureValue(`${baseKey}:b`),
    readSecureValue(baseKey),
  ]);
  const candidates: MilestoneLedger[] = [];
  let incompatibleError: Error | null = null;
  for (const raw of stored) {
    if (!raw) continue;
    try {
      candidates.push(sanitizeLedger(JSON.parse(raw), scopeId));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('Unsupported milestone ledger version') || message.includes('scope mismatch')) {
        incompatibleError = error instanceof Error ? error : new Error(message);
      } else {
        logger.warn('[milestoneTracking] Ignoring corrupt journal slot', error);
      }
    }
  }
  if (incompatibleError) {
    throw incompatibleError;
  }
  if (candidates.length > 0) {
    const ledger = candidates.sort((left, right) => right.revision - left.revision)[0];
    if (ledger.legacyMigratedAt) {
      await AsyncStorage.removeItem(LEGACY_MILESTONE_KEY).catch(() => undefined);
    }
    return ledger;
  }
  if (options.allowLegacyMigration) {
    return migrateLegacyLedger(scopeId);
  }
  return emptyLedger(scopeId);
}

export async function getMilestoneLedger(scopeId?: string): Promise<MilestoneLedger> {
  const normalized = normalizedScopeId(scopeId);
  return runSerialized(() => readLedger(normalized));
}

function datesFromLedger(ledger: MilestoneLedger): MilestoneDates {
  const dates: MilestoneDates = { rank: {}, mark: {} };
  for (const award of Object.values(ledger.awards)) {
    if (!award) continue;
    if (award.category === 'rank') {
      dates.rank[award.name as RankName] = award.awardedLocalDate;
    } else if (award.category === 'mark') {
      dates.mark[award.name as MarkName] = award.awardedLocalDate;
    }
  }
  return dates;
}

export async function getMilestoneDates(scopeId?: string): Promise<MilestoneDates> {
  try {
    return datesFromLedger(await getMilestoneLedger(scopeId));
  } catch (error) {
    logger.error('[milestoneTracking] Failed to read milestone ledger', error);
    return { ...EMPTY_MILESTONE_DATES };
  }
}

export async function checkAndRecordMilestones(
  metrics: RankMetrics,
  options: MilestoneRecordOptions = {}
): Promise<MilestoneRecordResult> {
  const scopeId = normalizedScopeId(options.scopeId);
  try {
    return await runSerialized(async () => {
      const ledger = await readLedger(scopeId);
      const now = new Date().toISOString();
      const localDate = toProgressionLocalDateString(now, options.timezone);
      const result: MilestoneRecordResult = {
        rank: [],
        mark: [],
        persistence: 'unchanged',
      };
      const currentRank = getCurrentRank(metrics).tier.name;
      const earnedMarks = getEarnedMarkNames(metrics.practiceDays);

      for (const rankName of getEarnedRankNames(metrics)) {
        const id = rankMilestoneId(rankName);
        if (ledger.awards[id]) continue;
        const shouldPresent = MILESTONE_DEFINITIONS[id].presentation === 'forge';
        ledger.awards[id] = {
          id,
          definitionVersion: MILESTONE_DEFINITIONS[id].version,
          category: 'rank',
          name: rankName,
          awardedAt: now,
          awardedLocalDate: localDate,
          status: shouldPresent ? 'pending' : 'shown',
          shownAt: shouldPresent ? undefined : now,
          sourceEventId: options.sourceEventId,
          presentation: { primeCount: metrics.totalPrimes },
        };
        if (shouldPresent) ledger.outbox.push(id);
        result.rank.push(rankName);
      }

      for (const markName of earnedMarks) {
        const id = markMilestoneId(markName);
        if (ledger.awards[id]) continue;
        ledger.awards[id] = {
          id,
          definitionVersion: MILESTONE_DEFINITIONS[id].version,
          category: 'mark',
          name: markName,
          awardedAt: now,
          awardedLocalDate: localDate,
          status: 'pending',
          sourceEventId: options.sourceEventId,
          presentation: {
            rankName: currentRank,
            markIndex: earnedMarks.findIndex((name) => name === markName),
          },
        };
        ledger.outbox.push(id);
        result.mark.push(markName);
      }

      if (result.rank.length > 0 || result.mark.length > 0) {
        await writeLedger(ledger);
        result.persistence = 'persisted';
      }

      return result;
    });
  } catch (error) {
    logger.error('[milestoneTracking] Failed to record milestones', error);
    return { rank: [], mark: [], persistence: 'failed' };
  }
}

export async function backfillMilestoneDates(
  metrics: RankMetrics,
  options: MilestoneRecordOptions = {}
): Promise<MilestoneBackfillResult> {
  const scopeId = normalizedScopeId(options.scopeId);
  try {
    const result = await runSerialized(async () => {
      const ledger = await readLedger(scopeId, { allowLegacyMigration: true });
      if ((ledger.progressionBaselineVersion ?? 0) >= PROGRESSION_BASELINE_VERSION) {
        return 'unchanged' as const;
      }
      for (const rankName of getEarnedRankNames(metrics)) {
        const id = rankMilestoneId(rankName);
        if (ledger.awards[id]) continue;
        ledger.awards[id] = legacyAward(id, PRE_LAUNCH_SENTINEL);
      }
      for (const markName of getEarnedMarkNames(metrics.practiceDays)) {
        const id = markMilestoneId(markName);
        if (ledger.awards[id]) continue;
        ledger.awards[id] = legacyAward(id, PRE_LAUNCH_SENTINEL);
      }
      ledger.progressionBaselineVersion = PROGRESSION_BASELINE_VERSION;
      await writeLedger(ledger);
      return 'persisted' as const;
    });
    return result;
  } catch (error) {
    logger.error('[milestoneTracking] Failed to backfill milestone ledger', error);
    return 'failed';
  }
}

export async function getPendingMilestoneAwards(
  scopeId?: string
): Promise<MilestoneAward[]> {
  const ledger = await getMilestoneLedger(scopeId);
  return ledger.outbox
    .map((id) => ledger.awards[id])
    .filter((award): award is MilestoneAward => Boolean(award && award.status === 'pending'));
}

async function transitionMilestone(
  scopeId: string,
  id: RankMilestoneId | MarkMilestoneId,
  transition: 'shown' | 'dismissed'
): Promise<void> {
  await runSerialized(async () => {
    const ledger = await readLedger(scopeId);
    const award = ledger.awards[id];
    if (!award) return;
    if (award.status === 'dismissed') return;
    if (transition === 'shown' && award.status === 'shown') return;
    const now = new Date().toISOString();
    award.status = transition;
    award.shownAt = award.shownAt ?? now;
    if (transition === 'dismissed') award.dismissedAt = award.dismissedAt ?? now;
    ledger.outbox = ledger.outbox.filter((pendingId) => pendingId !== id);
    await writeLedger(ledger);
  });
}

export async function markMilestoneShown(
  scopeId: string,
  id: RankMilestoneId | MarkMilestoneId
): Promise<void> {
  return transitionMilestone(normalizedScopeId(scopeId), id, 'shown');
}

export async function markMilestoneDismissed(
  scopeId: string,
  id: RankMilestoneId | MarkMilestoneId
): Promise<void> {
  return transitionMilestone(normalizedScopeId(scopeId), id, 'dismissed');
}

export function subscribeToMilestoneDates(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
