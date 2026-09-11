import { toMaturePracticeLaunch } from '../PracticeStackNavigator';
import type { PracticeLaunchRequest } from '../v2/PracticeLaunchHost';

const request = (mode: PracticeLaunchRequest['mode']): PracticeLaunchRequest => ({
  anchorId: 'anchor-canonical-1',
  mode,
  durationSeconds: mode === 'visualize' ? 180 : 300,
  source: mode === 'focus' ? 'practice_focus_card' : mode === 'deep_prime' ? 'practice_deep_prime_card' : 'practice_visualize_card',
  sessionId: `session-${mode}`,
  visionId: mode === 'visualize' ? 'vision-1' : undefined,
  assetId: mode === 'visualize' ? 'asset-1' : undefined,
  courseId: 'course-1',
  waypointId: 'waypoint-1',
  returnTarget: 'v2_practice',
});

describe('V2 Practice prepare bridge', () => {
  it.each([
    ['focus', 'ActivationRitual'],
    ['deep_prime', 'Ritual'],
    ['visualize', 'VisualizePreparation'],
  ] as const)('launches %s through the mature engine route', (mode, route) => {
    const launch = toMaturePracticeLaunch(request(mode));

    expect(launch.route).toBe(route);
    expect(launch.params).toEqual(expect.objectContaining({
      anchorId: 'anchor-canonical-1',
      sessionId: `session-${mode}`,
      courseId: 'course-1',
      waypointId: 'waypoint-1',
      entrySource: request(mode).source,
      returnTarget: 'v2_practice',
    }));
    if (mode === 'focus') expect(launch.params).toHaveProperty('durationOverride', 300);
    if (mode === 'deep_prime') expect(launch.params).toHaveProperty('durationSeconds', 300);
  });

  it('keeps Vision context on the Visualize handoff', () => {
    const launch = toMaturePracticeLaunch(request('visualize'));
    expect(launch.params).toEqual(expect.objectContaining({
      visionId: 'vision-1',
      assetId: 'asset-1',
      durationSeconds: 180,
    }));
  });
});
