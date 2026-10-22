import { toHomeProgressState } from '../progressAdapter';
import { evidenceDayLabel } from '@/constants/v2/home';
import { makeAnchor } from './fixtures';
import type { CourseLogEntry } from '@/types/chart';
import type { SessionLogEntry } from '@/stores/sessionStore';

const now = new Date('2026-09-17T09:00:00');

const session = (overrides: Partial<SessionLogEntry> = {}): SessionLogEntry =>
  ({
    id: 'session-1',
    anchorId: 'anchor-1',
    mode: 'focus',
    durationSeconds: 30,
    completedAt: '2026-09-16T09:00:00.000Z',
    ...overrides,
  }) as SessionLogEntry;

const waypointLog = (overrides: Partial<CourseLogEntry> = {}): CourseLogEntry =>
  ({
    id: 'log-1',
    eventType: 'WAYPOINT_REACHED',
    message: 'Two prospects selected',
    waypointId: 'wp-1',
    occurredAt: '2026-09-15T09:00:00.000Z',
    recordedAt: '2026-09-15T09:00:00.000Z',
    snapshot: { waypointTitle: 'Two prospects selected' },
    reflection: null,
    ...overrides,
  }) as CourseLogEntry;

describe('Home Progress preview', () => {
  it('is absent without an Anchor', () => {
    expect(toHomeProgressState({ anchor: null, courseLogs: [], sessions: [], ownsActiveChart: false })).toEqual({ state: 'none' });
  });

  it('builds evidence only from persisted facts', () => {
    const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1', threadStrength: 10 });
    const state = toHomeProgressState({ anchor, courseLogs: [], sessions: [session()], ownsActiveChart: false, now });
    expect(state.state).toBe('ready');
    if (state.state !== 'ready') return;
    // The Anchor's own creation is a real lifecycle fact and is the only
    // entry with no sessions/logs behind it.
    expect(state.evidence.some((item) => item.title === 'Anchor created')).toBe(true);
    expect(state.evidence.some((item) => /portfolio direction/i.test(item.title))).toBe(false);
    expect(state.totalSessions).toBe(1);
  });

  it('never attributes another Anchor Chart’s waypoints to this Anchor', () => {
    const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1' });
    const withoutChart = toHomeProgressState({ anchor, courseLogs: [waypointLog()], sessions: [], ownsActiveChart: false, now });
    const withChart = toHomeProgressState({ anchor, courseLogs: [waypointLog()], sessions: [], ownsActiveChart: true, now });
    if (withoutChart.state !== 'ready' || withChart.state !== 'ready') throw new Error('expected ready');
    expect(withoutChart.evidence.some((item) => item.title === 'Two prospects selected')).toBe(false);
    expect(withChart.evidence.some((item) => item.title === 'Two prospects selected')).toBe(true);
  });

  it('counts only this Anchor’s practice sessions', () => {
    const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1' });
    const state = toHomeProgressState({
      anchor,
      courseLogs: [],
      sessions: [session(), session({ id: 'session-2', anchorId: 'anchor-2' })],
      ownsActiveChart: false,
      now,
    });
    if (state.state !== 'ready') throw new Error('expected ready');
    expect(state.totalSessions).toBe(1);
  });

  it('caps the preview so Home stays a preview', () => {
    const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1', threadStrength: 95 });
    const sessions = Array.from({ length: 60 }, (_, index) =>
      session({ id: 'session-' + index, completedAt: '2026-09-0' + ((index % 9) + 1) + 'T09:00:00.000Z' }),
    );
    const state = toHomeProgressState({ anchor, courseLogs: [], sessions, ownsActiveChart: false, now });
    if (state.state !== 'ready') throw new Error('expected ready');
    expect(state.evidence.length).toBeLessThanOrEqual(3);
  });
});

describe('evidenceDayLabel', () => {
  it('formats from the real timestamp in local time, never a fixed weekday', () => {
    expect(evidenceDayLabel(new Date('2026-09-17T08:00:00'), now)).toBe('Today');
    expect(evidenceDayLabel(new Date('2026-09-16T08:00:00'), now)).toBe('Yesterday');
    // Three days earlier is a real local weekday, not a hardcoded one.
    expect(evidenceDayLabel(new Date('2026-09-14T08:00:00'), now)).toBe(
      new Date('2026-09-14T08:00:00').toLocaleDateString(undefined, { weekday: 'long' }),
    );
    // Beyond a week it falls back to a short date rather than an ambiguous weekday.
    expect(evidenceDayLabel(new Date('2026-09-01T08:00:00'), now)).toBe(
      new Date('2026-09-01T08:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
  });

  it('is empty for an unparseable timestamp instead of inventing a day', () => {
    expect(evidenceDayLabel('not-a-date', now)).toBe('');
  });
});

describe('categoryLabel', () => {
  it('never renders a raw category enum on screen', () => {
    const { categoryLabel } = require('@/components/v2/anchors/anchorPresentation');
    expect(categoryLabel('personal_growth')).toBe('Personal growth');
    expect(categoryLabel('PERSONAL_GROWTH')).toBe('Personal growth');
    expect(categoryLabel('career')).toBe('Career');
    expect(categoryLabel('deep-work')).toBe('Deep work');
    expect(categoryLabel(null)).toBe('Custom');
    expect(categoryLabel('  ')).toBe('Custom');
    expect(categoryLabel('___')).toBe('Custom');
  });
});
