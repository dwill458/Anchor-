import { colors } from '@/theme';
import type { Anchor } from '@/types';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';
import { toProgressionLocalDateString } from '@/utils/progressionTimezone';

export type DepthName =
  | 'Surface'
  | 'Grounded'
  | 'Rooted'
  | 'Embedded'
  | 'Embodied';

type DepthRequirementKey = 'primes' | 'practiceDays' | 'deepPrimes';

export interface RequirementStatus {
  key: DepthRequirementKey;
  label: string;
  shortLabel: string;
  current: number;
  required: number;
  met: boolean;
}

export interface DepthTier {
  name: DepthName;
  color: string;
  description: string;
  requirements: Partial<Record<DepthRequirementKey, number>>;
}

export interface AnchorPrimeStats {
  primes: number;
  practiceDays: number;
  deepPrimes: number;
  lastPracticedAt?: Date;
}

export interface DepthState {
  tier: DepthTier;
  requirements: RequirementStatus[];
}

export interface DepthProgressState {
  currentTier: DepthTier;
  nextTier: DepthTier | null;
  progress: number;
  unmetRequirements: RequirementStatus[];
}

export interface DeepestPracticeAnchorState {
  anchor: Anchor;
  stats: AnchorPrimeStats;
  depth: DepthState;
  progress: DepthProgressState;
}

interface NormalizedProgressionSession {
  id: string;
  anchorId: string;
  completedAt: string;
  timestamp: number;
  practiceKind: 'standardPrime' | 'deepPrime';
  localDate: string;
}

const DUPLICATE_WINDOW_MS = 5_000;

export const DEPTH_TIERS: DepthTier[] = [
  {
    name: 'Surface',
    color: colors.silver,
    description:
      'The first imprint. Meaning has been marked, not yet embodied.',
    requirements: {},
  },
  {
    name: 'Grounded',
    color: '#9A8A6A',
    description:
      'The pattern is taking root. Repetition is beginning to shape response.',
    requirements: {
      primes: 3,
      practiceDays: 2,
    },
  },
  {
    name: 'Rooted',
    color: '#B8973A',
    description:
      'The pattern returns without force. Momentum has replaced effort.',
    requirements: {
      primes: 7,
      practiceDays: 5,
    },
  },
  {
    name: 'Embedded',
    color: colors.gold,
    description: 'The Anchor now lives below conscious thought.',
    requirements: {
      primes: 15,
      practiceDays: 10,
      deepPrimes: 1,
    },
  },
  {
    name: 'Embodied',
    color: '#E8D5A0',
    description: 'The symbol has entered your operating rhythm.',
    requirements: {
      primes: 30,
      practiceDays: 21,
      deepPrimes: 3,
    },
  },
];

function buildRequirementStatus(
  key: DepthRequirementKey,
  current: number,
  required: number
): RequirementStatus {
  switch (key) {
    case 'primes':
      return {
        key,
        label: 'Primes on this Anchor',
        shortLabel: 'primes',
        current,
        required,
        met: current >= required,
      };
    case 'practiceDays':
      return {
        key,
        label: 'Practice Days',
        shortLabel: 'practice days',
        current,
        required,
        met: current >= required,
      };
    case 'deepPrimes':
      return {
        key,
        label: 'Deep Primes',
        shortLabel: 'Deep Prime',
        current,
        required,
        met: current >= required,
      };
  }
}

export function getDepthRequirementStatuses(
  tier: DepthTier,
  stats: AnchorPrimeStats
): RequirementStatus[] {
  return (Object.entries(tier.requirements) as Array<
    [DepthRequirementKey, number]
  >).map(([key, required]) => {
    const current =
      key === 'primes'
        ? stats.primes
        : key === 'practiceDays'
          ? stats.practiceDays
          : stats.deepPrimes;
    return buildRequirementStatus(key, current, required);
  });
}

function meetsAllRequirements(requirements: RequirementStatus[]): boolean {
  return requirements.every((requirement) => requirement.met);
}

function averageProgress(requirements: RequirementStatus[]): number {
  if (requirements.length === 0) {
    return 1;
  }

  const ratios = requirements.map((requirement) =>
    Math.max(0, Math.min(1, requirement.current / requirement.required))
  );

  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

function findCurrentTier<T extends DepthTier>(
  tiers: T[],
  requirementsBuilder: (tier: T) => RequirementStatus[]
): { tier: T; requirements: RequirementStatus[] } {
  for (let index = tiers.length - 1; index >= 0; index -= 1) {
    const tier = tiers[index];
    const requirements = requirementsBuilder(tier);
    if (meetsAllRequirements(requirements)) {
      return { tier, requirements };
    }
  }

  return { tier: tiers[0], requirements: requirementsBuilder(tiers[0]) };
}

function findNextTier<T extends DepthTier>(
  tiers: T[],
  currentName: T['name']
): T | null {
  const index = tiers.findIndex((tier) => tier.name === currentName);
  if (index < 0 || index >= tiers.length - 1) {
    return null;
  }

  return tiers[index + 1];
}

export function getNormalizedProgressionSessions(
  practiceSessions: PrimingHistoryEntry[],
  timezoneLabel?: string | null
): NormalizedProgressionSession[] {
  const sorted = [...practiceSessions]
    .map((session) => {
      const timestamp = new Date(session.completedAt).getTime();
      if (Number.isNaN(timestamp)) {
        return null;
      }

      return {
        ...session,
        timestamp,
      };
    })
    .filter(
      (
        session
      ): session is PrimingHistoryEntry & {
        timestamp: number;
      } => session !== null
    )
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      if (left.type !== right.type) {
        return left.type === 'activate' ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    });

  const seenIds = new Set<string>();
  const lastSignatureTime = new Map<string, number>();
  const anchorsWithPriorPrime = new Set<string>();
  const normalized: NormalizedProgressionSession[] = [];

  for (const session of sorted) {
    if (seenIds.has(session.id)) {
      continue;
    }
    seenIds.add(session.id);

    const signature = `${session.anchorId}|${session.type}`;
    const previousSignatureTime = lastSignatureTime.get(signature);
    if (
      previousSignatureTime != null &&
      Math.abs(session.timestamp - previousSignatureTime) <= DUPLICATE_WINDOW_MS
    ) {
      continue;
    }
    lastSignatureTime.set(signature, session.timestamp);

    const practiceKind =
      session.type === 'reinforce' && anchorsWithPriorPrime.has(session.anchorId)
        ? 'deepPrime'
        : 'standardPrime';

    normalized.push({
      id: session.id,
      anchorId: session.anchorId,
      completedAt: session.completedAt,
      timestamp: session.timestamp,
      practiceKind,
      localDate: toProgressionLocalDateString(
        session.completedAt,
        timezoneLabel
      ),
    });

    anchorsWithPriorPrime.add(session.anchorId);
  }

  return normalized;
}

export function getTotalPrimes(practiceSessions: PrimingHistoryEntry[]): number {
  return getNormalizedProgressionSessions(practiceSessions).length;
}

export function getPracticeDays(
  practiceSessions: PrimingHistoryEntry[],
  timezoneLabel?: string | null
): number {
  return new Set(
    getNormalizedProgressionSessions(practiceSessions, timezoneLabel)
      .map((session) => session.localDate)
      .filter(Boolean)
  ).size;
}

export function getReleasedAnchorCount(anchors: Anchor[]): number {
  return anchors.filter(
    (anchor) => anchor.isReleased || anchor.releasedAt || anchor.archivedAt
  ).length;
}

export function getAnchorPrimeStats(
  anchorId: string,
  practiceSessions: PrimingHistoryEntry[],
  timezoneLabel?: string | null
): AnchorPrimeStats {
  const sessions = getNormalizedProgressionSessions(practiceSessions, timezoneLabel)
    .filter((session) => session.anchorId === anchorId);

  if (sessions.length === 0) {
    return {
      primes: 0,
      practiceDays: 0,
      deepPrimes: 0,
    };
  }

  const deepPrimes = sessions.filter(
    (session) => session.practiceKind === 'deepPrime'
  ).length;

  return {
    primes: sessions.length,
    practiceDays: new Set(sessions.map((session) => session.localDate).filter(Boolean))
      .size,
    deepPrimes,
    lastPracticedAt: new Date(sessions[sessions.length - 1].completedAt),
  };
}

export function getAnchorDepth(stats: AnchorPrimeStats): DepthState {
  return findCurrentTier(DEPTH_TIERS, (tier) =>
    getDepthRequirementStatuses(tier, stats)
  );
}

export function getAnchorDepthProgress(
  stats: AnchorPrimeStats
): DepthProgressState {
  const current = getAnchorDepth(stats);
  const nextTier = findNextTier(DEPTH_TIERS, current.tier.name);
  const unmetRequirements = nextTier
    ? getDepthRequirementStatuses(nextTier, stats).filter(
        (requirement) => !requirement.met
      )
    : [];

  return {
    currentTier: current.tier,
    nextTier,
    progress: nextTier
      ? averageProgress(getDepthRequirementStatuses(nextTier, stats))
      : 1,
    unmetRequirements,
  };
}

export function getDeepestPracticeAnchor(
  anchors: Anchor[],
  practiceSessions: PrimingHistoryEntry[],
  timezoneLabel?: string | null
): DeepestPracticeAnchorState | null {
  const activeAnchors = anchors.filter(
    (anchor) => !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt
  );

  if (activeAnchors.length === 0) {
    return null;
  }

  const candidates = activeAnchors.map((anchor) => {
    const stats = getAnchorPrimeStats(anchor.id, practiceSessions, timezoneLabel);
    const depth = getAnchorDepth(stats);
    const progress = getAnchorDepthProgress(stats);

    return {
      anchor,
      stats,
      depth,
      progress,
    };
  });

  candidates.sort((left, right) => {
    const leftTierIndex = DEPTH_TIERS.findIndex(
      (tier) => tier.name === left.depth.tier.name
    );
    const rightTierIndex = DEPTH_TIERS.findIndex(
      (tier) => tier.name === right.depth.tier.name
    );

    if (leftTierIndex !== rightTierIndex) {
      return rightTierIndex - leftTierIndex;
    }

    if (left.progress.progress !== right.progress.progress) {
      return right.progress.progress - left.progress.progress;
    }

    return (
      (right.stats.lastPracticedAt?.getTime() ?? 0) -
      (left.stats.lastPracticedAt?.getTime() ?? 0)
    );
  });

  return candidates[0] ?? null;
}

export function formatDepthGuidance(progress: DepthProgressState): string {
  if (!progress.nextTier) {
    return 'Maximum depth reached';
  }

  return formatRequirementGuidance(progress.unmetRequirements, progress.nextTier.name, {
    practiceDaysLabel: 'return days',
    singularDeepPrimePrefix: '',
    allowDeepPrimeOnlySentence: true,
  });
}

function formatRequirementGuidance(
  requirements: RequirementStatus[],
  targetName: string,
  options?: {
    practiceDaysLabel?: string;
    singularDeepPrimePrefix?: string;
    allowDeepPrimeOnlySentence?: boolean;
  }
): string {
  const unresolved = requirements.filter((requirement) => !requirement.met);
  if (unresolved.length === 0) {
    return '';
  }

  if (
    options?.allowDeepPrimeOnlySentence &&
    unresolved.length === 1 &&
    unresolved[0].key === 'deepPrimes'
  ) {
    const remaining = unresolved[0].required - unresolved[0].current;
    return `${remaining} Deep Prime${remaining === 1 ? '' : 's'} needed to reach ${targetName}`;
  }

  const fragments = unresolved.map((requirement) => {
    const remaining = requirement.required - requirement.current;

    if (requirement.key === 'practiceDays') {
      return `${remaining} ${remaining === 1 ? 'practice day' : options?.practiceDaysLabel ?? 'practice days'}`;
    }

    if (requirement.key === 'deepPrimes') {
      const prefix = options?.singularDeepPrimePrefix ?? 'more ';
      return `${remaining} ${remaining === 1 ? `${prefix}Deep Prime` : `${prefix}Deep Primes`}`;
    }

    return `${remaining} ${remaining === 1 ? 'prime' : 'primes'}`;
  });

  return `${fragments.join(' · ')} to ${targetName}`;
}
