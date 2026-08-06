/**
 * Chart context must survive the whole completion path: the in-memory record,
 * the encrypted offline queue, the retry, and the server payload. If it dies at
 * any hop the Course Log silently loses the PRACTICE_COMPLETED join.
 */

import { PracticeCompletionService } from '../PracticeCompletionService';
import { apiClient } from '../ApiClient';
import { AnalyticsService } from '../AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { ChartPracticeContext } from '@/types/practice';
import {
  FIXTURE_COURSE_ID,
  FIXTURE_COURSE_VERSION,
  WAYPOINT_IDS,
} from '@/screens/chart/__fixtures__/phase0';

const chartContext: ChartPracticeContext = {
  courseId: FIXTURE_COURSE_ID,
  waypointId: WAYPOINT_IDS.current,
  courseVersion: FIXTURE_COURSE_VERSION,
};

const chartInput = (
  accountId: string,
  sessionId: string,
  overrides: Record<string, unknown> = {},
) => ({
  sessionId,
  accountId,
  anchorId: 'anchor-current',
  anchorLocalId: 'anchor-current',
  anchorServerId: 'anchor-current',
  mode: 'focus' as const,
  plannedDurationSeconds: 60,
  actualDurationSeconds: 60,
  startedAt: '2026-08-04T14:59:00.000Z',
  completedAt: '2026-08-04T15:00:00.000Z',
  source: 'practice_screen' as const,
  guidanceVoice: 'none' as const,
  backgroundAudio: 'off' as const,
  chartContext,
  practiceEntrySource: 'chart_waypoint_detail' as const,
  ...overrides,
});

describe('PracticeCompletionService — Chart context', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().reset();
    jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);
  });

  it('writes Chart columns onto the canonical record', async () => {
    useAuthStore.setState({ user: { id: 'acct-chart-1' } as any });
    const { record } = await PracticeCompletionService.completePracticeSession(
      chartInput('acct-chart-1', 'chart-session-1'),
      { flushImmediately: false },
    );

    expect(record.courseId).toBe(FIXTURE_COURSE_ID);
    expect(record.waypointId).toBe(WAYPOINT_IDS.current);
    expect(record.practiceEntrySource).toBe('chart_waypoint_detail');
    // Still exactly one canonical session — no parallel Chart record.
    expect(useSessionStore.getState().practiceHistory).toHaveLength(1);
    expect(useSessionStore.getState().practiceHistory[0].id).toBe('chart-session-1');
  });

  it('never persists courseVersion on the immutable session', async () => {
    useAuthStore.setState({ user: { id: 'acct-chart-version' } as any });
    const { record } = await PracticeCompletionService.completePracticeSession(
      chartInput('acct-chart-version', 'chart-session-version'),
      { flushImmediately: false },
    );
    // Course.version is authoritative and moves; a copy stored on history would
    // only ever be stale.
    expect(JSON.stringify(record)).not.toContain('courseVersion');
  });

  it('sends Chart context to the server on flush', async () => {
    useAuthStore.setState({ user: { id: 'acct-chart-2' } as any });
    await PracticeCompletionService.completePracticeSession(
      chartInput('acct-chart-2', 'chart-session-2'),
      { flushImmediately: false },
    );
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { success: true } } as any);

    await PracticeCompletionService.flush('acct-chart-2');

    expect(post).toHaveBeenCalledWith(
      '/api/practice/sessions',
      expect.objectContaining({
        id: 'chart-session-2',
        courseId: FIXTURE_COURSE_ID,
        waypointId: WAYPOINT_IDS.current,
        practiceEntrySource: 'chart_waypoint_detail',
      }),
    );
    // accountId and syncState are client-only and must not be sent.
    const [, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty('accountId');
    expect(body).not.toHaveProperty('syncState');
  });

  it('replays identical Chart context after an offline failure', async () => {
    useAuthStore.setState({ user: { id: 'acct-chart-3' } as any });
    await PracticeCompletionService.completePracticeSession(
      chartInput('acct-chart-3', 'chart-session-3'),
      { flushImmediately: false },
    );

    const post = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(new Error('offline'));
    await PracticeCompletionService.flush('acct-chart-3');
    expect(useSessionStore.getState().practiceHistory[0].syncState).not.toBe('synced');

    post.mockResolvedValueOnce({ data: { success: true } } as any);
    await PracticeCompletionService.flush('acct-chart-3');

    const chartBodies = post.mock.calls
      .map(([, body]) => body as Record<string, unknown>)
      .filter(body => body.id === 'chart-session-3');
    expect(chartBodies).toHaveLength(2);
    // The retry is byte-identical on the Chart columns, so the server's
    // immutable-session check accepts it as idempotent rather than 409-ing.
    expect(chartBodies[0].courseId).toBe(chartBodies[1].courseId);
    expect(chartBodies[0].waypointId).toBe(chartBodies[1].waypointId);
    expect(chartBodies[0].practiceEntrySource).toBe(chartBodies[1].practiceEntrySource);
    expect(useSessionStore.getState().practiceHistory[0].syncState).toBe('synced');
  });

  it('prevents a duplicate Chart session for the same session id', async () => {
    useAuthStore.setState({ user: { id: 'acct-chart-4' } as any });
    const first = await PracticeCompletionService.completePracticeSession(
      chartInput('acct-chart-4', 'chart-session-4'),
      { flushImmediately: false },
    );
    const second = await PracticeCompletionService.completePracticeSession(
      chartInput('acct-chart-4', 'chart-session-4'),
      { flushImmediately: false },
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(useSessionStore.getState().practiceHistory).toHaveLength(1);
  });

  it('refuses a cross-account Chart write', async () => {
    useAuthStore.setState({ user: { id: 'acct-chart-5' } as any });
    await expect(
      PracticeCompletionService.completePracticeSession(
        chartInput('acct-someone-else', 'chart-session-5'),
      ),
    ).rejects.toThrow('active account');
    expect(useSessionStore.getState().practiceHistory).toEqual([]);
  });
});

describe('PracticeCompletionService — Chart attribution is fail-closed', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().reset();
    jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);
    useAuthStore.setState({ user: { id: 'acct-guard' } as any });
  });

  it('stores no course attribution when the entry source is not a Chart source', async () => {
    const { record } = await PracticeCompletionService.completePracticeSession(
      chartInput('acct-guard', 'guard-1', { practiceEntrySource: 'practice_hero' }),
      { flushImmediately: false },
    );
    expect(record.courseId).toBeNull();
    expect(record.waypointId).toBeNull();
    // The entry source itself is still recorded for auditing.
    expect(record.practiceEntrySource).toBe('practice_hero');
  });

  it('stores no course attribution when the context is malformed', async () => {
    const { record } = await PracticeCompletionService.completePracticeSession(
      chartInput('acct-guard', 'guard-2', {
        chartContext: { courseId: '', waypointId: '', courseVersion: 0 },
      }),
      { flushImmediately: false },
    );
    expect(record.courseId).toBeNull();
    expect(record.waypointId).toBeNull();
  });

  it('leaves ordinary sessions with null Chart columns', async () => {
    const { record } = await PracticeCompletionService.completePracticeSession(
      {
        sessionId: 'plain-1',
        accountId: 'acct-guard',
        anchorId: 'anchor-1',
        mode: 'focus',
        plannedDurationSeconds: 30,
        actualDurationSeconds: 30,
        startedAt: '2026-08-04T14:59:30.000Z',
        completedAt: '2026-08-04T15:00:00.000Z',
        source: 'practice_screen',
        guidanceVoice: 'none',
        backgroundAudio: 'off',
      },
      { flushImmediately: false },
    );
    expect(record.courseId).toBeNull();
    expect(record.waypointId).toBeNull();
    expect(record.practiceEntrySource).toBeNull();
  });
});

describe('PracticeCompletionService — Chart analytics privacy', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().reset();
    useAuthStore.setState({ user: { id: 'acct-analytics' } as any });
  });

  it('emits opaque Chart IDs and no user-authored text', async () => {
    const track = jest
      .spyOn(AnalyticsService, 'track')
      .mockImplementation(() => undefined);

    await PracticeCompletionService.completePracticeSession(
      chartInput('acct-analytics', 'analytics-1'),
      { flushImmediately: false },
    );

    const completed = track.mock.calls.find(
      ([name]) => name === 'practice_session_completed',
    );
    expect(completed).toBeDefined();
    const properties = completed?.[1] as Record<string, unknown>;
    expect(properties.course_id).toBe(FIXTURE_COURSE_ID);
    expect(properties.waypoint_id).toBe(WAYPOINT_IDS.current);
    expect(properties.practice_entry_source).toBe('chart_waypoint_detail');

    const serialized = JSON.stringify(properties);
    expect(serialized).not.toContain('Anchor has ten thousand users');
    expect(serialized).not.toContain('intention');
    expect(serialized).not.toContain('reflection');
    expect(serialized).not.toContain('destination');
  });

  it('omits Chart properties entirely for non-Chart sessions', async () => {
    const track = jest
      .spyOn(AnalyticsService, 'track')
      .mockImplementation(() => undefined);

    await PracticeCompletionService.completePracticeSession(
      chartInput('acct-analytics', 'analytics-2', {
        practiceEntrySource: 'practice_hero',
      }),
      { flushImmediately: false },
    );

    const completed = track.mock.calls.find(
      ([name]) => name === 'practice_session_completed',
    );
    const properties = completed?.[1] as Record<string, unknown>;
    expect(properties).not.toHaveProperty('course_id');
    expect(properties).not.toHaveProperty('waypoint_id');
  });
});
