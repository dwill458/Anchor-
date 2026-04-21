export type PrimingSessionType = 'activate' | 'reinforce';
export type TimeOfDayBucket = 'late_night' | 'morning' | 'afternoon' | 'evening';

export interface PrimingHistoryEntry {
  id: string;
  anchorId: string;
  type: PrimingSessionType;
  completedAt: string;
  localDate: string;
  weekKey: string;
  weekStart: string;
  weekdayIndex: number;
  hourOfDay: number;
  timeOfDay: TimeOfDayBucket;
}

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const TIME_OF_DAY_LABELS: Record<TimeOfDayBucket, string> = {
  late_night: 'late nights',
  morning: 'mornings',
  afternoon: 'afternoons',
  evening: 'evenings',
};

function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

export function parseLocalDateString(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = createLocalDate(Number(year), Number(month), Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfIsoWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOffset);
  return start;
}

export function localWeekStartString(date: Date): string {
  return localDateString(startOfIsoWeek(date));
}

export function isoWeekKey(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function isoWeekNumber(date: Date): number {
  const match = isoWeekKey(date).match(/W(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

export function getIsoWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function getTimeOfDayBucket(hourOfDay: number): TimeOfDayBucket {
  if (hourOfDay >= 5 && hourOfDay < 12) {
    return 'morning';
  }

  if (hourOfDay >= 12 && hourOfDay < 17) {
    return 'afternoon';
  }

  if (hourOfDay >= 17 && hourOfDay < 21) {
    return 'evening';
  }

  return 'late_night';
}

export function isPrimingSessionType(value: string): value is PrimingSessionType {
  return value === 'activate' || value === 'reinforce';
}

export function buildPrimingHistoryEntry(params: {
  id: string;
  anchorId: string;
  type: PrimingSessionType;
  completedAt: string;
}): PrimingHistoryEntry | null {
  const completedAtDate = new Date(params.completedAt);
  if (Number.isNaN(completedAtDate.getTime())) {
    return null;
  }

  const hourOfDay = completedAtDate.getHours();

  return {
    id: params.id,
    anchorId: params.anchorId,
    type: params.type,
    completedAt: params.completedAt,
    localDate: localDateString(completedAtDate),
    weekKey: isoWeekKey(completedAtDate),
    weekStart: localWeekStartString(completedAtDate),
    weekdayIndex: getIsoWeekdayIndex(completedAtDate),
    hourOfDay,
    timeOfDay: getTimeOfDayBucket(hourOfDay),
  };
}

export function diffWeeksInclusive(startWeekStart: string, endWeekStart: string): number {
  const start = parseLocalDateString(startWeekStart);
  const end = parseLocalDateString(endWeekStart);

  if (!start || !end) {
    return 1;
  }

  const diffMs = startOfIsoWeek(end).getTime() - startOfIsoWeek(start).getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 86_400_000)) + 1);
}
