/**
 * Real, unmocked Chart integration test (Anchor 2.0).
 *
 * Exercises ChartService, CourseService, ChartPlannerService and
 * AnchorReleaseService against a real Postgres with the full migration history
 * applied, so partial unique indexes, serializable transactions and
 * idempotency keys are proven by the database — not by mocks.
 *
 * SAFETY: opt-in only. `npm test` skips it (jestEnvironment.ts pins
 * DATABASE_URL to an unreachable value). Never point it at the database in
 * this repo's .env.
 *
 * To run:
 *   1. Create a disposable Postgres and `npx prisma migrate deploy` against it.
 *   2. CHART_INTEGRATION_DATABASE_URL=postgresql://... npx jest chart.integration
 *
 * Every row belongs to one per-run user, deleted (cascade) in afterAll.
 */
import type { ChartModelProvider, ChartModelRequest } from '../chartModelProviders';

const REAL_DB_URL = process.env.CHART_INTEGRATION_DATABASE_URL;
const RUN_ID = `chart-it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const maybeDescribe = REAL_DB_URL ? describe : describe.skip;

if (!REAL_DB_URL) {
  // eslint-disable-next-line no-console
  console.warn('[chart.integration.test] Skipped: set CHART_INTEGRATION_DATABASE_URL to a disposable, migrated Postgres.');
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
maybeDescribe('Chart 2.0 (real Postgres, opt-in)', () => {
  let prisma: any;
  let chartService: any;
  let courseService: any;
  let releaseService: any;
  let ChartPlannerService: any;
  let ChartProviderError: any;
  let userId: string;
  let anchorId: string;
  let otherAnchorId: string;
  let seq = 0;
  const key = (label: string) => `${RUN_ID}-${label}-${++seq}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.ENABLE_CHART = 'true';
    process.env.ENABLE_CHART_WRITE = 'true';
    process.env.ENABLE_CHART_AI_PLANNER = 'true';
    prisma = require('../../../lib/prisma').prisma;
    chartService = require('../ChartService').chartService;
    courseService = require('../../CourseService').courseService;
    releaseService = new (require('../../v2/AnchorReleaseService').AnchorReleaseService)();
    ChartPlannerService = require('../ChartPlannerService').ChartPlannerService;
    ChartProviderError = require('../chartModelProviders').ChartProviderError;

    const user = await prisma.user.create({
      data: { email: `${RUN_ID}@test.anchor.invalid`, authProvider: 'email', authUid: `uid-${RUN_ID}` },
    });
    userId = user.id;
    anchorId = (
      await prisma.anchor.create({
        data: { userId, intentionText: 'Anchor has 10,000 active users', category: 'career' },
      })
    ).id;
    otherAnchorId = (
      await prisma.anchor.create({ data: { userId, intentionText: 'I run a half marathon', category: 'health' } })
    ).id;
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const baseRoute = [
    { title: 'Validate repeatable acquisition', rationale: 'Growth has a source.' },
    { title: 'Reach 1,000 active users', kind: 'METRIC', metricLabel: 'active users', metricTarget: 1000, metricBaseline: 100 },
    { title: 'Reach 10,000 active users', kind: 'METRIC', metricLabel: 'active users', metricTarget: 10000 },
  ];

  async function events(courseId: string, eventType: string) {
    return prisma.courseEvent.findMany({ where: { courseId, eventType } });
  }
  async function ledger(eventType: string, courseId: string) {
    return prisma.threadEventLedger.findMany({ where: { userId, eventType, correlationId: `course:${courseId}` } });
  }

  let chart: any;

  it('persists a reviewed route as the Anchor’s ACTIVE Chart with one current Move', async () => {
    const vision = await prisma.vision.create({
      data: { userId, anchorId, title: 'The dashboard', description: 'My dashboard shows 10,000 users.' },
    });
    const idempotencyKey = key('create');
    chart = await chartService.createChart(userId, {
      anchorId,
      idempotencyKey,
      destinationText: 'Reach 10,000 active users',
      startingContext: 'App launched, 100 users.',
      complexity: 'SIMPLE',
      waypoints: baseRoute,
      oneMove: { title: 'Finish onboarding redesign', rationale: null },
    });
    expect(chart.status).toBe('ACTIVE');
    expect(chart.anchorId).toBe(anchorId);
    expect(chart.visionId).toBe(vision.id);
    expect(chart.startingContext).toBe('App launched, 100 users.');
    expect(chart.waypoints.map((w: any) => w.title)).toEqual(baseRoute.map(w => w.title));
    expect(chart.currentWaypointId).toBe(chart.waypoints[0].id);
    expect(chart.waypoints[1].metric).toEqual({ label: 'active users', baseline: 100, target: 1000, current: null });
    expect(chart.moves).toHaveLength(1);
    expect(chart.moves[0]).toMatchObject({ title: 'Finish onboarding redesign', status: 'ACTIVE', isCurrent: true });
    expect(chart.destinationAnchorLink.anchorId).toBe(anchorId);
    expect(await events(chart.id, 'COURSE_CREATED')).toHaveLength(1);
    expect(await events(chart.id, 'WAYPOINT_ADDED')).toHaveLength(3);

    // Replay returns the same Chart and writes nothing new.
    const replay = await chartService.createChart(userId, {
      anchorId,
      idempotencyKey,
      destinationText: 'Reach 10,000 active users',
      waypoints: baseRoute,
    });
    expect(replay.id).toBe(chart.id);
    expect(await events(chart.id, 'COURSE_CREATED')).toHaveLength(1);
  });

  it('allows one ACTIVE Chart per Anchor (not per user)', async () => {
    await expect(
      chartService.createChart(userId, {
        anchorId,
        idempotencyKey: key('dup'),
        destinationText: 'Another route',
        waypoints: baseRoute,
      })
    ).rejects.toMatchObject({ code: 'ACTIVE_COURSE_EXISTS' });

    const second = await chartService.createChart(userId, {
      anchorId: otherAnchorId,
      idempotencyKey: key('other'),
      destinationText: 'Finish a half marathon',
      waypoints: [{ title: 'Run 10 km comfortably' }, { title: 'Finish a half marathon' }],
    });
    expect(second.status).toBe('ACTIVE');
    expect(second.visionId).toBeNull();

    // The database itself enforces the per-Anchor rule.
    await expect(
      prisma.course.create({
        data: { userId, anchorId, destinationText: 'raw insert', status: 'ACTIVE', schemaVersion: 1 },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('keeps AI suggestions out of commitments until the user accepts one', async () => {
    const [first] = chart.waypoints;
    const updated = await chartService.replaceSuggestedMoves(userId, chart.id, first.id, [
      { title: 'Improve onboarding flow', rationale: null },
      { title: 'Launch creator campaign', rationale: null },
    ]);
    const suggested = updated.moves.filter((m: any) => m.status === 'SUGGESTED');
    expect(suggested).toHaveLength(2);
    expect(updated.currentMoveId).toBe(chart.moves[0].id);

    const accepted = await chartService.updateMove(userId, chart.id, suggested[0].id, { accept: true });
    expect(accepted.moves.find((m: any) => m.id === suggested[0].id).status).toBe('ACTIVE');
    // An existing One Move is not displaced by accepting another.
    expect(accepted.currentMoveId).toBe(chart.moves[0].id);
    chart = accepted;
  });

  it('completes a Move once — concurrent double taps create one event and one Progress fact', async () => {
    const moveId = chart.currentMoveId;
    const results = await Promise.allSettled([
      chartService.completeMove(userId, chart.id, moveId),
      chartService.completeMove(userId, chart.id, moveId),
      chartService.completeMove(userId, chart.id, moveId),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(await events(chart.id, 'MOVE_COMPLETED')).toHaveLength(1);
    const facts = await ledger('ONE_MOVE_COMPLETED', chart.id);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ anchorId, significance: 'LOW', sourceKind: 'COURSE_EVENT' });

    const again = await chartService.completeMove(userId, chart.id, moveId);
    expect(again.replayed).toBe(true);
    chart = again.chart;
    // The accepted suggestion becomes the One Move; the waypoint is NOT completed.
    expect(chart.moves.find((m: any) => m.isCurrent).title).toBe('Improve onboarding flow');
    expect(chart.waypoints[0].state).toBe('CURRENT');
    expect(chart.waypoints[0].reachedAt).toBeNull();
  });

  it('records measurable progress without completing the waypoint', async () => {
    await expect(
      chartService.updateWaypointProgress(userId, chart.id, chart.waypoints[0].id, {
        expectedCourseVersion: chart.version,
        metricCurrent: 5,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('reaches a waypoint exactly once under concurrent double taps and advances the One Move', async () => {
    const second = chart.waypoints[1];
    await chartService.addMove(userId, chart.id, {
      waypointId: second.id,
      title: 'Ship referral loop',
      idempotencyKey: key('move-2'),
    });
    const fresh = await courseService.getCourse(userId, chart.id);
    const completeKey = key('reach');
    const results = await Promise.allSettled([
      courseService.completeWaypoint(userId, chart.id, fresh.waypoints[0].id, {
        idempotencyKey: completeKey,
        expectedCourseVersion: fresh.version,
      }),
      courseService.completeWaypoint(userId, chart.id, fresh.waypoints[0].id, {
        idempotencyKey: completeKey,
        expectedCourseVersion: fresh.version,
      }),
      courseService.completeWaypoint(userId, chart.id, fresh.waypoints[0].id, {
        idempotencyKey: key('reach-other'),
        expectedCourseVersion: fresh.version,
      }),
    ]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(await events(chart.id, 'WAYPOINT_REACHED')).toHaveLength(1);
    expect(await ledger('WAYPOINT_REACHED', chart.id)).toHaveLength(1);

    chart = await courseService.getCourse(userId, chart.id);
    expect(chart.waypoints[0].state).toBe('REACHED');
    expect(chart.currentWaypointId).toBe(second.id);
    const current = chart.moves.find((m: any) => m.isCurrent);
    expect(current).toMatchObject({ title: 'Ship referral loop', waypointId: second.id });
  });

  it('updates metric progress on the current waypoint', async () => {
    chart = await chartService.updateWaypointProgress(userId, chart.id, chart.currentWaypointId, {
      expectedCourseVersion: chart.version,
      metricCurrent: 642,
    });
    expect(chart.waypoints[1].metric.current).toBe(642);
    expect(chart.waypoints[1].state).toBe('CURRENT');
  });

  it('adjusts only the route ahead, protecting reached history and asking before rewriting worked waypoints', async () => {
    const reached = chart.waypoints[0];
    const current = chart.waypoints[1];
    const last = chart.waypoints[2];
    await chartService.completeMove(userId, chart.id, chart.currentMoveId);
    chart = await courseService.getCourse(userId, chart.id);

    // Dropping the current waypoint (which has a completed Move) needs confirmation.
    const withoutCurrent = [
      { title: 'Retention holds at 40%' },
      { id: last.id, title: last.title, kind: 'METRIC', metricLabel: 'active users', metricTarget: 10000 },
    ];
    await expect(
      chartService.applyRoute(userId, chart.id, {
        expectedCourseVersion: chart.version,
        idempotencyKey: key('adjust-unconfirmed'),
        waypoints: withoutCurrent,
      })
    ).rejects.toMatchObject({ code: 'ROUTE_REWRITE_CONFIRMATION_REQUIRED' });

    // Reached waypoints cannot be smuggled back in.
    await expect(
      chartService.applyRoute(userId, chart.id, {
        expectedCourseVersion: chart.version,
        idempotencyKey: key('adjust-reached'),
        waypoints: [{ id: reached.id, title: 'Renamed history' }],
        confirmRewrite: true,
      })
    ).rejects.toMatchObject({ code: 'WAYPOINT_TRANSITION_INVALID' });

    const adjustKey = key('adjust');
    chart = await chartService.applyRoute(userId, chart.id, {
      expectedCourseVersion: chart.version,
      idempotencyKey: adjustKey,
      waypoints: [
        { id: current.id, title: 'Reach 1,000 active users', kind: 'METRIC', metricLabel: 'active users', metricTarget: 1000 },
        { title: 'Retention holds at 40%' },
        { id: last.id, title: last.title, kind: 'METRIC', metricLabel: 'active users', metricTarget: 10000 },
      ],
      adjustmentReason: 'TOO_FEW_STEPS',
    });
    const live = chart.waypoints.filter((w: any) => w.state !== 'CANCELLED');
    expect(live.map((w: any) => w.title)).toEqual([
      'Validate repeatable acquisition',
      'Reach 1,000 active users',
      'Retention holds at 40%',
      'Reach 10,000 active users',
    ]);
    expect(live[0]).toMatchObject({ id: reached.id, state: 'REACHED' });
    expect(chart.currentWaypointId).toBe(current.id);
    expect(await events(chart.id, 'ROUTE_ADJUSTED')).toHaveLength(1);

    const replay = await chartService.applyRoute(userId, chart.id, {
      expectedCourseVersion: chart.version,
      idempotencyKey: adjustKey,
      waypoints: [{ title: 'ignored on replay' }],
    });
    expect(replay.version).toBe(chart.version);
    expect(await events(chart.id, 'ROUTE_ADJUSTED')).toHaveLength(1);
  });

  it('reaches the destination: COMPLETED, one DESTINATION_REACHED fact, recommendation signal', async () => {
    for (;;) {
      const fresh = await courseService.getCourse(userId, chart.id);
      if (fresh.status === 'COMPLETED') {
        chart = fresh;
        break;
      }
      await courseService.completeWaypoint(userId, chart.id, fresh.currentWaypointId, {
        idempotencyKey: key('finish'),
        expectedCourseVersion: fresh.version,
      });
    }
    expect(chart.completedAt).not.toBeNull();
    expect(chart.currentMoveId).toBeNull();
    expect(await events(chart.id, 'COURSE_COMPLETED')).toHaveLength(1);
    const destination = await ledger('DESTINATION_REACHED', chart.id);
    expect(destination).toHaveLength(1);
    expect(destination[0].significance).toBe('MAJOR');

    // Recommended Today stays server-authoritative: the existing signal logic sees it.
    const { recommendationService } = require('../../v2/RecommendationService');
    const context = await recommendationService.getRecommendationContext(userId, anchorId);
    expect(JSON.stringify(context)).toContain('destination_reached');

    const view = await chartService.getChartForAnchor(userId, anchorId);
    expect(view.chart.id).toBe(chart.id);
    expect(view.chart.status).toBe('COMPLETED');
    expect(view.stats.completedMoveCount).toBe(2);
  });

  it('preserves the completed journey when the Anchor is released', async () => {
    const result = await releaseService.release(userId, anchorId, key('release'));
    expect(result.lifecycleState).toBe('released');
    const row = await prisma.course.findUnique({ where: { id: chart.id } });
    expect(row.status).toBe('COMPLETED');
    expect(row.archivedAt).not.toBeNull();
    expect(await prisma.move.count({ where: { courseId: chart.id } })).toBeGreaterThanOrEqual(3);
    expect(await prisma.waypoint.count({ where: { courseId: chart.id, reachedAt: { not: null } } })).toBe(4);

    const view = await chartService.getChartForAnchor(userId, anchorId);
    expect(view.anchor.released).toBe(true);
    expect(view.chart.id).toBe(chart.id);
    expect(view.chart.visionId).not.toBeNull();
    expect(view.chart.needsRepair).toBeUndefined();

    // Released Anchors cannot start a new Chart.
    await expect(
      chartService.createChart(userId, {
        anchorId,
        idempotencyKey: key('after-release'),
        destinationText: 'x',
        waypoints: baseRoute,
      })
    ).rejects.toMatchObject({ code: 'ANCHOR_UNAVAILABLE' });
  });

  it('archives an unfinished Chart on release without leaving it corrupt', async () => {
    await releaseService.release(userId, otherAnchorId, key('release-open'));
    const view = await chartService.getChartForAnchor(userId, otherAnchorId);
    const history = [view.chart, ...view.history].filter(Boolean);
    expect(history.some((c: any) => c.status === 'ARCHIVED')).toBe(true);
    const archived = await prisma.course.findFirst({ where: { anchorId: otherAnchorId } });
    expect(archived.currentWaypointId).toBeNull();
  });

  describe('planner provider chain', () => {
    let plannerAnchorId: string;

    function provider(name: 'openai' | 'gemini', behaviour: (request: ChartModelRequest) => Promise<unknown>) {
      const calls: ChartModelRequest[] = [];
      const instance: ChartModelProvider = {
        name,
        model: `${name}-test-model`,
        generateJson: async request => {
          calls.push(request);
          return behaviour(request);
        },
      };
      return { instance, calls };
    }

    const goodRoute = {
      needsMoreContext: false,
      followUpQuestion: null,
      destination: 'Reach 10,000 active users',
      complexity: 'MODERATE',
      waypoints: ['Validate product-market fit', 'Reach 500 active users', 'Reach 1,000 active users', 'Reach 10,000 active users'].map(
        title => ({ title, rationale: null, type: 'MILESTONE', targetMetric: null, targetValue: null, baselineValue: null })
      ),
      suggestedOneMove: { title: 'Finish onboarding redesign', rationale: null },
      personalizedGuidance: null,
    };

    function planner(...providers: ChartModelProvider[]) {
      return new ChartPlannerService(() => ({ providers, primaryTimeoutMs: 1000, fallbackTimeoutMs: 1000 }));
    }

    beforeAll(async () => {
      plannerAnchorId = (
        await prisma.anchor.create({ data: { userId, intentionText: 'Anchor has 10,000 active users', category: 'career' } })
      ).id;
      await prisma.vision.create({
        data: { userId, anchorId: plannerAnchorId, description: 'My RevenueCat dashboard shows 10 thousand users.' },
      });
    });

    it('uses the primary provider and sends Vision context without asking for the destination again', async () => {
      const primary = provider('openai', async () => goodRoute);
      const result = await planner(primary.instance).generate(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-primary'),
        startingContext: 'App is live with 100 users.',
      });
      expect(result.status).toBe('proposal');
      expect(result.proposal.generation).toEqual({ source: 'ai', fallbackUsed: false, needsNaming: false });
      expect(result.proposal.waypoints).toHaveLength(4);
      expect(result.proposal.complexity).toBe('MODERATE');
      expect(primary.calls[0].user).toContain('RevenueCat dashboard');
      expect(primary.calls[0].user).toContain('already pictured the destination');
      const row = await prisma.aIPlanProposal.findUnique({ where: { id: result.proposal.proposalId } });
      expect(row).toMatchObject({ generationSource: 'openai', anchorId: plannerAnchorId, status: 'PENDING' });
    });

    it('falls back when the primary fails or returns malformed output, without exposing the provider', async () => {
      const failing = provider('openai', async () => {
        throw new ChartProviderError('timeout', 'openai');
      });
      const malformed = provider('openai', async () => ({ route: 'three steps' }));
      const fallback = provider('gemini', async () => goodRoute);

      for (const primary of [failing, malformed]) {
        const result = await planner(primary.instance, fallback.instance).generate(userId, {
          anchorId: plannerAnchorId,
          idempotencyKey: key('plan-fallback'),
        });
        expect(result.proposal.generation).toEqual({ source: 'ai', fallbackUsed: true, needsNaming: false });
        expect(JSON.stringify(result)).not.toMatch(/gemini|openai/i);
      }
    });

    it('retries a fast transient failure once before falling back', async () => {
      let attempts = 0;
      const flaky = provider('openai', async () => {
        attempts += 1;
        if (attempts === 1) throw new ChartProviderError('unavailable', 'openai');
        return goodRoute;
      });
      const result = await planner(flaky.instance).generate(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-retry'),
      });
      expect(attempts).toBe(2);
      expect(result.proposal.generation.fallbackUsed).toBe(false);
    });

    it('produces a deterministic route when every provider fails — creation is never blocked', async () => {
      const down = provider('openai', async () => {
        throw new ChartProviderError('auth', 'openai');
      });
      const alsoDown = provider('gemini', async () => {
        throw new ChartProviderError('unavailable', 'gemini');
      });
      const result = await planner(down.instance, alsoDown.instance).generate(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-template'),
        startingContext: 'We have 100 active users',
      });
      expect(result.proposal.generation.source).toBe('template');
      expect(result.proposal.waypoints.map((w: any) => w.title)).toContain('Reach 10,000 active users');

      const none = await planner().generate(userId, { anchorId: plannerAnchorId, idempotencyKey: key('plan-none') });
      expect(none.proposal.generation.source).toBe('template');
    });

    it('asks one follow-up question, then plans once it is answered', async () => {
      const asks = provider('openai', async request =>
        request.user.includes('Do not ask a follow-up question')
          ? goodRoute
          : { ...goodRoute, needsMoreContext: true, followUpQuestion: 'Where are you starting from now?', waypoints: [] }
      );
      const first = await planner(asks.instance).generate(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-ask'),
      });
      expect(first).toEqual({ status: 'needs_context', followUpQuestion: 'Where are you starting from now?' });

      const second = await planner(asks.instance).generate(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-answer'),
        followUp: { question: 'Where are you starting from now?', answer: '100 users, no marketing yet.' },
      });
      expect(second.status).toBe('proposal');
    });

    it('revises an active route without letting the model rewrite reached waypoints', async () => {
      const created = await chartService.createChart(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-chart'),
        destinationText: 'Reach 10,000 active users',
        waypoints: [{ title: 'Validate acquisition' }, { title: 'Reach 1,000 users' }, { title: 'Reach 10,000 users' }],
      });
      await courseService.completeWaypoint(userId, created.id, created.currentWaypointId, {
        idempotencyKey: key('plan-reach'),
        expectedCourseVersion: created.version,
      });
      const revising = provider('openai', async () => ({
        ...goodRoute,
        waypoints: [goodRoute.waypoints[3]],
      }));
      const result = await planner(revising.instance).adjust(userId, {
        idempotencyKey: key('plan-adjust'),
        anchorId: plannerAnchorId,
        reason: 'FURTHER_ALONG',
        detail: 'Acquisition is solved; retention is the problem.',
        courseId: created.id,
      });
      expect(revising.calls[0].user).toContain('REACHED');
      expect(revising.calls[0].user).toContain('Return ONLY the waypoints that remain ahead');
      expect(result.proposal.kind).toBe('ADJUST');
      expect(result.proposal.waypoints).toHaveLength(1);

      const down = provider('openai', async () => {
        throw new ChartProviderError('unavailable', 'openai');
      });
      await expect(
        planner(down.instance).adjust(userId, {
          idempotencyKey: key('plan-adjust-down'),
          anchorId: plannerAnchorId,
          reason: 'OTHER',
          courseId: created.id,
        })
      ).rejects.toMatchObject({ code: 'CHART_ADJUST_UNAVAILABLE' });
    });
  });
});
