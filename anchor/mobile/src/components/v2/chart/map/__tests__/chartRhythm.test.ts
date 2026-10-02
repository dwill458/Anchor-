import type { MoveSummary } from '@/types/chart';
import {
  CHART_PANEL_COPY,
  CHART_RHYTHM_COPY,
  daysOnCourse,
  intoPushWindow,
  countInRecapWeek,
  isDayClosed,
  lastCompletedMoveAt,
  movesInRecapWeek,
  movesInWeek,
  nextRecapSlot,
  planChartNotifications,
  practicedToday,
} from '../chartRhythm';
import type { ChartNotificationPlanInput } from '../chartMapContracts';

const move = (over: Partial<MoveSummary> = {}): MoveSummary => ({
  id: 'm',
  courseId: 'c',
  waypointId: 'w',
  title: 'Move',
  rationale: null,
  source: 'USER',
  status: 'COMPLETED',
  position: 0,
  isCurrent: false,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

// Local-time constructors so tests are timezone independent.
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('day state', () => {
  const now = local(2026, 9, 30, 15);
  it('isDayClosed: completed today vs yesterday (local)', () => {
    expect(isDayClosed([move({ completedAt: local(2026, 9, 30, 8).toISOString() })], now)).toBe(true);
    expect(isDayClosed([move({ completedAt: local(2026, 9, 29, 23, 59).toISOString() })], now)).toBe(false);
    expect(isDayClosed([move({ status: 'ACTIVE', completedAt: local(2026, 9, 30, 8).toISOString() })], now)).toBe(false);
    expect(isDayClosed([move({ completedAt: null })], now)).toBe(false);
    expect(isDayClosed([], now)).toBe(false);
  });

  it('daysOnCourse counts local days + 1, never decreases, never below 1', () => {
    const plotted = local(2026, 9, 24, 22).toISOString();
    expect(daysOnCourse(plotted, local(2026, 9, 24, 23))).toBe(1);
    expect(daysOnCourse(plotted, local(2026, 9, 25, 0, 1))).toBe(2);
    expect(daysOnCourse(plotted, local(2026, 9, 30, 9))).toBe(7);
    let prev = 0;
    for (let h = 0; h < 24 * 40; h += 5) {
      const v = daysOnCourse(plotted, new Date(local(2026, 9, 24, 0).getTime() + h * 3600_000));
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(1);
      prev = v;
    }
    // clock skew: plottedAt in the future
    expect(daysOnCourse(local(2026, 10, 5).toISOString(), now)).toBe(1);
    expect(daysOnCourse('not a date', now)).toBe(1);
  });

  it('practicedToday uses the sessionStore local date format', () => {
    expect(practicedToday({ date: '2026-09-30', sessionsCount: 2 }, now)).toBe(true);
    expect(practicedToday({ date: '2026-09-30', sessionsCount: 0 }, now)).toBe(false);
    expect(practicedToday({ date: '2026-09-29', sessionsCount: 3 }, now)).toBe(false);
    expect(practicedToday(null, now)).toBe(false);
    expect(practicedToday(undefined, now)).toBe(false);
  });

  it('lastCompletedMoveAt and movesInWeek', () => {
    const a = local(2026, 9, 28, 9).toISOString();
    const b = local(2026, 9, 29, 9).toISOString();
    const old = local(2026, 9, 10, 9).toISOString();
    const moves = [move({ completedAt: a }), move({ completedAt: b }), move({ completedAt: old }), move({ status: 'ACTIVE' })];
    expect(lastCompletedMoveAt(moves)).toBe(b);
    expect(lastCompletedMoveAt([move({ status: 'ACTIVE' })])).toBeNull();
    expect(movesInWeek(moves, now)).toBe(2);
  });
});

describe('notification planner', () => {
  // Wed 2026-09-30.
  const base = (over: Partial<ChartNotificationPlanInput> = {}): ChartNotificationPlanInput => ({
    anchorId: 'a1',
    now: local(2026, 9, 30, 15),
    lastMoveAt: null,
    idleNudgeScheduledFor: null,
    movesThisWeek: 3,
    practicesThisWeek: 2,
    oneMoveTitle: 'Email ten users',
    destination: 'Ten thousand users',
    weeklySummaryEnabled: false,
    notificationsEnabled: true,
    permissionGranted: true,
    alreadyScheduled: [],
    ...over,
  });

  it('schedules the next Sunday 6 pm recap strictly after now', () => {
    const plans = planChartNotifications(base());
    expect(plans).toHaveLength(1);
    expect(plans[0].kind).toBe('recap');
    expect(plans[0].id).toBe('chart-recap:a1');
    expect(plans[0].deepLink).toBe('anchor://v2/chart/a1');
    expect(plans[0].fireDate).toEqual(local(2026, 10, 4, 18));
    expect(plans[0].title).toBe('Your week on the Chart');
    expect(plans[0].body).toBe('3 moves this week, and 2 practices. Next: Email ten users.');
  });

  it('on Sunday before 18:00 the slot is today; at/after it is next week', () => {
    expect(nextRecapSlot(local(2026, 10, 4, 10))).toEqual(local(2026, 10, 4, 18));
    expect(nextRecapSlot(local(2026, 10, 4, 18))).toEqual(local(2026, 10, 11, 18));
    expect(nextRecapSlot(local(2026, 10, 4, 19))).toEqual(local(2026, 10, 11, 18));
  });

  it('none when notifications are off or permission is missing', () => {
    const last = local(2026, 9, 20).toISOString();
    expect(planChartNotifications(base({ notificationsEnabled: false, lastMoveAt: last }))).toEqual([]);
    expect(planChartNotifications(base({ permissionGranted: false, lastMoveAt: last }))).toEqual([]);
  });

  it('skips the recap when the Weekly Summary is enabled', () => {
    expect(planChartNotifications(base({ weeklySummaryEnabled: true }))).toEqual([]);
    const last = local(2026, 9, 27, 10).toISOString();
    const plans = planChartNotifications(base({ weeklySummaryEnabled: true, lastMoveAt: last }));
    expect(plans.map((p) => p.kind)).toEqual(['idle']);
  });

  it('idle fires 48 hours after the last move, inside the window', () => {
    const last = local(2026, 9, 30, 10).toISOString();
    const idle = planChartNotifications(base({ lastMoveAt: last })).find((p) => p.kind === 'idle');
    expect(idle?.id).toBe('chart-idle:a1');
    expect(idle?.fireDate).toEqual(local(2026, 10, 2, 10));
    expect(idle?.body).toBe('Email ten users. Two minutes is enough.');
    // before 9:00 -> 9:00 same day; after 20:00 -> 9:00 next day
    const early = planChartNotifications(base({ lastMoveAt: local(2026, 9, 30, 6).toISOString() })).find((p) => p.kind === 'idle');
    expect(early?.fireDate).toEqual(local(2026, 10, 2, 9));
    const late = planChartNotifications(base({ lastMoveAt: local(2026, 9, 30, 21).toISOString() })).find((p) => p.kind === 'idle');
    expect(late?.fireDate).toEqual(local(2026, 10, 3, 9));
  });

  it('idle only after a move exists, and only once per lastMoveAt', () => {
    expect(planChartNotifications(base({ lastMoveAt: null })).some((p) => p.kind === 'idle')).toBe(false);
    const last = local(2026, 9, 30, 10).toISOString();
    expect(planChartNotifications(base({ lastMoveAt: last, idleNudgeScheduledFor: last })).some((p) => p.kind === 'idle')).toBe(false);
    const newer = local(2026, 9, 30, 11).toISOString();
    expect(planChartNotifications(base({ lastMoveAt: newer, idleNudgeScheduledFor: last })).some((p) => p.kind === 'idle')).toBe(true);
  });

  it('when the idle stretch already passed it lands in the next window slot at least 15 minutes out', () => {
    const last = local(2026, 9, 20, 10).toISOString();
    const idle = planChartNotifications(base({ lastMoveAt: last })).find((p) => p.kind === 'idle');
    expect(idle?.fireDate).toEqual(local(2026, 9, 30, 15, 15));
    const night = planChartNotifications(base({ lastMoveAt: last, now: local(2026, 9, 30, 21) })).find((p) => p.kind === 'idle');
    expect(night?.fireDate).toEqual(local(2026, 10, 1, 9));
  });

  it('caps chart pushes at 2 per local week, dropping idle first', () => {
    // recap Sun Oct 4 (week of Mon Sep 28); idle Fri Oct 2 is in the same week.
    const last = local(2026, 9, 30, 10).toISOString();
    const both = planChartNotifications(base({ lastMoveAt: last }));
    expect(both.map((p) => p.kind)).toEqual(['recap', 'idle']);
    const one = planChartNotifications(
      base({ lastMoveAt: last, alreadyScheduled: [{ kind: 'recap', fireDate: local(2026, 9, 29, 18).toISOString() }] })
    );
    expect(one.map((p) => p.kind)).toEqual(['recap']);
    const none = planChartNotifications(
      base({
        lastMoveAt: last,
        alreadyScheduled: [
          { kind: 'recap', fireDate: local(2026, 9, 29, 18).toISOString() },
          { kind: 'idle', fireDate: local(2026, 9, 28, 10).toISOString() },
        ],
      })
    );
    expect(none).toEqual([]);
    // a prior-week push does not count against this week
    const prior = planChartNotifications(
      base({ lastMoveAt: last, alreadyScheduled: [{ kind: 'recap', fireDate: local(2026, 9, 27, 18).toISOString() }] })
    );
    expect(prior.map((p) => p.kind)).toEqual(['recap', 'idle']);
  });

  it('never exceeds 2 per week across many inputs', () => {
    for (let day = 0; day < 21; day++) {
      const now = local(2026, 9, 1 + day, 14);
      const plans = planChartNotifications(base({ now, lastMoveAt: local(2026, 9, 1 + day, 9).toISOString() }));
      const weeks = new Map<string, number>();
      plans.forEach((p) => {
        const d = new Date(p.fireDate.getFullYear(), p.fireDate.getMonth(), p.fireDate.getDate() - ((p.fireDate.getDay() + 6) % 7));
        const k = d.toDateString();
        weeks.set(k, (weeks.get(k) ?? 0) + 1);
      });
      weeks.forEach((n) => expect(n).toBeLessThanOrEqual(2));
    }
  });

  it('intoPushWindow leaves in-window times alone', () => {
    const at = local(2026, 9, 30, 13);
    expect(intoPushWindow(at)).toBe(at);
  });
});

describe('copy', () => {
  it('recap body variants', () => {
    expect(CHART_RHYTHM_COPY.recapBody({ moves: 1, practices: 0, oneMove: 'Call Sam' })).toBe('1 move this week. Next: Call Sam.');
    expect(CHART_RHYTHM_COPY.recapBody({ moves: 2, practices: 1, oneMove: null })).toBe('2 moves this week, and 1 practice.');
    expect(CHART_RHYTHM_COPY.recapBody({ moves: 0, practices: 3, oneMove: 'Call Sam' })).toBe('3 practices this week. Next: Call Sam.');
    expect(CHART_RHYTHM_COPY.recapBody({ moves: 0, practices: 0, oneMove: 'Call Sam' })).toBe(
      'Your course is right where you left it. Next: Call Sam.'
    );
    expect(CHART_RHYTHM_COPY.recapBody({ moves: 0, practices: 0, oneMove: null })).toBe('Your Vision is waiting on the Chart.');
    expect(CHART_RHYTHM_COPY.idleBody(null)).toBe('Your course is here when you are.');
  });

  it('panel copy matches the section 13 table', () => {
    expect(CHART_PANEL_COPY.dayClosedTitle).toBe("Today's move is done.");
    expect(CHART_PANEL_COPY.confirmTitle('Ten thousand')).toBe('Have you reached “Ten thousand” in the real world?');
    expect(CHART_PANEL_COPY.chips.map((c) => c.label)).toEqual(['−10', '+10', '+50', '+100']);
    expect(CHART_PANEL_COPY.chips.map((c) => c.value)).toEqual([-10, 10, 50, 100]);
    expect(CHART_PANEL_COPY.position(2, 5)).toBe('2 of 5');
    expect(CHART_PANEL_COPY.log(7)).toBe('Course log · 7 days on course');
    expect(CHART_PANEL_COPY.log(1)).toBe('Course log · 1 days on course');
  });

  it('contains no guilt or streak language anywhere', () => {
    const forbidden = /\b(streak|missed|broke|broken|lost|behind|failed|don't|didn't)\b/i;
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
      else if (typeof value === 'function') {
        const fn = value as (...args: unknown[]) => unknown;
        const argSets: unknown[][] = [
          [1, 5],
          ['Example'],
          [{ moves: 0, practices: 0, oneMove: null }],
          [{ moves: 2, practices: 1, oneMove: 'Write one line' }],
          [null],
        ];
        argSets.forEach((args) => {
          try {
            const out = fn(...args);
            if (typeof out === 'string') strings.push(out);
          } catch {
            /* wrong argument shape for this sampler */
          }
        });
      }
    };
    walk(CHART_RHYTHM_COPY);
    walk(CHART_PANEL_COPY);
    expect(strings.length).toBeGreaterThan(20);
    strings.forEach((s) => expect(s).not.toMatch(forbidden));
  });
});

describe('recap week window', () => {
  const fire = local(2026, 10, 4, 18); // Sunday; week starts Mon Sep 28 00:00
  it('counts from Monday 00:00 up to the fire date', () => {
    const inWeek = [local(2026, 9, 28, 0, 0), local(2026, 10, 1, 9), local(2026, 10, 4, 18)].map((d) => d.toISOString());
    const out = [local(2026, 9, 27, 23, 59), local(2026, 10, 4, 18, 1)].map((d) => d.toISOString());
    expect(countInRecapWeek([...inWeek, ...out, 'bad'], fire)).toBe(3);
    const moves = [...inWeek, ...out].map((iso) => move({ completedAt: iso }));
    expect(movesInRecapWeek([...moves, move({ status: 'ACTIVE', completedAt: inWeek[0] })], fire)).toBe(3);
  });
});
