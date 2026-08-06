/**
 * Chart Practice integration contract.
 *
 * Chart does not get its own practice pipeline: it goes through the same
 * `startPractice()` boundary, produces the same canonical PracticeSession, and
 * obeys the same entitlement gate. These tests pin that down so Phase 1 cannot
 * accidentally grow a second path.
 */

import { startPractice } from '../practiceEntry';
import {
  resolvePracticeCompletionSource,
  resolvePracticeReturnTarget,
} from '../practiceReturn';
import {
  CHART_PRACTICE_ENTRY_SOURCES,
  PRACTICE_ENTRY_SOURCES,
  isChartPracticeContext,
  isChartPracticeEntrySource,
  type ChartPracticeContext,
  type PracticeEntrySource,
} from '@/types/practice';
import {
  FIXTURE_COURSE_ID,
  FIXTURE_COURSE_VERSION,
  WAYPOINT_IDS,
} from '@/screens/chart/__fixtures__/phase0';

const anchor = {
  id: 'anchor-current',
  userId: 'user-1',
  intentionText: 'Anchor has ten thousand users',
  category: 'career',
  distilledLetters: [],
  baseSigilSvg: '<svg />',
  structureVariant: 'balanced',
  isCharged: true,
  activationCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const chartContext: ChartPracticeContext = {
  courseId: FIXTURE_COURSE_ID,
  waypointId: WAYPOINT_IDS.current,
  courseVersion: FIXTURE_COURSE_VERSION,
};

const allowed = {
  kind: 'focus' as const,
  limit: Infinity,
  remaining: Infinity,
  hasUnlimitedAccess: true,
  isAllowed: true,
  focusUsed: 0,
  deepUsed: 0,
  totalUsed: 0,
  weekKey: 'test-week',
};

const access = {
  limitsActive: false,
  tier: 'pro' as const,
  focus: allowed,
  deep: { ...allowed, kind: 'deep' as const },
};

function buildDependencies(overrides: Record<string, unknown> = {}) {
  return {
    getAnchorById: (id: string) => (id === anchor.id ? anchor : undefined),
    primeSessionAccess: access,
    visualizeAvailable: true,
    defaultFocusDurationSeconds: 30,
    defaultAudioConfiguration: {
      focus: {
        guidanceVoice: 'female' as const,
        backgroundAudio: 'ambient' as const,
        source: 'default' as const,
      },
      deepPrime: {
        guidanceVoice: 'female' as const,
        backgroundAudio: 'ambient' as const,
        source: 'default' as const,
      },
    },
    navigateToPractice: jest.fn(),
    navigateToPaywall: jest.fn(),
    onEntitlementDenied: jest.fn(),
    ...overrides,
  };
}

const lockedAccess = (kind: 'focus' | 'deep') => ({
  ...access,
  [kind]: {
    ...access[kind],
    isAllowed: false,
    remaining: 0,
    limit: 5,
    hasUnlimitedAccess: false,
  },
});

describe('PracticeEntrySource — Chart sources', () => {
  it('exposes chart and chart_waypoint_detail', () => {
    expect(PRACTICE_ENTRY_SOURCES).toContain('chart');
    expect(PRACTICE_ENTRY_SOURCES).toContain('chart_waypoint_detail');
  });

  it('mirrors the backend PracticeEntrySource list exactly', () => {
    // backend/src/types/chart.ts PRACTICE_ENTRY_SOURCES. A drift here means the
    // server rejects the client's practiceEntrySource with a 400.
    expect([...PRACTICE_ENTRY_SOURCES]).toEqual([
      'practice_hero',
      'practice_deep_prime_card',
      'practice_focus_card',
      'practice_visualize_card',
      'practice_release_card',
      'anchor_detail',
      'sanctuary_prime_anchor',
      'widget',
      'shortcut',
      'evolve',
      'chart',
      'chart_waypoint_detail',
    ]);
  });

  it('classifies only Chart sources as Chart entries', () => {
    for (const source of CHART_PRACTICE_ENTRY_SOURCES) {
      expect(isChartPracticeEntrySource(source)).toBe(true);
    }
    for (const source of ['practice_hero', 'anchor_detail', 'widget'] as PracticeEntrySource[]) {
      expect(isChartPracticeEntrySource(source)).toBe(false);
    }
  });
});

describe('ChartPracticeContext validation', () => {
  it('requires a course id, waypoint id, and a positive integer version', () => {
    expect(isChartPracticeContext(chartContext)).toBe(true);
    expect(isChartPracticeContext({ ...chartContext, courseId: '' })).toBe(false);
    expect(isChartPracticeContext({ ...chartContext, waypointId: '' })).toBe(false);
    expect(isChartPracticeContext({ ...chartContext, courseVersion: 0 })).toBe(false);
    expect(isChartPracticeContext({ ...chartContext, courseVersion: 1.5 })).toBe(false);
    expect(isChartPracticeContext(null)).toBe(false);
    expect(isChartPracticeContext(undefined)).toBe(false);
  });
});

describe('startPractice — Chart context survives route construction', () => {
  it('carries course, waypoint, and version into the focus route', () => {
    const dependencies = buildDependencies();

    expect(
      startPractice(
        {
          mode: 'focus',
          anchorId: anchor.id,
          source: 'chart_waypoint_detail',
          chartContext,
        },
        dependencies,
      ),
    ).toBe(true);

    expect(dependencies.navigateToPractice).toHaveBeenCalledWith({
      route: 'ActivationRitual',
      params: expect.objectContaining({
        anchorId: anchor.id,
        source: 'chart_waypoint_detail',
        returnTo: 'chart',
        chartContext,
      }),
    });
  });

  it('carries context into the deep prime setup and direct ritual routes', () => {
    const setup = buildDependencies();
    startPractice(
      { mode: 'deepPrime', anchorId: anchor.id, source: 'chart', chartContext },
      setup,
    );
    expect(setup.navigateToPractice).toHaveBeenCalledWith({
      route: 'ChargeSetup',
      params: expect.objectContaining({ returnTo: 'chart', chartContext }),
    });

    const direct = buildDependencies();
    startPractice(
      {
        mode: 'deepPrime',
        anchorId: anchor.id,
        source: 'chart',
        chartContext,
        durationSeconds: 300,
      },
      direct,
    );
    expect(direct.navigateToPractice).toHaveBeenCalledWith({
      route: 'Ritual',
      params: expect.objectContaining({ returnTo: 'chart', chartContext }),
    });
  });

  it('carries context into the visualize route', () => {
    const dependencies = buildDependencies();
    startPractice(
      { mode: 'visualize', anchorId: anchor.id, source: 'chart', chartContext },
      dependencies,
    );
    expect(dependencies.navigateToPractice).toHaveBeenCalledWith({
      route: 'VisualizePreparation',
      params: expect.objectContaining({ chartContext, source: 'chart' }),
    });
  });

  it('uses exactly one navigation call — no parallel Chart practice route', () => {
    const dependencies = buildDependencies();
    startPractice(
      {
        mode: 'focus',
        anchorId: anchor.id,
        source: 'chart_waypoint_detail',
        chartContext,
      },
      dependencies,
    );
    expect(dependencies.navigateToPractice).toHaveBeenCalledTimes(1);
    const [target] = (dependencies.navigateToPractice as jest.Mock).mock.calls[0];
    // The Chart stack must never receive a practice route.
    expect(['ChargeSetup', 'Ritual', 'ActivationRitual', 'VisualizePreparation']).toContain(
      target.route,
    );
  });
});

describe('startPractice — Chart context and source are inseparable', () => {
  it('rejects a Chart source without context', () => {
    const dependencies = buildDependencies();
    expect(
      startPractice(
        { mode: 'focus', anchorId: anchor.id, source: 'chart_waypoint_detail' },
        dependencies,
      ),
    ).toBe(false);
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
  });

  it('rejects Chart context supplied from a non-Chart source', () => {
    const dependencies = buildDependencies();
    expect(
      startPractice(
        { mode: 'focus', anchorId: anchor.id, source: 'practice_hero', chartContext },
        dependencies,
      ),
    ).toBe(false);
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
  });

  it('rejects malformed Chart context', () => {
    const dependencies = buildDependencies();
    expect(
      startPractice(
        {
          mode: 'focus',
          anchorId: anchor.id,
          source: 'chart',
          chartContext: { ...chartContext, courseVersion: 0 },
        },
        dependencies,
      ),
    ).toBe(false);
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
  });

  it('refuses to launch Release from Chart — Chart does not own Anchor lifecycle', () => {
    const dependencies = buildDependencies();
    expect(
      startPractice(
        { mode: 'release', anchorId: anchor.id, source: 'chart', chartContext },
        dependencies,
      ),
    ).toBe(false);
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
  });

  it('leaves non-Chart entries byte-identical to before', () => {
    const dependencies = buildDependencies();
    startPractice({ mode: 'deepPrime', anchorId: anchor.id, source: 'practice_hero' }, dependencies);
    expect(dependencies.navigateToPractice).toHaveBeenCalledWith({
      route: 'ChargeSetup',
      params: {
        anchorId: anchor.id,
        returnTo: 'practice',
        initialDuration: 'deep',
        source: 'practice_hero',
      },
    });
  });
});

describe('startPractice — entitlement denial preserves the Chart return target', () => {
  it.each(['focus', 'deep'] as const)(
    'sends a locked %s session to the paywall with a chart_waypoint resume target',
    kind => {
      const dependencies = buildDependencies({ primeSessionAccess: lockedAccess(kind) });
      const mode = kind === 'focus' ? 'focus' : 'deepPrime';

      expect(
        startPractice(
          { mode, anchorId: anchor.id, source: 'chart_waypoint_detail', chartContext },
          dependencies,
        ),
      ).toBe(false);

      expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
      expect(dependencies.navigateToPaywall).toHaveBeenCalledWith({
        source: 'free_weekly_sessions_used',
        preferredPlanId: 'annual',
        resumeTarget: {
          kind: 'chart_waypoint',
          courseId: FIXTURE_COURSE_ID,
          waypointId: WAYPOINT_IDS.current,
        },
      });
    },
  );

  it('overrides the visualize resume target with the Chart waypoint', () => {
    const dependencies = buildDependencies({ visualizeAvailable: false });
    expect(
      startPractice(
        { mode: 'visualize', anchorId: anchor.id, source: 'chart', chartContext },
        dependencies,
      ),
    ).toBe(false);
    expect(dependencies.navigateToPaywall).toHaveBeenCalledWith({
      source: 'premium_practice_locked',
      preferredPlanId: 'annual',
      resumeTarget: {
        kind: 'chart_waypoint',
        courseId: FIXTURE_COURSE_ID,
        waypointId: WAYPOINT_IDS.current,
      },
    });
  });

  it('still uses visualize_prepare for non-Chart visualize denials', () => {
    const dependencies = buildDependencies({ visualizeAvailable: false });
    startPractice(
      { mode: 'visualize', anchorId: anchor.id, source: 'anchor_detail' },
      dependencies,
    );
    expect(dependencies.navigateToPaywall).toHaveBeenCalledWith({
      source: 'premium_practice_locked',
      preferredPlanId: 'annual',
      resumeTarget: { kind: 'visualize_prepare', anchorId: anchor.id },
    });
  });

  it('creates no session route before entitlement succeeds', () => {
    const dependencies = buildDependencies({ primeSessionAccess: lockedAccess('deep') });
    startPractice(
      { mode: 'deepPrime', anchorId: anchor.id, source: 'chart', chartContext },
      dependencies,
    );
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
    expect(dependencies.onEntitlementDenied).toHaveBeenCalledTimes(1);
  });
});

describe('resolvePracticeReturnTarget', () => {
  it('returns a Chart-launched session to its waypoint', () => {
    expect(
      resolvePracticeReturnTarget({ returnTo: 'chart', anchorId: anchor.id, chartContext }),
    ).toEqual({
      kind: 'chart_waypoint',
      courseId: FIXTURE_COURSE_ID,
      waypointId: WAYPOINT_IDS.current,
    });
  });

  it('falls back to Chart home when context is missing', () => {
    expect(resolvePracticeReturnTarget({ returnTo: 'chart' })).toEqual({
      kind: 'chart_home',
    });
  });

  it('falls back to Practice when Chart was disabled mid-session', () => {
    expect(
      resolvePracticeReturnTarget({ returnTo: 'chart', chartContext, chartEnabled: false }),
    ).toEqual({ kind: 'practice_home' });
  });

  it('leaves every pre-existing returnTo value unchanged', () => {
    expect(resolvePracticeReturnTarget({ returnTo: 'practice' })).toEqual({
      kind: 'practice_home',
    });
    expect(resolvePracticeReturnTarget({ returnTo: 'detail', anchorId: 'a1' })).toEqual({
      kind: 'anchor_detail',
      anchorId: 'a1',
    });
    expect(resolvePracticeReturnTarget({ returnTo: 'vault' })).toEqual({ kind: 'vault' });
    expect(resolvePracticeReturnTarget({})).toEqual({ kind: 'back' });
  });

  it('never routes a practice return into the Chart stack without a Chart returnTo', () => {
    for (const returnTo of ['practice', 'detail', 'vault', 'reinforce'] as const) {
      const target = resolvePracticeReturnTarget({
        returnTo,
        anchorId: anchor.id,
        // Even if stale context leaks in, a non-Chart returnTo ignores it.
        chartContext,
      });
      expect(target.kind).not.toBe('chart_waypoint');
      expect(target.kind).not.toBe('chart_home');
    }
  });

  it('does not carry courseVersion into the return target', () => {
    const target = resolvePracticeReturnTarget({ returnTo: 'chart', chartContext });
    expect(JSON.stringify(target)).not.toContain('courseVersion');
  });
});

describe('resolvePracticeCompletionSource', () => {
  it('treats Chart as a practice-screen completion, not a new pipeline', () => {
    expect(resolvePracticeCompletionSource('chart')).toBe('practice_screen');
    expect(resolvePracticeCompletionSource('practice')).toBe('practice_screen');
  });

  it('preserves the existing anchor_detail mapping', () => {
    expect(resolvePracticeCompletionSource('detail')).toBe('anchor_detail');
    expect(resolvePracticeCompletionSource('vault')).toBe('anchor_detail');
    expect(resolvePracticeCompletionSource(undefined)).toBe('anchor_detail');
  });
});
