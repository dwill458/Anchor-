import { AppError } from '../../api/middleware/errorHandler';
import type { MovePlan } from '../../types/chart';

/**
 * A Move's optional plan: a cue, the person's local calendar date and local wall-clock time,
 * and whether the device should remind them. Dates and times stay strings: the server never
 * converts time zones (the reminder is scheduled on the device, in device local time).
 */

export const PLAN_CUE_MAX = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 366 * DAY_MS;

export type MovePlanInput = {
  cue?: string | null;
  date?: string | null;
  time?: string | null;
  remind?: boolean;
};

export type MovePlanColumns = {
  planCue: string | null;
  planDate: string | null;
  planTime: string | null;
  planRemind: boolean;
};

export const EMPTY_PLAN_COLUMNS: MovePlanColumns = {
  planCue: null,
  planDate: null,
  planTime: null,
  planRemind: false,
};

/** Trim and collapse whitespace; '' becomes null. Length is checked by the caller. */
export function normalizeCueText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text || null;
}

/** A real Gregorian date in YYYY-MM-DD form (no Feb 30, no month 13). */
export function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function isPlanTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Whole days from `from` to `to`, both YYYY-MM-DD calendar dates. */
export function calendarDaysBetween(from: string, to: string): number {
  const toUtc = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

function withinAYear(date: string, now: Date): boolean {
  const [y, m, d] = date.split('-').map(Number);
  // Noon UTC on that date keeps the check independent of the person's time zone.
  const at = Date.UTC(y, m - 1, d, 12);
  return Math.abs(at - now.getTime()) <= YEAR_MS;
}

function invalid(field: string, message: string): AppError {
  return new AppError(`Validation error: plan.${field}: ${message}`, 400, 'VALIDATION_ERROR', {
    field: `plan.${field}`,
  });
}

/**
 * Validates a plan write against the move's current plan. Omitted fields keep their current
 * value; `null` clears one. `plan: null` clears all four. Throws a 400 VALIDATION_ERROR naming
 * the field on the first failure, before anything is written.
 */
export function resolvePlanWrite(
  input: MovePlanInput | null,
  current: MovePlanColumns,
  now: Date = new Date()
): MovePlanColumns {
  if (input === null) return { ...EMPTY_PLAN_COLUMNS };

  let planCue = current.planCue;
  if (input.cue !== undefined) {
    const cue = normalizeCueText(input.cue);
    if (input.cue !== null && !cue) throw invalid('cue', 'must be 1 to 60 characters');
    if (cue && cue.length > PLAN_CUE_MAX) throw invalid('cue', 'must be 1 to 60 characters');
    planCue = cue;
  }

  let planDate = current.planDate;
  if (input.date !== undefined) {
    if (input.date !== null) {
      if (typeof input.date !== 'string' || !isCalendarDate(input.date))
        throw invalid('date', 'must be a real date as YYYY-MM-DD');
      if (!withinAYear(input.date, now)) throw invalid('date', 'must be within a year of today');
    }
    planDate = input.date;
  }

  let planTime = current.planTime;
  if (input.time !== undefined) {
    if (input.time !== null && (typeof input.time !== 'string' || !isPlanTime(input.time)))
      throw invalid('time', 'must be HH:MM in 24-hour time');
    planTime = input.time;
  }
  if (planTime && !planDate) throw invalid('time', 'a time needs a date');

  let planRemind = current.planRemind;
  if (input.remind !== undefined) {
    if (input.remind && (!planDate || !planTime))
      throw invalid('remind', 'a reminder needs a date and a time');
    planRemind = input.remind;
  } else if (planRemind && (!planDate || !planTime)) {
    // Clearing the date or time quietly turns off a reminder that can no longer fire.
    planRemind = false;
  }

  return { planCue, planDate, planTime, planRemind };
}

export function toMovePlan(move: {
  planCue?: string | null;
  planDate?: string | null;
  planTime?: string | null;
  planRemind?: boolean | null;
}): MovePlan | null {
  const cue = move.planCue ?? null;
  const date = move.planDate ?? null;
  const time = move.planTime ?? null;
  if (cue === null && date === null && time === null) return null;
  return { cue, date, time, remind: Boolean(move.planRemind) };
}

export type ProposedPlan = { cue: string | null; date: string | null; time: string | null };

/** `YYYY-MM-DD` plus `days` calendar days. */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Cleans a plan the model proposed. Never throws: anything unsafe is stripped and the rest kept.
 * A date must fall between the person's today and 13 days later; without their today there are no dates.
 * A time without a date is dropped. The model never controls the reminder.
 */
export function cleanProposedPlan(
  raw: { cue?: unknown; date?: unknown; time?: unknown } | null | undefined,
  clientToday: string | null | undefined
): ProposedPlan {
  const cueText = typeof raw?.cue === 'string' ? normalizeCueText(raw.cue) : null;
  const cue = cueText && cueText.length <= PLAN_CUE_MAX ? cueText : null;
  let date: string | null = null;
  if (clientToday && typeof raw?.date === 'string' && isCalendarDate(raw.date)) {
    const offset = calendarDaysBetween(clientToday, raw.date);
    if (offset >= 0 && offset <= 13) date = raw.date;
  }
  const time = date && typeof raw?.time === 'string' && isPlanTime(raw.time) ? raw.time : null;
  return { cue, date, time };
}

export function isProposedPlanEmpty(plan: ProposedPlan): boolean {
  return !plan.cue && !plan.date && !plan.time;
}
