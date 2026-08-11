import {
  PRACTICE_MODES,
  type PracticeMode,
  type PracticeSessionRecord,
  type WeaveRange,
  type WeaveScope,
} from '@/types/practice';
import { selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';
import { localDateKey } from '@/utils/practiceTime';

export const WEAVE_RANGE_CONFIG: Readonly<Record<
  WeaveRange,
  { label: string; days: number; bucketDays: number }
>> = {
  '4w': { label: '4 Weeks', days: 28, bucketDays: 1 },
  '12w': { label: '12 Weeks', days: 84, bucketDays: 3 },
  '6m': { label: '6 Months', days: 183, bucketDays: 7 },
  '1y': { label: '1 Year', days: 365, bucketDays: 14 },
};

export interface WeaveNode {
  id: string;
  mode: PracticeMode;
  bucketIndex: number;
  startDateKey: string;
  endDateKey: string;
  events: PracticeSessionRecord[];
  sessionCount: number;
  durationSeconds: number;
}

export interface WeaveMetrics {
  sessions: number;
  practiceDays: number;
  activeWeeks: number;
  practicedSeconds: number;
  modeCounts: Record<PracticeMode, number>;
}

export interface WeaveData {
  range: WeaveRange;
  startDateKey: string;
  endDateKey: string;
  bucketCount: number;
  events: PracticeSessionRecord[];
  nodes: WeaveNode[];
  nodesByMode: Record<PracticeMode, WeaveNode[]>;
  metrics: WeaveMetrics;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function distanceInDays(startDateKey: string, endDateKey: string): number {
  return Math.max(0, Math.round((parseDateKey(endDateKey).getTime() - parseDateKey(startDateKey).getTime()) / 86_400_000));
}

function startOfIsoWeek(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return formatDateKey(date);
}

/** Migrated and guest events can hold either side of a local/server Anchor pair. */
export function eventMatchesAnchor(
  event: PracticeSessionRecord,
  anchorReference: string | readonly (string | null | undefined)[],
): boolean {
  const aliases = new Set(
    (Array.isArray(anchorReference) ? anchorReference : [anchorReference]).filter(
      (value): value is string => Boolean(value),
    ),
  );
  return [event.anchorId, event.anchorLocalId, event.anchorServerId].some(
    (value) => typeof value === 'string' && aliases.has(value),
  );
}

const emptyModeCounts = (): Record<PracticeMode, number> => ({
  deep_prime: 0,
  visualize: 0,
  focus: 0,
  release: 0,
});

/** Pure, canonical-ledger projection. Scope and range never persist derived state. */
export function buildWeaveData(args: {
  history: readonly PracticeSessionRecord[];
  accountId: string | null | undefined;
  scope: WeaveScope;
  /** The selected Anchor's local/server aliases, when scope is a single Anchor. */
  anchorAliases?: readonly (string | null | undefined)[];
  range: WeaveRange;
  now?: Date;
}): WeaveData {
  const now = args.now ?? new Date();
  const config = WEAVE_RANGE_CONFIG[args.range];
  const endDateKey = localDateKey(now);
  const startDateKey = addDays(endDateKey, -(config.days - 1));
  const events = selectCanonicalPracticeEvents(args.history, args.accountId, now).filter((event) =>
    event.localDateKey >= startDateKey &&
    event.localDateKey <= endDateKey &&
    (args.scope.kind === 'all' || eventMatchesAnchor(event, args.anchorAliases ?? args.scope.anchorId)),
  );
  const bucketCount = Math.ceil(config.days / config.bucketDays);
  const groups = new Map<string, PracticeSessionRecord[]>();

  events.forEach((event) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(distanceInDays(startDateKey, event.localDateKey) / config.bucketDays));
    const key = `${event.practiceMode}:${bucketIndex}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  });

  const nodes = [...groups.entries()].map(([key, bucketEvents]) => {
    const [mode, indexText] = key.split(':');
    const bucketIndex = Number(indexText);
    const bucketStart = addDays(startDateKey, bucketIndex * config.bucketDays);
    const bucketEnd = addDays(bucketStart, Math.min(config.bucketDays - 1, distanceInDays(bucketStart, endDateKey)));
    return {
      id: `weave:${args.range}:${key}`,
      mode: mode as PracticeMode,
      bucketIndex,
      startDateKey: bucketStart,
      endDateKey: bucketEnd,
      events: bucketEvents,
      sessionCount: bucketEvents.length,
      durationSeconds: bucketEvents.reduce((total, event) => total + Math.max(0, event.completedDurationSeconds || 0), 0),
    } satisfies WeaveNode;
  }).sort((left, right) => PRACTICE_MODES.indexOf(left.mode) - PRACTICE_MODES.indexOf(right.mode) || left.bucketIndex - right.bucketIndex);

  const nodesByMode = PRACTICE_MODES.reduce((result, mode) => {
    result[mode] = nodes.filter((node) => node.mode === mode);
    return result;
  }, {} as Record<PracticeMode, WeaveNode[]>);
  const modeCounts = emptyModeCounts();
  events.forEach((event) => { modeCounts[event.practiceMode] += 1; });

  return {
    range: args.range,
    startDateKey,
    endDateKey,
    bucketCount,
    events,
    nodes,
    nodesByMode,
    metrics: {
      sessions: events.length,
      practiceDays: new Set(events.map((event) => event.localDateKey)).size,
      activeWeeks: new Set(events.map((event) => startOfIsoWeek(event.localDateKey))).size,
      practicedSeconds: events.reduce((total, event) => total + Math.max(0, event.completedDurationSeconds || 0), 0),
      modeCounts,
    },
  };
}

export function formatWeaveDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)} hr`;
}
