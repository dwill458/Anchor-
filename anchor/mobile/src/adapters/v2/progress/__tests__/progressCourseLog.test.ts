import { buildProgressInsight, strongestRunLabel } from '../progressInsight';
import {
  buildAnchorWeek,
  buildHeatmap,
  buildRhythm,
  buildRouteSummary,
  deriveThreadEvents,
  toV2ProgressModel,
} from '../progressAdapter';
import type { V2ProgressRouteSummary, V2ProgressWeek } from '../types';

const week = (days: string): V2ProgressWeek => ({
  days: days.split('').map((c) => c === 'x'),
  todayIndex: 4,
});

const route = (percent: string | null): V2ProgressRouteSummary => ({
  currentIndex: 0,
  total: 5,
  currentTitle: 'First thousand active users',
  currentMetric: percent ? { display: '340 / 1,000', percentLabel: percent, fraction: 0.34 } : null,
  reachedCount: 0,
  isFinished: false,
  waypoints: [],
});

describe('buildProgressInsight', () => {
  it('reads strong practice with Moves as a strengthened rhythm', () => {
    const insight = buildProgressInsight({ week: week('.xxxx..'), moves: 2, route: route('34%') });
    expect(insight.headline).toBe('Your rhythm strengthened this week.');
    expect(insight.support).toBe(
      'You practiced on 4 days and completed 2 real-world moves. Your strongest rhythm was Tuesday–Friday.',
    );
  });

  it('says movement slowed when practice is steady but no Move landed', () => {
    const insight = buildProgressInsight({ week: week('xx.x...'), moves: 0, route: route('34%') });
    expect(insight.headline).toBe("You're practicing consistently, but movement slowed this week.");
    expect(insight.support).toBe('Your next waypoint is still 34% complete. One Move can get things moving again.');
  });

  it('does not quote a percentage the waypoint has no measure for', () => {
    const insight = buildProgressInsight({ week: week('xxx....'), moves: 0, route: route(null) });
    expect(insight.support).toBe('Your next waypoint is still ahead. One Move can get things moving again.');
  });

  it('does not claim slowed movement when there is no Chart', () => {
    const insight = buildProgressInsight({ week: week('xxx....'), moves: 0, route: null });
    expect(insight.headline).toBe('Your practice rhythm held this week.');
  });

  it('encourages rebuilding on low practice and never blames', () => {
    expect(buildProgressInsight({ week: week('x......'), moves: 0, route: null }).headline).toBe(
      'Your rhythm is still finding its shape.',
    );
    expect(buildProgressInsight({ week: week('.......'), moves: 0, route: null }).headline).toBe(
      'This week is still open.',
    );
  });

  it('names a lone Move toward the destination', () => {
    const insight = buildProgressInsight({ week: week('.x.....'), moves: 1, route: route('34%') });
    expect(insight.headline).toBe('You moved toward your destination.');
    expect(insight.support).toContain('1 real-world move');
  });

  it('is deterministic and never uses streak language', () => {
    const input = { week: week('xxxxx..'), moves: 1, route: route('34%') };
    expect(buildProgressInsight(input)).toEqual(buildProgressInsight(input));
    expect(JSON.stringify(buildProgressInsight(input))).not.toMatch(/streak/i);
  });
});

describe('strongestRunLabel', () => {
  it('picks the longest run, earliest on a tie, and ignores single days', () => {
    expect(strongestRunLabel([false, true, true, true, false, false, false])).toBe('Tuesday–Thursday');
    expect(strongestRunLabel([true, true, false, true, true, false, false])).toBe('Monday–Tuesday');
    expect(strongestRunLabel([true, false, true, false, false, false, false])).toBeNull();
  });
});

describe('Course log events', () => {
  const now = new Date(2026, 9, 5, 12, 0);
  const anchor = { id: 'a1', localId: 'l1', intentionText: 'Ship it', threadStrength: 60, createdAt: new Date(2026, 8, 1) } as any;
  const session = (id: string, mode: string, seconds: number, at: Date) =>
    ({ id, anchorId: 'a1', practiceMode: mode, completedDurationSeconds: seconds, completedAt: at.toISOString() }) as any;
  const moveLog = (id: string, at: Date, extra: Record<string, unknown> = {}) =>
    ({
      id,
      eventType: 'MOVE_COMPLETED',
      message: '',
      waypointId: 'w1',
      occurredAt: at.toISOString(),
      recordedAt: at.toISOString(),
      snapshot: { moveTitle: 'Set up analytics' },
      reflection: null,
      practiceSession: null,
      anchorLink: null,
      ...extra,
    }) as any;

  it('lists each practice with its mode and minutes', () => {
    const events = deriveThreadEvents(anchor, [], [
      session('s1', 'focus', 600, new Date(2026, 9, 5, 0, 54)),
      session('s2', 'deep_prime', 90, new Date(2026, 9, 4, 9, 0)),
      session('s3', 'visualize', 30, new Date(2026, 9, 3, 9, 0)),
    ]);
    const practice = events.filter((e) => e.type === 'PRACTICE_COMPLETED');
    expect(practice.map((e) => e.copy)).toEqual([
      '10 minute Focus session',
      '2 minute Deep Focus session',
      '30 second Visualize session',
    ]);
    expect(practice[0].title).toBe('Practice completed');
    expect(practice[0].practiceMode).toBe('focus');
  });

  it('titles a Move "Move completed" and keeps the user words as its note', () => {
    const at = new Date(2026, 9, 5, 0, 53);
    const [plain] = deriveThreadEvents(anchor, [moveLog('m1', at)], []).filter((e) => e.type === 'ONE_MOVE_COMPLETED');
    expect(plain.title).toBe('Move completed');
    expect(plain.note).toBe('Set up analytics');
    expect(plain.waypointId).toBe('w1');

    const [written] = deriveThreadEvents(
      anchor,
      [moveLog('m2', at, { reflection: { id: 'r', promptType: 'x', body: 'Worked on the landing page', structuredContent: null, moodAfter: null } })],
      [],
    ).filter((e) => e.type === 'ONE_MOVE_COMPLETED');
    expect(written.note).toBe('Worked on the landing page');
  });

  it('counts Moves per range in Rhythm and keeps them out of unrelated windows', () => {
    const rhythm = buildRhythm([], ['a1'], now, ['2026-10-05', '2026-10-02', '2026-05-01', '2025-01-01']);
    expect(rhythm.Week.moves).toBe(1);
    expect(rhythm.Year.moves).toBe(3);
  });

  it('builds the week from this Anchor only', () => {
    const cells = buildHeatmap([session('s1', 'focus', 60, new Date(2026, 9, 5, 8))], ['a1'], 'Week', now);
    expect(buildAnchorWeek(cells, now).days).toEqual([true, false, false, false, false, false, false]);
    const other = buildHeatmap([{ ...session('s9', 'focus', 60, new Date(2026, 9, 5, 8)), anchorId: 'other' }], ['a1'], 'Week', now);
    expect(buildAnchorWeek(other, now).days.every((d) => !d)).toBe(true);
  });

  it('carries the insight on the model, and none while unmeasured', () => {
    const model = toV2ProgressModel(anchor, [moveLog('m1', new Date(2026, 9, 5, 9))], [session('s1', 'focus', 60, new Date(2026, 9, 5, 8))], { now });
    expect(model?.insight?.headline).toBeTruthy();
    const fresh = toV2ProgressModel({ ...anchor, threadStrength: undefined }, [], [], { now });
    expect(fresh?.insight).toBeNull();
  });
});

describe('buildRouteSummary metric', () => {
  it('returns null without a live course', () => {
    expect(buildRouteSummary(null)).toBeNull();
  });
});
