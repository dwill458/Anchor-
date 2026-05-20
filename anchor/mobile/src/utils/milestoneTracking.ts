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
