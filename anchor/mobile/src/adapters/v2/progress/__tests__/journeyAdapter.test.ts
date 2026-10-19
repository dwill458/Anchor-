import {
  buildLifetimeStats,
  buildRecentReflection,
  formatFocusTime,
  resolveJourneyState,
} from '../journeyAdapter';
import type { V2ProgressRouteSummary } from '../types';

const route = { total: 4, reachedCount: 2 } as V2ProgressRouteSummary;

describe('resolveJourneyState', () => {
  it('stays loading until both Chart and Vision are known', () => {
    expect(resolveJourneyState({ chartLoading: true, route: null, visionStatus: 'none' })).toBe('loading');
    expect(resolveJourneyState({ chartLoading: false, route, visionStatus: 'loading' })).toBe('loading');
  });

  it('maps the four states', () => {
    expect(resolveJourneyState({ chartLoading: false, route, visionStatus: 'ready' })).toBe('chartVision');
    expect(resolveJourneyState({ chartLoading: false, route, visionStatus: 'none' })).toBe('chartOnly');
    expect(resolveJourneyState({ chartLoading: false, route: null, visionStatus: 'ready' })).toBe('visionOnly');
    expect(resolveJourneyState({ chartLoading: false, route: null, visionStatus: 'none' })).toBe('practiceFirst');
  });

  it('does not invent a Vision when its read failed', () => {
    expect(resolveJourneyState({ chartLoading: false, route, visionStatus: 'error' })).toBe('chartOnly');
    expect(resolveJourneyState({ chartLoading: false, route: null, visionStatus: 'error' })).toBe('practiceFirst');
  });
});

describe('buildLifetimeStats', () => {
  const session = (id: string, anchorId: string, completedAt: string, secs: number, localDateKey?: string) =>
    ({ id, anchorId, completedAt, completedDurationSeconds: secs, localDateKey }) as any;

  it('counts only this Anchor, unique days, and completed seconds', () => {
    const stats = buildLifetimeStats(
      [
        session('a', 'x', '2026-10-01T12:00:00.000Z', 600, '2026-10-01'),
        session('b', 'x', '2026-10-01T18:00:00.000Z', 300, '2026-10-01'),
        session('c', 'x', '2026-10-03T12:00:00.000Z', 60, '2026-10-03'),
        session('d', 'other', '2026-10-04T12:00:00.000Z', 999, '2026-10-04'),
      ],
      ['x'],
      route,
    );
    expect(stats).toMatchObject({ practices: 3, activeDays: 2, totalSeconds: 960, waypointsReached: 2 });
    expect(stats.firstPracticeAt).toBe('2026-10-01T12:00:00.000Z');
  });

  it('is all zeros with no history and no Chart', () => {
    expect(buildLifetimeStats([], ['x'], null)).toEqual({
      practices: 0,
      activeDays: 0,
      totalSeconds: 0,
      firstPracticeAt: null,
      waypointsReached: 0,
    });
  });
});

describe('formatFocusTime', () => {
  it('formats whole minutes', () => {
    expect(formatFocusTime(0)).toBe('0m');
    expect(formatFocusTime(59)).toBe('0m');
    expect(formatFocusTime(46 * 60)).toBe('46m');
    expect(formatFocusTime(166 * 60)).toBe('2h 46m');
    expect(formatFocusTime(125 * 60)).toBe('2h 05m');
  });
});

describe('buildRecentReflection', () => {
  const log = (occurredAt: string, body?: string) => ({ occurredAt, reflection: body ? { body } : undefined }) as any;

  it('returns the newest reflection that has words', () => {
    expect(
      buildRecentReflection([log('2026-10-01T00:00:00Z', 'older'), log('2026-10-05T00:00:00Z', ' newer '), log('2026-10-09T00:00:00Z')]),
    ).toEqual({ text: 'newer', occurredAt: '2026-10-05T00:00:00Z' });
  });

  it('is null when nothing was written', () => {
    expect(buildRecentReflection([log('2026-10-09T00:00:00Z')])).toBeNull();
  });
});
