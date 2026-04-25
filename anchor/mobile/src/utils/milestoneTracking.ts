import AsyncStorage from '@react-native-async-storage/async-storage';

const MILESTONE_KEY = 'anchor-milestone-dates';
const PRE_LAUNCH_SENTINEL = 'pre-launch';

export interface MilestoneDates {
  rank: Record<string, string>;
  depth: Record<string, string>;
}

const EMPTY_MILESTONE_DATES: MilestoneDates = {
  rank: {},
  depth: {},
};

const listeners = new Set<() => void>();

const RANK_THRESHOLDS: { name: string; min: number }[] = [
  { name: 'Initiate', min: 0 },
  { name: 'Practitioner', min: 10 },
  { name: 'Architect', min: 50 },
  { name: 'Sovereign', min: 200 },
];

const DEPTH_THRESHOLDS: { name: string; min: number }[] = [
  { name: 'Surface', min: 0 },
  { name: 'Grounded', min: 25 },
  { name: 'Rooted', min: 75 },
  { name: 'Embedded', min: 150 },
  { name: 'Sovereign', min: 300 },
];

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Milestone subscriptions are best-effort only.
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
    depth:
      raw.depth && typeof raw.depth === 'object' && !Array.isArray(raw.depth)
        ? { ...raw.depth }
        : {},
  };
}

async function writeMilestoneDates(next: MilestoneDates): Promise<void> {
  try {
    await AsyncStorage.setItem(MILESTONE_KEY, JSON.stringify(next));
    notifyListeners();
  } catch {
    // Milestone tracking must never throw into calling flows.
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

export async function checkAndRecordMilestones(totalPrimes: number): Promise<void> {
  try {
    const existing = await getMilestoneDates();
    const next: MilestoneDates = {
      rank: { ...existing.rank },
      depth: { ...existing.depth },
    };
    const today = new Date().toISOString().split('T')[0];
    let didChange = false;

    RANK_THRESHOLDS.forEach((threshold) => {
      if (totalPrimes >= threshold.min && !next.rank[threshold.name]) {
        next.rank[threshold.name] = today;
        didChange = true;
      }
    });

    DEPTH_THRESHOLDS.forEach((threshold) => {
      if (totalPrimes >= threshold.min && !next.depth[threshold.name]) {
        next.depth[threshold.name] = today;
        didChange = true;
      }
    });

    if (didChange) {
      await writeMilestoneDates(next);
    }
  } catch {
    // Milestone tracking must never throw into calling flows.
  }
}

export async function backfillMilestoneDates(totalPrimes: number): Promise<void> {
  try {
    const existing = await getMilestoneDates();
    const next: MilestoneDates = {
      rank: { ...existing.rank },
      depth: { ...existing.depth },
    };
    let didChange = false;

    RANK_THRESHOLDS.forEach((threshold) => {
      if (totalPrimes >= threshold.min && !next.rank[threshold.name]) {
        next.rank[threshold.name] = PRE_LAUNCH_SENTINEL;
        didChange = true;
      }
    });

    DEPTH_THRESHOLDS.forEach((threshold) => {
      if (totalPrimes >= threshold.min && !next.depth[threshold.name]) {
        next.depth[threshold.name] = PRE_LAUNCH_SENTINEL;
        didChange = true;
      }
    });

    if (didChange) {
      await writeMilestoneDates(next);
    }
  } catch {
    // Milestone tracking must never throw into calling flows.
  }
}

export function subscribeToMilestoneDates(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

