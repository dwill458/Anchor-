/**
 * Weekly Insight 2.0 — week identity and lifecycle. Pure, no I/O.
 *
 * A week is identified by `weekKey`: the local Monday ('YYYY-MM-DD') in an IANA zone. The zone is captured with the
 * snapshot, so the same (user, weekKey) means the same seven calendar days on every device.
 *
 * Lifecycle for one week (all times local to the snapshot zone):
 *   Sunday 19:00 → Monday 00:00   PREVIEW   the week is still in progress ("so far")
 *   Monday 00:00 → Tuesday 12:00  SYNCING   the week is over; offline practice may still arrive (provisional)
 *   Tuesday 12:00 onward          FINAL     frozen
 */

export const WEEK_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const PREVIEW_OPEN_HOUR = 19; // Sunday
export const FINALIZE_HOUR = 12; // Tuesday after the week

const DAY_MS = 86_400_000;

export type RecapPhase = 'NOT_YET' | 'PREVIEW' | 'SYNCING' | 'FINAL';

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== 'string' || !WEEK_KEY_PATTERN.test(key)) return false;
  const { y, m, d } = parseKey(key);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addDaysToKey(key: string, days: number): string {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (zone-independent). */
export function weekdayOfKey(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isMondayKey(key: unknown): key is string {
  return isValidDateKey(key) && weekdayOfKey(key) === 1;
}

export function mondayOfKey(key: string): string {
  return addDaysToKey(key, -((weekdayOfKey(key) + 6) % 7));
}

export function weekKeys(weekKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekKey, i));
}

type LocalParts = { key: string; hour: number; minute: number };

function localParts(instant: number, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '00';
  return {
    key: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

function offsetMinutes(instant: number, timeZone: string): number {
  const p = localParts(instant, timeZone);
  const { y, m, d } = parseKey(p.key);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

export function localDateKeyOf(date: Date, timeZone: string): string {
  return localParts(date.getTime(), timeZone).key;
}

/**
 * The UTC instant of a local wall-clock time. DST-safe:
 *  - ambiguous (clocks go back): the earlier instant;
 *  - nonexistent (clocks go forward): the first instant after the gap, measured with the pre-transition offset.
 */
export function localToUtc(key: string, hour: number, minute: number, timeZone: string): Date {
  const { y, m, d } = parseKey(key);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const offsets = Array.from(
    new Set([
      offsetMinutes(guess - 12 * 3_600_000, timeZone),
      offsetMinutes(guess + 12 * 3_600_000, timeZone),
    ])
  );
  const valid = offsets
    .map(o => guess - o * 60_000)
    .filter(t => {
      const p = localParts(t, timeZone);
      return p.key === key && p.hour === hour && p.minute === minute;
    })
    .sort((a, b) => a - b);
  if (valid.length) return new Date(valid[0]);
  return new Date(guess - Math.min(...offsets) * 60_000);
}

export type WeekBounds = { startUtc: Date; endUtc: Date; keys: string[]; endKey: string };

/** Half-open [startUtc, endUtc). The end is the next Monday's local midnight, so a 23- or 25-hour day cannot leak. */
export function weekBounds(weekKey: string, timeZone: string): WeekBounds {
  const nextKey = addDaysToKey(weekKey, 7);
  return {
    startUtc: localToUtc(weekKey, 0, 0, timeZone),
    endUtc: localToUtc(nextKey, 0, 0, timeZone),
    keys: weekKeys(weekKey),
    endKey: addDaysToKey(weekKey, 6),
  };
}

export function previewOpensAt(weekKey: string, timeZone: string): Date {
  return localToUtc(addDaysToKey(weekKey, 6), PREVIEW_OPEN_HOUR, 0, timeZone);
}

export function finalizesAt(weekKey: string, timeZone: string): Date {
  return localToUtc(addDaysToKey(weekKey, 8), FINALIZE_HOUR, 0, timeZone);
}

export function phaseOfWeek(weekKey: string, now: Date, timeZone: string): RecapPhase {
  if (now < previewOpensAt(weekKey, timeZone)) return 'NOT_YET';
  if (now < weekBounds(weekKey, timeZone).endUtc) return 'PREVIEW';
  if (now < finalizesAt(weekKey, timeZone)) return 'SYNCING';
  return 'FINAL';
}

/** Which week "latest" means right now: this week during Sunday-evening preview, otherwise the week that just ended. */
export function latestRecapWeek(
  now: Date,
  timeZone: string
): { weekKey: string; phase: RecapPhase } {
  const current = mondayOfKey(localDateKeyOf(now, timeZone));
  const currentPhase = phaseOfWeek(current, now, timeZone);
  if (currentPhase === 'PREVIEW') return { weekKey: current, phase: currentPhase };
  const previous = addDaysToKey(current, -7);
  return { weekKey: previous, phase: phaseOfWeek(previous, now, timeZone) };
}

export function weekRangeLabel(weekKey: string): string {
  const end = addDaysToKey(weekKey, 6);
  const a = parseKey(weekKey);
  const b = parseKey(end);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const start = `${months[a.m - 1]} ${a.d}`;
  return a.m === b.m ? `${start} – ${b.d}` : `${start} – ${months[b.m - 1]} ${b.d}`;
}
