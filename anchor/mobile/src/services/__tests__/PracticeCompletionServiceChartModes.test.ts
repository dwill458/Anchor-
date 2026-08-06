import { PracticeCompletionService } from '../PracticeCompletionService';
import { AnalyticsService } from '../AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';

const chartContext = {
  courseId: 'course-modes',
  waypointId: 'waypoint-modes',
  courseVersion: 3,
};

const anchor = {
  id: 'anchor-modes',
  localId: 'anchor-modes',
  intentionText: 'A private intention',
} as any;

describe('PracticeCompletionService — shared Chart mode adapters', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().reset();
    useAuthStore.setState({ user: { id: 'acct-modes' } as any });
    jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);
    jest.spyOn(PracticeCompletionService, 'flush').mockResolvedValue(undefined);
  });

  it.each([
    ['focus', 'focus'],
    ['deep_prime', 'deep_prime'],
  ] as const)('returns the canonical %s legacy-adapter record', async (practiceMode, expectedMode) => {
    const record = await PracticeCompletionService.queueLegacyCompletion({
      id: `session-${practiceMode}`,
      anchorId: anchor.id,
      anchorLocalId: anchor.localId,
      practiceMode,
      durationSeconds: 60,
      completedAt: '2026-08-05T12:01:00.000Z',
      guidanceVoice: 'none',
      backgroundAudio: 'off',
      source: 'practice_screen',
      chartContext,
      practiceEntrySource: 'chart_waypoint_detail',
    });

    expect(record).toEqual(expect.objectContaining({
      id: `session-${practiceMode}`,
      practiceMode: expectedMode,
      courseId: chartContext.courseId,
      waypointId: chartContext.waypointId,
      practiceEntrySource: 'chart_waypoint_detail',
    }));
  });

  it('keeps Visualize in the canonical session pipeline with Chart attribution', async () => {
    const record = await PracticeCompletionService.commitVisualizeCompletion({
      id: 'session-visualize',
      accountId: 'acct-modes',
      anchor,
      durationSeconds: 60,
      startedAt: '2026-08-05T12:00:00.000Z',
      completedAt: '2026-08-05T12:01:00.000Z',
      guidanceVoice: 'none',
      backgroundAudio: 'off',
      sceneSnapshot: 'private scene text',
      source: 'practice_screen',
      chartContext,
      practiceEntrySource: 'chart_waypoint_detail',
    });

    expect(record).toEqual(expect.objectContaining({
      id: 'session-visualize',
      practiceMode: 'visualize',
      courseId: chartContext.courseId,
      waypointId: chartContext.waypointId,
      practiceEntrySource: 'chart_waypoint_detail',
    }));
    expect(useSessionStore.getState().practiceHistory).toHaveLength(1);
  });
});
