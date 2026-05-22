import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getEarnedMarkNames,
  getEarnedRankNames,
  type MarkName,
  type RankMetrics,
  type RankName,
} from '@/utils/progression';

const MILESTONE_KEY = 'anchor-milestone-dates';
const PRE_LAUNCH_SENTINEL = 'pre-launch';

export interface MilestoneDates {
  rank: Partial<Record<RankName, string>>;
  mark: Partial<Record<MarkName, string>>;
}

export interface MilestoneRecordResult {
  rank: RankName[];
  mark: MarkName[];
}

const EMPTY_MILESTONE_DATES: MilestoneDates = {
  rank: {},
  mark: {},
};

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Best-effort only.
    }
  });
}

function sanitizeMilestoneDates(value: unknown): MilestoneDates {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_MILESTONE_DATES };
  }

  const raw = value as Partial<MilestoneDates>;

  return {
    rank:
      raw.rank && typeof raw.rank === 'object' && !Array.isArray(raw.rank)
        ? { ...raw.rank }
        : {},
    mark:
      raw.mark && typeof raw.mark === 'object' && !Array.isArray(raw.mark)
        ? { ...raw.mark }
        : {},
  };
}

async function writeMilestoneDates(next: MilestoneDates): Promise<void> {
  try {
    await AsyncStorage.setItem(MILESTONE_KEY, JSON.stringify(next));
    notifyListeners();
  } catch {
    // Must never throw into product flows.
  }
}

export async function getMilestoneDates(): Promise<MilestoneDates> {
  try {
    const stored = await AsyncStorage.getItem(MILESTONE_KEY);
    if (!stored) {
      return { ...EMPTY_MILESTONE_DATES };
    }

    return sanitizeMilestoneDates(JSON.parse(stored));
  } catch {
    return { ...EMPTY_MILESTONE_DATES };
  }
}

export async function checkAndRecordMilestones(
  metrics: RankMetrics
): Promise<MilestoneRecordResult> {
  try {
    const existing = await getMilestoneDates();
    const next: MilestoneDates = {
      rank: { ...existing.rank },
      mark: { ...existing.mark },
    };
    const today = new Date().toISOString().split('T')[0];
    const result: MilestoneRecordResult = {
      rank: [],
      mark: [],
    };

    for (const rankName of getEarnedRankNames(metrics)) {
      if (!next.rank[rankName]) {
        next.rank[rankName] = today;
        result.rank.push(rankName);
      }
    }

    for (const markName of getEarnedMarkNames(metrics.practiceDays)) {
      if (!next.mark[markName]) {
        next.mark[markName] = today;
        result.mark.push(markName);
      }
    }

    if (result.rank.length > 0 || result.mark.length > 0) {
      await writeMilestoneDates(next);
    }

    return result;
  } catch {
    return { rank: [], mark: [] };
  }
}

export async function backfillMilestoneDates(
  metrics: RankMetrics
): Promise<void> {
  try {
    const existing = await getMilestoneDates();
    const next: MilestoneDates = {
      rank: { ...existing.rank },
      mark: { ...existing.mark },
    };
    let didChange = false;

    for (const rankName of getEarnedRankNames(metrics)) {
      if (!next.rank[rankName]) {
        next.rank[rankName] = PRE_LAUNCH_SENTINEL;
        didChange = true;
      }
    }

    for (const markName of getEarnedMarkNames(metrics.practiceDays)) {
      if (!next.mark[markName]) {
        next.mark[markName] = PRE_LAUNCH_SENTINEL;
        didChange = true;
      }
    }

    if (didChange) {
      await writeMilestoneDates(next);
    }
  } catch {
    // Must never throw into product flows.
  }
}

export function subscribeToMilestoneDates(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// Prime-only progression sheet milestone tracking (separate from multi-factor rank milestones)
export type PrimeRankName = 'Initiate' | 'Practitioner' | 'Architect' | 'Sovereign';
export type PrimeDepthName = 'Surface' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign';

export interface SheetMilestoneDates {
  rank: Partial<Record<PrimeRankName, string>>;
  depth: Partial<Record<PrimeDepthName, string>>;
}

const SHEET_MILESTONE_KEY = 'anchor-sheet-milestone-dates';

const PRIME_RANK_MINS: Record<PrimeRankName, number> = {
  Initiate: 0,
  Practitioner: 10,
  Architect: 50,
  Sovereign: 200,
};

const PRIME_DEPTH_MINS: Record<PrimeDepthName, number> = {
  Surface: 0,
  Grounded: 25,
  Rooted: 75,
  Embedded: 150,
  Sovereign: 300,
};

const EMPTY_SHEET_MILESTONE_DATES: SheetMilestoneDates = {
  rank: {},
  depth: {},
};

function sanitizeSheetMilestoneDates(value: unknown): SheetMilestoneDates {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_SHEET_MILESTONE_DATES };
  }

  const raw = value as Partial<SheetMilestoneDates>;

  return {
    rank:
      raw.rank && typeof raw.rank === 'object' && !Array.isArray(raw.rank)
        ? { ...raw.rank }
        : {},
    depth:
      raw.depth && typeof raw.depth === 'object' && !Array.isArray(raw.depth)
        ? { ...raw.depth }
        : {},
  };
}

async function writeSheetMilestoneDates(next: SheetMilestoneDates): Promise<void> {
  try {
    await AsyncStorage.setItem(SHEET_MILESTONE_KEY, JSON.stringify(next));
  } catch {
    // Must never throw into product flows.
  }
}

export async function getSheetMilestoneDates(): Promise<SheetMilestoneDates> {
  try {
    const stored = await AsyncStorage.getItem(SHEET_MILESTONE_KEY);
    if (!stored) {
      return { ...EMPTY_SHEET_MILESTONE_DATES };
    }

    return sanitizeSheetMilestoneDates(JSON.parse(stored));
  } catch {
    return { ...EMPTY_SHEET_MILESTONE_DATES };
  }
}

export async function checkAndRecordSheetMilestones(totalPrimes: number): Promise<void> {
  try {
    const existing = await getSheetMilestoneDates();
    const next: SheetMilestoneDates = {
      rank: { ...existing.rank },
      depth: { ...existing.depth },
    };
    const today = new Date().toISOString().split('T')[0];
    let didChange = false;

    // Check rank tiers (prime-only)
    const rankTierNames: PrimeRankName[] = ['Initiate', 'Practitioner', 'Architect', 'Sovereign'];
    for (const rankName of rankTierNames) {
      if (totalPrimes >= PRIME_RANK_MINS[rankName] && !next.rank[rankName]) {
        next.rank[rankName] = today;
        didChange = true;
      }
    }

    // Check depth tiers (prime-only)
    const depthTierNames: PrimeDepthName[] = ['Surface', 'Grounded', 'Rooted', 'Embedded', 'Sovereign'];
    for (const depthName of depthTierNames) {
      if (totalPrimes >= PRIME_DEPTH_MINS[depthName] && !next.depth[depthName]) {
        next.depth[depthName] = today;
        didChange = true;
      }
    }

    if (didChange) {
      await writeSheetMilestoneDates(next);
    }
  } catch {
    // Must never throw into product flows.
  }
}

export async function backfillSheetMilestones(totalPrimes: number): Promise<void> {
  try {
    const existing = await getSheetMilestoneDates();
    const next: SheetMilestoneDates = {
      rank: { ...existing.rank },
      depth: { ...existing.depth },
    };
    let didChange = false;

    // Backfill rank tiers
    const rankTierNames: PrimeRankName[] = ['Initiate', 'Practitioner', 'Architect', 'Sovereign'];
    for (const rankName of rankTierNames) {
      if (totalPrimes >= PRIME_RANK_MINS[rankName] && !next.rank[rankName]) {
        next.rank[rankName] = PRE_LAUNCH_SENTINEL;
        didChange = true;
      }
    }

    // Backfill depth tiers
    const depthTierNames: PrimeDepthName[] = ['Surface', 'Grounded', 'Rooted', 'Embedded', 'Sovereign'];
    for (const depthName of depthTierNames) {
      if (totalPrimes >= PRIME_DEPTH_MINS[depthName] && !next.depth[depthName]) {
        next.depth[depthName] = PRE_LAUNCH_SENTINEL;
        didChange = true;
      }
    }

    if (didChange) {
      await writeSheetMilestoneDates(next);
    }
  } catch {
    // Must never throw into product flows.
  }
}
