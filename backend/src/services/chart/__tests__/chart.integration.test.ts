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

  it('applies the additive intelligence migration to populated legacy tables without changing achievements', async () => {
    const migration = require('fs').readFileSync(require('path').resolve(__dirname, '../../../../prisma/migrations/20261009000000_chart_intelligence/migration.sql'), 'utf8');
    await prisma.$transaction(async (tx: any) => {
      // Transaction-local tables shadow the disposable DB tables; production tables are untouched.
      await tx.$executeRawUnsafe('CREATE TEMP TABLE courses (id TEXT, destination_text TEXT, version INTEGER) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE ai_plan_proposals (id TEXT, status TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE waypoints (id TEXT, progress_mode VARCHAR(8), metric_baseline DOUBLE PRECISION, metric_current DOUBLE PRECISION, metric_target DOUBLE PRECISION, reached_at TIMESTAMP) ON COMMIT DROP');
      await tx.$executeRawUnsafe("INSERT INTO courses VALUES ('legacy-course', 'Reach $111,000 net worth', 9)");
      await tx.$executeRawUnsafe("INSERT INTO ai_plan_proposals VALUES ('legacy-proposal', 'ACCEPTED')");
      await tx.$executeRawUnsafe("INSERT INTO waypoints VALUES ('legacy-numeric', 'numeric', 100, 642, 1000, '2026-10-01'), ('legacy-moves', 'moves', NULL, NULL, NULL, NULL), ('legacy-none', 'none', NULL, NULL, NULL, NULL)");
      const before = await tx.$queryRawUnsafe('SELECT id, progress_mode, metric_baseline, metric_current, metric_target, reached_at FROM waypoints ORDER BY id');
      for (const statement of migration.split(';').map((part: string) => part.trim()).filter((part: string) => part && !part.startsWith('--'))) await tx.$executeRawUnsafe(statement);
      const after = await tx.$queryRawUnsafe('SELECT id, progress_mode, metric_baseline, metric_current, metric_target, reached_at FROM waypoints ORDER BY id /* after column expansion */');
      expect(after).toEqual(before);
      expect(await tx.$queryRawUnsafe('SELECT destination_text, version, actual_starting_point, route_scope, route_start_position FROM courses')).toEqual([{ destination_text: 'Reach $111,000 net worth', version: 9, actual_starting_point: null, route_scope: 'DESTINATION', route_start_position: 0 }]);
      expect(await tx.$queryRawUnsafe('SELECT status, actual_starting_point, route_scope FROM ai_plan_proposals')).toEqual([{ status: 'ACCEPTED', actual_starting_point: null, route_scope: 'DESTINATION' }]);
      expect(await tx.$queryRawUnsafe('SELECT requirements, completion_criteria FROM waypoints')).toEqual(Array(3).fill({ requirements: null, completion_criteria: null }));
    });
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
    const completedBefore = await prisma.move.findMany({ where: { courseId: chart.id, status: 'COMPLETED' }, orderBy: { id: 'asc' } });
    const historyBefore = await prisma.courseEvent.findMany({ where: { courseId: chart.id }, orderBy: { id: 'asc' } });
    const currentBefore = await prisma.waypoint.findUnique({ where: { id: current.id } });

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
    expect(live.find((waypoint: any) => waypoint.id === current.id).metric).toMatchObject({ current: 642, baseline: currentBefore.metricBaseline });
    expect(await prisma.move.findMany({ where: { courseId: chart.id, status: 'COMPLETED' }, orderBy: { id: 'asc' } })).toEqual(completedBefore);
    expect(await prisma.courseEvent.findMany({ where: { id: { in: historyBefore.map((event: any) => event.id) } }, orderBy: { id: 'asc' } })).toEqual(historyBefore);
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

  it('persists decreasing numeric, independent checklist and binary completion through database reloads', async () => {
    const progressAnchor = await prisma.anchor.create({ data: { userId, intentionText: 'Complete launch preparation', category: 'career' } });
    let progressChart = await chartService.createChart(userId, {
      anchorId: progressAnchor.id, idempotencyKey: key('flexible-create'), destinationText: 'Complete launch preparation',
      waypoints: [
        { title: 'A recorded debt is cleared', kind: 'METRIC', progressMode: 'numeric', metricLabel: 'debt balance', metricBaseline: 1000, metricTarget: 0 },
        { title: 'Launch requirements are ready', progressMode: 'checklist', requirements: [{ id: 'screenshots', title: 'Store screenshots ready', completed: false }, { id: 'privacy', title: 'Privacy policy published', completed: false }] },
        { title: 'App is published', progressMode: 'completion', completionCriteria: 'The app is publicly available' },
      ],
    });
    const [numeric, checklist, binary] = progressChart.waypoints;
    await chartService.updateWaypointProgress(userId, progressChart.id, numeric.id, { expectedCourseVersion: progressChart.version, metricCurrent: -25 });
    progressChart = await courseService.getCourse(userId, progressChart.id);
    expect(progressChart.waypoints[0].metric).toEqual({ label: 'debt balance', baseline: 1000, target: 0, current: -25 });
    expect(await prisma.waypoint.findUnique({ where: { id: numeric.id } })).toMatchObject({ metricCurrent: -25, metricTarget: 0 });
    await courseService.completeWaypoint(userId, progressChart.id, numeric.id, { expectedCourseVersion: progressChart.version, idempotencyKey: key('flexible-numeric-reach') });
    const withMove = await chartService.addMove(userId, progressChart.id, { idempotencyKey: key('flexible-move'), waypointId: checklist.id, title: 'Draft privacy policy', makeCurrent: true });
    await chartService.completeMove(userId, progressChart.id, withMove.currentMoveId);
    progressChart = await courseService.getCourse(userId, progressChart.id);
    expect(progressChart.waypoints.find((w: any) => w.id === checklist.id).requirements.every((r: any) => !r.completed)).toBe(true);
    await chartService.updateWaypointProgress(userId, progressChart.id, checklist.id, { expectedCourseVersion: progressChart.version, requirementId: 'privacy', completed: true });
    progressChart = await courseService.getCourse(userId, progressChart.id);
    expect(progressChart.waypoints.find((w: any) => w.id === checklist.id).requirements).toEqual([{ id: 'screenshots', title: 'Store screenshots ready', completed: false }, { id: 'privacy', title: 'Privacy policy published', completed: true }]);
    await courseService.completeWaypoint(userId, progressChart.id, checklist.id, { expectedCourseVersion: progressChart.version, idempotencyKey: key('flexible-checklist-reach') });
    progressChart = await courseService.getCourse(userId, progressChart.id);
    await expect(chartService.updateWaypointProgress(userId, progressChart.id, binary.id, { expectedCourseVersion: progressChart.version, metricCurrent: 50 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await courseService.completeWaypoint(userId, progressChart.id, binary.id, { expectedCourseVersion: progressChart.version, idempotencyKey: key('flexible-binary-reach') });
    const binaryRow = await prisma.waypoint.findUnique({ where: { id: binary.id } });
    expect(binaryRow).toMatchObject({ progressMode: 'completion', metricCurrent: null, metricTarget: null });
    expect(binaryRow.reachedAt).toBeInstanceOf(Date);
    expect(await events(progressChart.id, 'MOVE_COMPLETED')).toHaveLength(1);
  });

  it('extends completed stretches beyond twelve historical waypoints without losing achievements', async () => {
    const a = await prisma.anchor.create({ data: { userId, intentionText: 'Reach $111,000 net worth', category: 'abundance' } });
    let stretch = await chartService.createChart(userId, {
      anchorId: a.id, idempotencyKey: key('stretch-create'), destinationText: 'Reach $111,000 net worth',
      actualStartingPoint: 'Limited savings and little spare income', routeScope: 'NEXT_STRETCH',
      waypoints: [{ title: 'A feasible saving commitment exists', progressMode: 'completion' }, { title: 'First contribution recorded', progressMode: 'completion' }],
      oneMove: { title: 'List essential costs and available income' },
    });
    const moveId = stretch.currentMoveId;
    await chartService.completeMove(userId, stretch.id, moveId);
    for (let iteration = 0; iteration < 7; iteration += 1) {
      stretch = await courseService.getCourse(userId, stretch.id);
      while (stretch.status === 'ACTIVE') {
        await courseService.completeWaypoint(userId, stretch.id, stretch.currentWaypointId, { expectedCourseVersion: stretch.version, idempotencyKey: key('stretch-reach') });
        stretch = await courseService.getCourse(userId, stretch.id);
      }
      const reached = await prisma.waypoint.findMany({ where: { courseId: stretch.id, reachedAt: { not: null } }, orderBy: { id: 'asc' } });
      const log = await prisma.courseEvent.findMany({ where: { courseId: stretch.id }, orderBy: { id: 'asc' } });
      stretch = await chartService.applyRoute(userId, stretch.id, {
        expectedCourseVersion: stretch.version, idempotencyKey: key('stretch-extend'), routeScope: 'NEXT_STRETCH',
        waypoints: [{ title: `Next feasible commitment ${iteration}`, progressMode: 'completion' }, { title: `Next contribution recorded ${iteration}`, progressMode: 'completion' }],
        oneMove: { title: 'Review available income before choosing a contribution' },
      });
      expect(stretch.status).toBe('ACTIVE');
      expect(stretch.destinationText).toBe('Reach $111,000 net worth');
      expect(await prisma.waypoint.findMany({ where: { id: { in: reached.map((w: any) => w.id) } }, orderBy: { id: 'asc' } })).toEqual(reached);
      expect(await prisma.courseEvent.findMany({ where: { id: { in: log.map((e: any) => e.id) } }, orderBy: { id: 'asc' } })).toEqual(log);
      expect(stretch.moves.find((m: any) => m.id === stretch.currentMoveId)).toMatchObject({ status: 'ACTIVE', source: 'AI' });
    }
    expect(await prisma.waypoint.count({ where: { courseId: stretch.id, reachedAt: { not: null } } })).toBe(14);
    expect(await prisma.move.findUnique({ where: { id: moveId } })).toMatchObject({ status: 'COMPLETED' });
    expect(await ledger('DESTINATION_REACHED', stretch.id)).toHaveLength(0);
    expect(await events(stretch.id, 'DESTINATION_CHANGED')).toHaveLength(0);
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
      routeScope: 'DESTINATION',
      analysis: { startingPointSummary: 'App launched with 100 users.', assumptions: [], firstMilestoneEvidence: 'Existing users can provide product feedback without new resources.', difficultyReduction: null, prerequisites: [0, 1, 2, 3].map(waypointIndex => ({ waypointIndex, requires: waypointIndex ? [waypointIndex - 1] : [] })) },
    };
    goodRoute.waypoints = goodRoute.waypoints.map(waypoint => ({ ...waypoint, metricType: 'completion', completionCriteria: waypoint.title, requirements: [] }));

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
        actualStartingPoint: 'App is live with 100 users.',
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
          actualStartingPoint: 'App is live with 100 users.',
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
        actualStartingPoint: 'App is live with 100 users.',
      });
      expect(attempts).toBe(2);
      expect(result.proposal.generation.fallbackUsed).toBe(false);
    });

    it('fails clearly with CHART_PLAN_UNAVAILABLE when every provider fails — does not persist generic fallback content', async () => {
      const down = provider('openai', async () => {
        throw new ChartProviderError('auth', 'openai');
      });
      const alsoDown = provider('gemini', async () => {
        throw new ChartProviderError('unavailable', 'gemini');
      });
      const idempotencyKey = key('plan-template-fail');
      await expect(
        planner(down.instance, alsoDown.instance).generate(userId, {
          anchorId: plannerAnchorId,
          idempotencyKey,
          startingContext: 'We have 100 active users',
          actualStartingPoint: 'We have 100 active users',
        })
      ).rejects.toMatchObject({
        status: 503,
        code: 'CHART_PLAN_UNAVAILABLE',
      });

      // Confirm no proposal was persisted
      const proposalRow = await prisma.aIPlanProposal.findUnique({
        where: { idempotencyKey: `usr_${userId}:plan:${idempotencyKey}` },
      });
      expect(proposalRow).toBeNull();

      await expect(
        planner().generate(userId, {
          anchorId: plannerAnchorId,
          idempotencyKey: key('plan-none-fail'),
          actualStartingPoint: '100 users.',
        })
      ).rejects.toMatchObject({
        status: 503,
        code: 'CHART_PLAN_UNAVAILABLE',
      });
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
      expect(first).toMatchObject({ status: 'needs_context' });
      expect(first.followUpQuestion).toMatch(/starting today/);
      expect(asks.calls).toHaveLength(0);

      const second = await planner(asks.instance).generate(userId, {
        anchorId: plannerAnchorId,
        idempotencyKey: key('plan-answer'),
        followUp: { question: 'Where are you starting from now?', answer: '100 users, no marketing yet.' },
      });
      expect(second.status).toBe('proposal');
    });

    it('rejects numeric subdivision for $111,000 then applies an achievable stretch without losing recorded work', async () => {
      const financialAnchor = await prisma.anchor.create({ data: { userId, intentionText: 'Reach $111,000 net worth', category: 'abundance' } });
      let financial = await chartService.createChart(userId, {
        anchorId: financialAnchor.id, idempotencyKey: key('financial-create'), destinationText: 'Reach $111,000 net worth',
        actualStartingPoint: 'I have $20 in savings, no investments, and little spare income.',
        waypoints: [22200, 44400, 66600, 88800, 111000].map(metricTarget => ({ title: `Reach $${metricTarget} net worth`, kind: 'METRIC', metricLabel: 'USD net worth', metricTarget, metricBaseline: 20 })),
        oneMove: { title: 'List essential costs and available income' },
      });
      const previousId = financial.currentWaypointId;
      const completedMoveId = financial.currentMoveId;
      await chartService.completeMove(userId, financial.id, completedMoveId);
      financial = await courseService.getCourse(userId, financial.id);
      await chartService.updateWaypointProgress(userId, financial.id, previousId, { expectedCourseVersion: financial.version, metricCurrent: 20 });
      financial = await courseService.getCourse(userId, financial.id);
      const oldEvents = await prisma.courseEvent.findMany({ where: { courseId: financial.id }, orderBy: { id: 'asc' } });
      const evidence = { startingPointSummary: 'Limited savings and little spare income.', assumptions: [], firstMilestoneEvidence: 'Reviewing essential costs requires no investment capital.', difficultyReduction: 'Replace an unsupported $22,200 jump with prerequisite states grounded in available income.', prerequisites: [0, 1, 2].map(waypointIndex => ({ waypointIndex, requires: waypointIndex ? [waypointIndex - 1] : [] })) };
      const arithmetic = provider('openai', async () => ({ ...goodRoute, destination: 'Reach $111,000 net worth', routeScope: 'NEXT_STRETCH', analysis: { ...evidence, prerequisites: [0, 1, 2, 3, 4].map(waypointIndex => ({ waypointIndex, requires: [] })) }, waypoints: [11100, 22200, 44400, 66600, 111000].map(targetValue => ({ title: `Reach $${targetValue} net worth`, rationale: null, type: 'METRIC', metricType: 'numeric', targetMetric: 'USD net worth', targetValue, baselineValue: 20, completionCriteria: 'Recorded net worth reaches target', requirements: [] })) }));
      await expect(planner(arithmetic.instance).adjust(userId, { anchorId: financialAnchor.id, courseId: financial.id, idempotencyKey: key('financial-bad'), reason: 'SMALLER_STEPS' })).rejects.toMatchObject({ code: 'CHART_ADJUST_UNAVAILABLE' });
      expect((await courseService.getCourse(userId, financial.id)).version).toBe(financial.version);
      const realistic = provider('openai', async request => request.schemaName === 'chart_revision_validation'
        ? { startingAligned: true, prerequisitesComplete: true, materiallyEasier: true, oneMoveActionable: true, destinationConsistent: true }
        : ({ ...goodRoute, destination: 'Reach $111,000 net worth', routeScope: 'NEXT_STRETCH', analysis: evidence, waypoints: ['A feasible surplus is identified', 'One achievable saving commitment exists', 'First chosen buffer contribution recorded'].map(title => ({ title, rationale: null, type: 'MILESTONE', metricType: 'completion', targetMetric: null, targetValue: null, baselineValue: null, completionCriteria: title, requirements: [] })), suggestedOneMove: { title: 'Write down this week’s essential costs and available income', rationale: null } }));
      const revised = await planner(realistic.instance).adjust(userId, { anchorId: financialAnchor.id, courseId: financial.id, idempotencyKey: key('financial-good'), reason: 'SMALLER_STEPS' });
      const reviewed = revised.proposal;
      financial = await chartService.applyRoute(userId, financial.id, { expectedCourseVersion: financial.version, idempotencyKey: key('financial-apply'), proposalId: reviewed.proposalId, routeScope: reviewed.routeScope, destinationText: reviewed.destination, waypoints: reviewed.waypoints, oneMove: reviewed.suggestedOneMove, confirmRewrite: true });
      expect(financial.destinationText).toBe('Reach $111,000 net worth');
      expect(await prisma.waypoint.findUnique({ where: { id: previousId } })).toMatchObject({ metricCurrent: 20, metricBaseline: 20 });
      expect((await prisma.waypoint.findUnique({ where: { id: previousId } })).cancelledAt).toBeInstanceOf(Date);
      expect(await prisma.move.findUnique({ where: { id: completedMoveId } })).toMatchObject({ status: 'COMPLETED' });
      expect(await prisma.courseEvent.findMany({ where: { id: { in: oldEvents.map((event: any) => event.id) } }, orderBy: { id: 'asc' } })).toEqual(oldEvents);
      expect(await prisma.aIPlanProposal.findUnique({ where: { id: reviewed.proposalId } })).toMatchObject({ status: 'ACCEPTED' });
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
        analysis: { ...goodRoute.analysis, prerequisites: [{ waypointIndex: 0, requires: [] }] },
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
