process.env.TZ = 'America/New_York';

import type { MoveSummary } from '@/types/chart';
import {
  addLocalDays,
  dayChips,
  formatPlanWhen,
  movePlanState,
  planFireDate,
  planSavedToast,
  reminderBody,
  resolveDayChip,
} from '../movePlan';

const move = (overrides: Partial<MoveSummary> = {}): MoveSummary => ({
  id: 'm1',
  courseId: 'c1',
  waypointId: 'w1',
  title: 'Open the curtains',
  rationale: null,
  source: 'USER',
  status: 'ACTIVE',
  position: 100,
  isCurrent: true,
  completedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  plan: null,
  ...overrides,
});
const plan = (date: string | null, time: string | null = null, cue: string | null = 'After I wake up') => ({ cue, date, time, remind: false });

// Monday 16 November 2026, 10:00 local.
const MON = new Date(2026, 10, 16, 10, 0);

describe('movePlanState', () => {
  it('none, planned, today, missed, done', () => {
    expect(movePlanState(move(), MON)).toBe('none');
    expect(movePlanState(move({ plan: plan(null) }), MON)).toBe('planned');
    expect(movePlanState(move({ plan: plan('2026-11-17') }), MON)).toBe('planned');
    expect(movePlanState(move({ plan: plan('2026-11-16') }), MON)).toBe('today');
    expect(movePlanState(move({ plan: plan('2026-11-15') }), MON)).toBe('missed');
    expect(movePlanState(move({ status: 'COMPLETED', plan: plan('2026-11-15') }), MON)).toBe('done');
    expect(movePlanState(move({ status: 'DISMISSED' }), MON)).toBe('done');
  });

  it('crosses midnight by the local calendar, not by 24 hours', () => {
    const lateSunday = new Date(2026, 10, 15, 23, 59);
    const earlyMonday = new Date(2026, 10, 16, 0, 1);
    const sundayPlan = move({ plan: plan('2026-11-15', '23:30') });
    expect(movePlanState(sundayPlan, lateSunday)).toBe('today');
    expect(movePlanState(sundayPlan, earlyMonday)).toBe('missed');
    expect(movePlanState(move({ plan: plan('2026-11-16') }), lateSunday)).toBe('planned');
    expect(movePlanState(move({ plan: plan('2026-11-16') }), earlyMonday)).toBe('today');
  });

  it('keeps the right day across a DST change (US fall back, 1 Nov 2026)', () => {
    const beforeChange = new Date(2026, 9, 31, 23, 30);
    expect(dayChips(beforeChange).map((chip) => chip.date)).toEqual([
      '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
    ]);
    const afterChange = new Date(2026, 10, 1, 23, 30);
    expect(movePlanState(move({ plan: plan('2026-11-01') }), afterChange)).toBe('today');
    expect(movePlanState(move({ plan: plan('2026-10-31') }), afterChange)).toBe('missed');
    // Spring forward (8 Mar 2027): adding a calendar day never skips or repeats a date.
    expect(addLocalDays(new Date(2027, 2, 7, 23, 0), 1).getDate()).toBe(8);
    expect(addLocalDays(new Date(2027, 2, 8, 0, 30), 1).getDate()).toBe(9);
  });
});

describe('resolveDayChip', () => {
  it('maps Today, Tomorrow and the next four weekday names to local dates', () => {
    expect(dayChips(MON).map((chip) => chip.label)).toEqual(['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(resolveDayChip('Today', MON)).toBe('2026-11-16');
    expect(resolveDayChip('Tomorrow', MON)).toBe('2026-11-17');
    expect(resolveDayChip('Thu', MON)).toBe('2026-11-19');
    expect(resolveDayChip('Sat', MON)).toBe('2026-11-21');
    expect(resolveDayChip('Mon', MON)).toBeNull();
  });
  it('rolls over a month end', () => {
    expect(resolveDayChip('Tomorrow', new Date(2026, 10, 30, 9))).toBe('2026-12-01');
  });
});

describe('formatPlanWhen', () => {
  it('renders 12-hour labels', () => {
    expect(formatPlanWhen({ date: '2026-11-16', time: '15:00' }, MON, false)).toBe('Today · 3:00 PM');
    expect(formatPlanWhen({ date: '2026-11-17', time: null }, MON, false)).toBe('Tomorrow');
    expect(formatPlanWhen({ date: '2026-11-19', time: '08:00' }, MON, false)).toBe('Thu · 8:00 AM');
    expect(formatPlanWhen({ date: '2026-11-30', time: null }, MON, false)).toBe('Nov 30');
  });
  it('renders 24-hour labels', () => {
    expect(formatPlanWhen({ date: '2026-11-16', time: '15:00' }, MON, true)).toBe('Today · 15:00');
    expect(formatPlanWhen({ date: '2026-11-19', time: '08:05' }, MON, true)).toBe('Thu · 08:05');
  });
  it('is empty without a day', () => {
    expect(formatPlanWhen({ date: null, time: null }, MON, false)).toBe('');
    expect(formatPlanWhen(null, MON, false)).toBe('');
  });
});

describe('reminder text and fire time', () => {
  it('lowercases the title after a cue', () => {
    expect(reminderBody('After I wake up', 'Open the curtains')).toBe('After I wake up: open the curtains');
    expect(reminderBody(null, 'Open the curtains')).toBe('Open the curtains');
  });
  it('fires at the local wall-clock time', () => {
    const at = planFireDate({ date: '2026-11-17', time: '15:00' })!;
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 10, 17, 15, 0]);
    expect(planFireDate({ date: '2026-11-17', time: null })).toBeNull();
  });
  it('builds the saved toast and drops missing parts', () => {
    expect(planSavedToast({ cue: 'After lunch', date: '2026-11-16', time: '12:30' }, MON, false)).toBe('Plan set: after lunch, today at 12:30 PM');
    expect(planSavedToast({ cue: 'After lunch', date: null, time: null }, MON, false)).toBe('Plan set: after lunch');
    expect(planSavedToast({ cue: null, date: '2026-11-19', time: null }, MON, false)).toBe('Plan set: Thu');
  });
});
