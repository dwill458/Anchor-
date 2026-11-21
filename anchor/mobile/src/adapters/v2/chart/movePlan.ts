import type { MovePlan, MoveSummary } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { formatDisplay } from '@/utils/reminderTime';
import { localDateKey } from './chartDayRhythm';

/**
 * Pure helpers for a Move's plan. Dates are the person's LOCAL calendar dates
 * (`YYYY-MM-DD`) and times their local wall clock (`HH:MM`, 24h). Day arithmetic
 * goes through local calendar fields, never fixed 24h steps, so midnight and DST
 * changes land on the right day.
 */

export type MovePlanState = 'none' | 'planned' | 'today' | 'missed' | 'done';

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Local midnight of a `YYYY-MM-DD` date, or null when it is not one. */
export function parsePlanDate(value: string | null | undefined): Date | null {
  const match = typeof value === 'string' ? DATE_RE.exec(value) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** The local date `days` calendar days after `from`. */
export function addLocalDays(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}

/** Whole calendar days from `now`'s local date to `date` (negative in the past). */
export function calendarDaysFrom(now: Date, date: string): number | null {
  const target = parsePlanDate(date);
  if (!target) return null;
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end - start) / 86_400_000);
}

export function hasPlan(plan: MovePlan | null | undefined): plan is MovePlan {
  return Boolean(plan && (plan.cue || plan.date || plan.time));
}

export function movePlanState(move: Pick<MoveSummary, 'status' | 'plan'>, now: Date): MovePlanState {
  if (move.status === 'COMPLETED' || move.status === 'DISMISSED') return 'done';
  const plan = move.plan;
  if (!hasPlan(plan)) return 'none';
  if (!plan.date) return 'planned';
  const today = localDateKey(now);
  if (plan.date < today) return 'missed';
  if (plan.date === today) return 'today';
  return 'planned';
}

export type DayChip = { label: string; date: string };

/** Today, Tomorrow, then the next four weekday names. */
export function dayChips(now: Date): DayChip[] {
  return Array.from({ length: 6 }, (_, offset) => {
    const date = addLocalDays(now, offset);
    const label = offset === 0 ? CHART_COPY.plan.today : offset === 1 ? CHART_COPY.plan.tomorrow : SHORT_WEEKDAYS[date.getDay()];
    return { label, date: localDateKey(date) };
  });
}

/** Maps a day chip label (Today, Tomorrow, or one of the next four weekday names) to a local date. */
export function resolveDayChip(label: string, now: Date): string | null {
  return dayChips(now).find((chip) => chip.label === label)?.date ?? null;
}

/**
 * True when the device shows a 24-hour clock, from the locale's preferred hour cycle.
 * Falls back to 12-hour when Intl cannot say.
 */
export function deviceUses24HourClock(): boolean {
  try {
    const options = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions() as Intl.ResolvedDateTimeFormatOptions & {
      hourCycle?: string;
    };
    if (options.hourCycle) return options.hourCycle === 'h23' || options.hourCycle === 'h24';
    return options.hour12 === false;
  } catch {
    return false;
  }
}

export function formatPlanTime(time: string, use24h = deviceUses24HourClock()): string {
  return TIME_RE.test(time) ? formatDisplay(time, use24h) : time;
}

/** "Today", "Tomorrow", a weekday within a week either side ("Thu"), otherwise "Nov 30". */
export function formatPlanDay(date: string, now: Date): string {
  const parsed = parsePlanDate(date);
  const days = calendarDaysFrom(now, date);
  if (!parsed || days === null) return date;
  if (days === 0) return CHART_COPY.plan.today;
  if (days === 1) return CHART_COPY.plan.tomorrow;
  if (days > -7 && days < 7) return SHORT_WEEKDAYS[parsed.getDay()];
  return `${SHORT_MONTHS[parsed.getMonth()]} ${parsed.getDate()}`;
}

/** "Today · 3:00 PM", "Tomorrow", "Thu · 8:00 AM". Empty when the plan has no day. */
export function formatPlanWhen(plan: Pick<MovePlan, 'date' | 'time'> | null | undefined, now: Date, use24h = deviceUses24HourClock()): string {
  if (!plan?.date) return '';
  const day = formatPlanDay(plan.date, now);
  return plan.time ? `${day} · ${formatPlanTime(plan.time, use24h)}` : day;
}

/** Local fire moment of a planned date + time, or null when either is missing or invalid. */
export function planFireDate(plan: Pick<MovePlan, 'date' | 'time'> | null | undefined): Date | null {
  const day = parsePlanDate(plan?.date);
  const match = typeof plan?.time === 'string' ? TIME_RE.exec(plan.time) : null;
  if (!day || !match) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]));
}

/** Lowercase the first letter: "Open the curtains" → "open the curtains". */
export function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** Body for the reminder push and its preview. */
export function reminderBody(cue: string | null | undefined, title: string): string {
  const trimmed = cue?.trim();
  return trimmed ? `${trimmed}: ${lowerFirst(title)}` : title;
}

/** "Plan set: after lunch, today at 12:30 PM", dropping whatever is missing. */
export function planSavedToast(plan: Pick<MovePlan, 'cue' | 'date' | 'time'>, now: Date, use24h = deviceUses24HourClock()): string {
  // Only the first letter is lowered: "after I wake up", and weekday names keep their capital ("Thu").
  const cue = lowerFirst(plan.cue?.trim() || '');
  const day = plan.date ? formatPlanDay(plan.date, now) : '';
  const dayText = SHORT_WEEKDAYS.includes(day as (typeof SHORT_WEEKDAYS)[number]) ? day : lowerFirst(day);
  const time = plan.time ? formatPlanTime(plan.time, use24h) : '';
  const when = dayText && time ? `${dayText} at ${time}` : dayText || (time ? `at ${time}` : '');
  const parts = [cue, when].filter(Boolean).join(', ');
  return parts ? `Plan set: ${parts}` : 'Plan set';
}
