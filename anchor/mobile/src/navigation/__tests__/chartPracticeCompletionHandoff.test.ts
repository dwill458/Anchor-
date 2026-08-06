import { startPractice } from '../practiceEntry';
import { resolvePracticeReturnTarget } from '../practiceReturn';
import type { ChartPracticeMode } from '@/types/practice';

const anchor = {
  id: 'anchor-chart',
  intentionText: 'Keep building Anchor',
  localId: 'anchor-chart',
} as any;

const chartContext = {
  courseId: 'course-1',
  waypointId: 'waypoint-1',
  courseVersion: 7,
};

const access = {
  limitsActive: false,
  tier: 'pro' as const,
  focus: { kind: 'focus' as const, isAllowed: true, remaining: Infinity },
  deep: { kind: 'deep' as const, isAllowed: true, remaining: Infinity },
} as any;

function dependencies() {
  return {
    getAnchorById: () => anchor,
    primeSessionAccess: access,
    visualizeAvailable: true,
    defaultFocusDurationSeconds: 30,
    defaultAudioConfiguration: {
      focus: { guidanceVoice: 'none' as const, backgroundAudio: 'off' as const, source: 'default' as const },
      deepPrime: { guidanceVoice: 'none' as const, backgroundAudio: 'off' as const, source: 'default' as const },
    },
    navigateToPractice: jest.fn(),
    navigateToPaywall: jest.fn(),
  };
}

describe('Chart practice completion handoff', () => {
  it.each([
    ['focus', 'ActivationRitual'],
    ['visualize', 'VisualizePreparation'],
    ['deepPrime', 'ChargeSetup'],
  ] as const)('threads %s through the shared %s route', (mode, route) => {
    const deps = dependencies();
    expect(startPractice({
      mode,
      anchorId: anchor.id,
      source: 'chart_waypoint_detail',
      chartContext,
    }, deps)).toBe(true);

    expect(deps.navigateToPractice).toHaveBeenCalledWith({
      route,
      params: expect.objectContaining({
        source: 'chart_waypoint_detail',
        returnTo: 'chart',
        chartContext,
        practiceMode: mode,
      }),
    });
  });

  it.each(['focus', 'visualize', 'deepPrime'] as ChartPracticeMode[])(
    'preserves the canonical session id when %s returns',
    practiceMode => {
      const practiceReturn = {
        outcome: 'completed' as const,
        practiceSessionId: `session-${practiceMode}`,
        practiceMode,
        anchorId: anchor.id,
      };

      expect(resolvePracticeReturnTarget({
        returnTo: 'chart',
        chartContext,
        practiceReturn,
      })).toEqual({
        kind: 'chart_waypoint',
        courseId: chartContext.courseId,
        waypointId: chartContext.waypointId,
        practiceReturn,
      });
    },
  );
});
