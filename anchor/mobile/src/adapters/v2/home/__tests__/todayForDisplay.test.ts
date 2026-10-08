import { buildTodayForDisplay, planTodaySwap, todayCardMode, type TodayForDisplayInput } from '../todayForDisplay';
import type { V2HomeTodayState } from '../useV2HomeModel';

const ready = (mode: 'focus' | 'visualize' | 'deep_prime' | 'release', durationSeconds = 30): V2HomeTodayState => ({
  state: 'ready',
  mode,
  action: 'Focus',
  reason: 'daily_focus',
  completionSignal: null,
  threadDelta: null,
  threadDeltaStatus: 'UNAVAILABLE',
  durationSeconds,
});

const base = (overrides: Partial<TodayForDisplayInput> = {}): TodayForDisplayInput => ({
  today: ready('focus'),
  completed: [],
  hasVision: true,
  chartArcComplete: false,
  durationByMode: { focus: 30, deep_prime: 120, visualize: 60 },
  ...overrides,
});

describe('buildTodayForDisplay', () => {
  it('shows the server recommendation untouched until something is completed today', () => {
    const today = ready('focus');
    expect(buildTodayForDisplay(base({ today }))).toBe(today);
  });

  it('after a Focus, points the card at Visualize and keeps the server fields', () => {
    const card = buildTodayForDisplay(base({ completed: [{ id: 's1', practiceMode: 'focus', completedDurationSeconds: 30 }] }));
    expect(card).toMatchObject({
      state: 'ready',
      mode: 'focus',
      reason: 'daily_focus',
      doneToday: { completedMode: 'focus', nextMode: 'visualize', durationSeconds: 60, completedDurationSeconds: 30 },
    });
    expect(todayCardMode(card)).toBe('visualize');
  });

  it('uses Deep Focus next when there is no Vision', () => {
    const card = buildTodayForDisplay(base({ hasVision: false, completed: [{ practiceMode: 'focus' }] }));
    expect(todayCardMode(card)).toBe('deep_prime');
  });

  it('builds a card from the next practice when the server recommendation is not ready', () => {
    const card = buildTodayForDisplay(base({ today: { state: 'loading' }, completed: [{ practiceMode: 'focus' }] }));
    expect(card).toMatchObject({ state: 'ready', mode: 'visualize', action: 'Visualize', doneToday: { nextMode: 'visualize', durationSeconds: 60 } });
  });

  it('leaves a non-ready recommendation alone when nothing is left to point at', () => {
    const loading: V2HomeTodayState = { state: 'loading' };
    expect(buildTodayForDisplay(base({ today: loading, completed: [] }))).toBe(loading);
  });

  it('reports no mode for a card that shows no practice', () => {
    expect(todayCardMode({ state: 'loading' })).toBeNull();
    expect(todayCardMode({ state: 'none' })).toBeNull();
  });
});

describe('planTodaySwap', () => {
  const focusDone = [{ id: 's1', practiceMode: 'focus' as const }];

  it('swaps Focus for Visualize when this completion moved the recommendation, and hands back the card Home showed before', () => {
    const plan = planTodaySwap({ ...base({ completed: focusDone }), sessionId: 's1' });
    expect(plan.changed).toBe(true);
    if (!plan.changed) return;
    expect(plan.fromMode).toBe('focus');
    expect(plan.toMode).toBe('visualize');
    // The card before is the plain recommendation, not a done card.
    expect(plan.from).toMatchObject({ state: 'ready', mode: 'focus' });
    expect((plan.from as { doneToday?: unknown }).doneToday).toBeUndefined();
  });

  it('does not swap when the recommendation did not change because of this completion', () => {
    // The server already recommended Visualize, and Focus was the only thing completed: the card
    // pointed at Visualize before and after.
    const plan = planTodaySwap({ ...base({ today: ready('visualize'), completed: focusDone }), sessionId: 's1' });
    expect(plan).toEqual({ changed: false });
  });

  it('does not swap when the completed session is not among today\'s sessions for this Anchor', () => {
    expect(planTodaySwap({ ...base({ completed: focusDone }), sessionId: 'someone-else' })).toEqual({ changed: false });
  });

  it('does not swap for a completion with no session id', () => {
    expect(planTodaySwap({ ...base({ completed: focusDone }), sessionId: null })).toEqual({ changed: false });
  });

  it('does not swap when either card shows no practice', () => {
    expect(planTodaySwap({ ...base({ today: { state: 'loading' }, completed: [] }), sessionId: 's1' })).toEqual({ changed: false });
  });

  it('compares against the previous done card on a second practice of the day', () => {
    // Focus first (card pointed at Visualize), then Visualize (card now points at Deep Focus).
    const completed = [
      { id: 's2', practiceMode: 'visualize' as const },
      { id: 's1', practiceMode: 'focus' as const },
    ];
    const plan = planTodaySwap({ ...base({ completed }), sessionId: 's2' });
    expect(plan.changed).toBe(true);
    if (!plan.changed) return;
    expect(plan.fromMode).toBe('visualize');
    expect(plan.toMode).toBe('deep_prime');
    expect(plan.from).toMatchObject({ doneToday: { completedMode: 'focus', nextMode: 'visualize' } });
  });

  it('does not swap once every practice is done and the card keeps pointing at the same one', () => {
    const completed = [
      { id: 's3', practiceMode: 'deep_prime' as const },
      { id: 's2', practiceMode: 'visualize' as const },
      { id: 's1', practiceMode: 'focus' as const },
    ];
    // Before s3: Deep Focus was next. After: all done, so the card falls back to the server mode (Focus).
    const plan = planTodaySwap({ ...base({ completed }), sessionId: 's3' });
    expect(plan.changed).toBe(true);
    const unchanged = planTodaySwap({ ...base({ today: ready('deep_prime'), completed }), sessionId: 's3' });
    expect(unchanged).toEqual({ changed: false });
  });
});
