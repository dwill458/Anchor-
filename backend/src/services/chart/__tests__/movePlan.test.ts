import { readFileSync } from 'fs';
import { join } from 'path';
import { EMPTY_PLAN_COLUMNS, resolvePlanWrite, toMovePlan } from '../movePlan';

const NOW = new Date('2026-11-16T15:00:00Z');
const write = (input: Parameters<typeof resolvePlanWrite>[0], current = EMPTY_PLAN_COLUMNS) =>
  resolvePlanWrite(input, current, NOW);
const failure = (fn: () => unknown) => {
  try {
    fn();
  } catch (error: any) {
    return { status: error.statusCode, code: error.code, message: error.message as string };
  }
  throw new Error('expected a validation error');
};

describe('resolvePlanWrite', () => {
  it('accepts a full plan and collapses cue whitespace', () => {
    expect(
      write({ cue: '  After   I wake up ', date: '2026-11-17', time: '15:00', remind: true })
    ).toEqual({
      planCue: 'After I wake up',
      planDate: '2026-11-17',
      planTime: '15:00',
      planRemind: true,
    });
  });

  it('allows a cue with no day', () => {
    expect(write({ cue: 'Before bed' })).toEqual({ ...EMPTY_PLAN_COLUMNS, planCue: 'Before bed' });
  });

  it.each([
    ['2026-02-30', 'not a calendar date'],
    ['2026-13-01', 'month 13'],
    ['26-11-17', 'wrong shape'],
    ['2028-01-01', 'more than a year out'],
    ['2025-11-01', 'more than a year ago'],
  ])('rejects date %s (%s) naming the field', date => {
    const error = failure(() => write({ date }));
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(error.message).toContain('plan.date');
  });

  it('rejects a bad time', () => {
    for (const time of ['24:00', '9:00', '12:60', '3pm']) {
      const error = failure(() => write({ date: '2026-11-17', time }));
      expect(error.message).toContain('plan.time');
    }
  });

  it('rejects a time without a date', () => {
    const error = failure(() => write({ time: '08:00' }));
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(error.message).toContain('plan.time');
  });

  it('rejects a reminder without a time', () => {
    const error = failure(() => write({ date: '2026-11-17', remind: true }));
    expect(error.message).toContain('plan.remind');
  });

  it('rejects a 61 character cue and accepts 60', () => {
    expect(write({ cue: 'a'.repeat(60) }).planCue).toHaveLength(60);
    expect(failure(() => write({ cue: 'a'.repeat(61) })).message).toContain('plan.cue');
    expect(failure(() => write({ cue: '   ' })).message).toContain('plan.cue');
  });

  it('null clears all four fields', () => {
    const current = {
      planCue: 'After lunch',
      planDate: '2026-11-17',
      planTime: '12:30',
      planRemind: true,
    };
    expect(resolvePlanWrite(null, current, NOW)).toEqual(EMPTY_PLAN_COLUMNS);
  });

  it('keeps omitted fields and turns off a reminder that lost its time', () => {
    const current = {
      planCue: 'After lunch',
      planDate: '2026-11-17',
      planTime: '12:30',
      planRemind: true,
    };
    expect(write({ cue: 'After work' }, current)).toEqual({ ...current, planCue: 'After work' });
    expect(write({ time: null }, current)).toEqual({
      ...current,
      planTime: null,
      planRemind: false,
    });
  });
});

describe('toMovePlan', () => {
  it('is null when cue, date and time are all empty', () => {
    expect(
      toMovePlan({ planCue: null, planDate: null, planTime: null, planRemind: false })
    ).toBeNull();
    expect(toMovePlan({})).toBeNull();
  });
  it('returns the plan when any part exists', () => {
    expect(
      toMovePlan({ planCue: null, planDate: '2026-11-17', planTime: null, planRemind: false })
    ).toEqual({
      cue: null,
      date: '2026-11-17',
      time: null,
      remind: false,
    });
  });
});

describe('move_plans migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../../prisma/migrations/20261116000000_move_plans/migration.sql'),
    'utf8'
  );
  it('only adds nullable columns and a defaulted boolean (existing moves untouched)', () => {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^ALTER TABLE "moves"/);
    expect(sql).not.toMatch(/UPDATE|DELETE|DROP|NOT NULL(?! DEFAULT)/);
    for (const column of ['plan_cue', 'plan_date', 'plan_time', 'plan_remind'])
      expect(sql).toContain(`"${column}"`);
    expect(sql).toMatch(/"plan_remind" BOOLEAN NOT NULL DEFAULT false/);
  });
});
