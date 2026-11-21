import { cleanClientToday, normalizeAskTurn, normalizeScope } from '../askChartSchema';
import { describeMovePlan, describeToday } from '../askChartPrompt';
import { normalizeMove } from '../../chartPlanSchema';

const TODAY = '2026-11-16';
const turn = (action: Record<string, unknown>) => ({
  reply: 'Here is a plan.',
  suggestions: [],
  requestPhoto: null,
  readyToPlan: false,
  startingPoint: null,
  context: null,
  action: {
    scope: 'MOVE',
    waypointId: 'wp',
    moves: [],
    moveEdit: null,
    plans: [],
    reason: null,
    routeReason: null,
    detail: null,
    summary: 'Plan',
    ...action,
  },
  remember: null,
});
const move = (plan: Record<string, unknown>) => ({ title: 'Open the curtains', detail: 'Light first.', ...plan });

describe('normalizeAskTurn plans', () => {
  it('keeps a plan inside the 14-day window', () => {
    const result = normalizeAskTurn(turn({ type: 'ADD_MOVES', moves: [move({ cue: 'After I wake up', date: '2026-11-29', time: '15:00' })] }), { clientToday: TODAY });
    expect(result.action!.moves[0]).toMatchObject({ cue: 'After I wake up', date: '2026-11-29', time: '15:00' });
  });

  it('strips (not rejects) a date outside the window, with its time', () => {
    for (const date of ['2026-11-30', '2026-11-15', '2026-02-30', 'tomorrow']) {
      const result = normalizeAskTurn(turn({ type: 'ADD_MOVES', moves: [move({ cue: 'After lunch', date, time: '12:30' })] }), { clientToday: TODAY });
      expect(result.action!.moves[0]).toMatchObject({ title: 'Open the curtains', cue: 'After lunch', date: null, time: null });
    }
  });

  it('strips a time without a date and a 61-character cue', () => {
    const result = normalizeAskTurn(
      turn({ type: 'ADD_MOVES', moves: [move({ cue: 'a'.repeat(61), date: null, time: '08:00' })] }),
      { clientToday: TODAY }
    );
    expect(result.action!.moves[0]).toMatchObject({ title: 'Open the curtains', cue: null, date: null, time: null });
  });

  it('drops every date when the person’s today is unknown', () => {
    const result = normalizeAskTurn(turn({ type: 'ADD_MOVES', moves: [move({ cue: 'After work', date: '2026-11-17', time: '18:00' })] }));
    expect(result.action!.moves[0]).toMatchObject({ cue: 'After work', date: null, time: null });
  });

  it('cleans the moveEdit plan the same way', () => {
    const result = normalizeAskTurn(
      turn({ type: 'REVISE_ROUTE', scope: 'ROUTE', moveEdit: { title: 'Open the curtains', detail: null, cue: 'After I wake up', date: '2026-12-25', time: '07:00' } }),
      { clientToday: TODAY }
    );
    expect(result.action!.moveEdit).toEqual({ title: 'Open the curtains', detail: null, cue: 'After I wake up', date: null, time: null });
  });

  it('PLAN_MOVES keeps only plannable move ids, at most three, and drops the action when empty', () => {
    const plannable = new Set(['a', 'b', 'c', 'd']);
    const plans = ['a', 'ghost', 'completed', 'b', 'a', 'c', 'd'].map(moveId => ({ moveId, cue: null, date: '2026-11-17', time: null }));
    const kept = normalizeAskTurn(turn({ type: 'PLAN_MOVES', plans }), { clientToday: TODAY, plannableMoveIds: plannable });
    expect(kept.action!.plans.map(plan => plan.moveId)).toEqual(['a', 'b', 'c']);
    expect(kept.action!.scope).toBe('MOVE');
    const empty = normalizeAskTurn(turn({ type: 'PLAN_MOVES', plans: [{ moveId: 'ghost', cue: null, date: null, time: null }] }), { clientToday: TODAY, plannableMoveIds: plannable });
    expect(empty.action).toBeNull();
  });

  it('PLAN_MOVES scope is MOVE whatever the model says', () => {
    expect(normalizeScope('PLAN_MOVES', 'ROUTE')).toBe('MOVE');
  });

  it('older turns without plan fields still parse', () => {
    const result = normalizeAskTurn({ ...turn({ type: 'ADD_MOVES', moves: [{ title: 'Open the curtains', detail: null }] }), action: { type: 'ADD_MOVES', moves: [{ title: 'Open the curtains', detail: null }], summary: 'x' } });
    expect(result.action!.moves[0]).toMatchObject({ title: 'Open the curtains', cue: null, date: null, time: null });
    expect(result.action!.plans).toEqual([]);
  });
});

describe('client today', () => {
  it('drops a bad date and corrects a wrong weekday', () => {
    expect(cleanClientToday('2026-11-16', 'Mon')).toEqual({ date: '2026-11-16', weekday: 'Mon' });
    expect(cleanClientToday('2026-11-16', 'Fri')).toEqual({ date: '2026-11-16', weekday: 'Mon' });
    expect(cleanClientToday('2026-11-16', 'Monday')).toEqual({ date: '2026-11-16', weekday: 'Mon' });
    expect(cleanClientToday('2026-13-01', 'Mon')).toBeNull();
    expect(cleanClientToday(undefined, undefined)).toBeNull();
  });
  it('is stated as one line', () => {
    expect(describeToday({ date: '2026-11-16', weekday: 'Mon' })).toBe('Today for the person is Mon, 2026-11-16.');
    expect(describeToday(null)).toBe("You do not know today's date for the person. Do not propose dates.");
  });
});

describe('describeMovePlan', () => {
  it('renders a planned move and an unplanned one', () => {
    expect(describeMovePlan({ cue: 'After I wake up', date: '2026-11-17', time: '15:00' })).toBe('planned: After I wake up, Tue 2026-11-17 15:00');
    expect(describeMovePlan({ cue: 'Before bed', date: null, time: null })).toBe('planned: Before bed');
    expect(describeMovePlan(null)).toBe('no plan');
    expect(describeMovePlan(undefined)).toBe('no plan');
  });
});

describe('planner cue', () => {
  it('survives normalizeMove, cleaned; a long or missing cue becomes null', () => {
    expect(normalizeMove({ title: 'Open the curtains', rationale: null, cue: '  After   I wake up ' })).toEqual({ title: 'Open the curtains', rationale: null, cue: 'After I wake up' });
    expect(normalizeMove({ title: 'Open the curtains', rationale: null, cue: 'a'.repeat(61) })!.cue).toBeNull();
    expect(normalizeMove({ title: 'Open the curtains', rationale: null })!.cue).toBeNull();
  });
});
