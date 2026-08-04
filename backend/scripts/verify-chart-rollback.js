#!/usr/bin/env node
/**
 * Real-PostgreSQL verification for the Chart rollback policy (H-004).
 *
 * Proves against a live database that:
 *   1-5. the production rollback procedure preserves Courses, Reflection text,
 *        Course Events, AI proposals, and PracticeSession Chart context;
 *   6-7. Sanctuary and Practice remain usable, including old-client writes;
 *   10.  default execution of the destructive SQL aborts;
 *   11.  an explicit disposable-database opt-in permits the cleanup;
 *   12.  the destructive path reports irreversible data loss;
 *   13.  migration forward and reapply remain valid on a disposable database.
 *
 * Flag behaviour (8: Chart becomes unavailable through flags, 9: re-enabling
 * restores access) is proven in `src/config/__tests__/chartRollbackSafety.test.ts`.
 * This script proves the data half — what a schema rollback would destroy.
 *
 * DISPOSABLE DATABASES ONLY. The final steps drop the Chart tables.
 *
 *   CHART_ROLLBACK_VERIFY_URL="postgresql://..." node scripts/verify-chart-rollback.js
 */

const { execFileSync } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const url = process.env.CHART_ROLLBACK_VERIFY_URL;
if (!url) {
  console.error('CHART_ROLLBACK_VERIFY_URL is required (disposable database only).');
  process.exit(2);
}

const backendDir = path.resolve(__dirname, '..');
const migrations = path.join(backendDir, 'prisma', 'migrations');
const PRODUCTION_ROLLBACK = path.join(
  migrations,
  'ROLLBACK_20260802000000_add_chart_backend_foundation.sql'
);
const DEV_ROLLBACK = path.join(
  migrations,
  'DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql'
);
const OPT_IN = 'i_understand_this_permanently_deletes_chart_data';
const CANARY = 'CHART-ROLLBACK-CANARY-REFLECTION-TEXT-4c1f';

const prisma = new PrismaClient({ datasources: { db: { url } } });
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
}

function run(command, args, extraEnv = {}) {
  try {
    const stdout = execFileSync(command, args, {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: url, ...extraEnv },
      encoding: 'utf8',
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    return { ok: true, output: stdout };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ''}\n${error.stderr ?? ''}`.trim(),
    };
  }
}

/**
 * `SET` is session-scoped and `prisma db execute` opens its own connection, so
 * the opt-in has to travel in the same file — exactly as the runbook's psql
 * invocation puts it on the same connection.
 */
function executeSql(file, { optIn = false } = {}) {
  const body = fs.readFileSync(file, 'utf8');
  const target = path.join(os.tmpdir(), `chart-rollback-${Date.now()}.sql`);
  fs.writeFileSync(target, optIn ? `SET anchor.chart_destructive_rollback = '${OPT_IN}';\n${body}` : body);
  try {
    return run('npx', ['prisma', 'db', 'execute', '--file', target, '--url', url]);
  } finally {
    fs.unlinkSync(target);
  }
}

const migrateDeploy = () => run('npx', ['prisma', 'migrate', 'deploy']);

const count = async (sql) => {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0].count);
};

async function counts() {
  return {
    courses: await count('SELECT count(*) FROM courses'),
    waypoints: await count('SELECT count(*) FROM waypoints'),
    events: await count('SELECT count(*) FROM course_events'),
    links: await count('SELECT count(*) FROM course_anchor_links'),
    proposals: await count('SELECT count(*) FROM ai_plan_proposals'),
    reflections: await count('SELECT count(*) FROM reflections'),
    canary: await count(`SELECT count(*) FROM reflections WHERE body = '${CANARY}'`),
    chartSessions: await count('SELECT count(*) FROM practice_sessions WHERE course_id IS NOT NULL'),
    sessions: await count('SELECT count(*) FROM practice_sessions'),
    users: await count('SELECT count(*) FROM users'),
    anchors: await count('SELECT count(*) FROM anchors'),
  };
}

/** A schema-complete PracticeSession; `chart` adds the nullable Chart context. */
function practiceSession(userId, anchorId, chart = null) {
  const now = new Date();
  return {
    id: randomUUID(),
    userId,
    anchorId,
    practiceMode: 'stabilize',
    plannedDurationSeconds: 300,
    completedDurationSeconds: 300,
    startedAt: now,
    completedAt: now,
    localDateKey: now.toISOString().slice(0, 10),
    timeZone: 'UTC',
    utcOffsetMinutesAtCompletion: 0,
    completionSource: 'timer',
    guidanceVoice: 'none',
    backgroundAudio: 'none',
    ...(chart ?? {}),
  };
}

async function seed() {
  // Start from a clean slate so the script is re-runnable; the one-active-Course
  // index would otherwise reject a second seeded Course.
  await prisma.user.deleteMany({ where: { email: 'rollback-verify@example.test' } });
  const user = await prisma.user.create({
    data: {
      email: 'rollback-verify@example.test',
      authUid: 'rb-auth-1',
      authProvider: 'email',
      chartSchemaVersion: 1,
    },
  });
  const anchor = await prisma.anchor.create({
    data: {
      userId: user.id,
      intentionText: 'rollback verify anchor',
      category: 'health',
      distilledLetters: ['R', 'V'],
    },
  });
  const course = await prisma.course.create({
    data: {
      userId: user.id,
      destinationText: 'rollback verify destination',
      status: 'ACTIVE',
      idempotencyKey: `rb-course-${Date.now()}`,
      plottedAt: new Date(),
      waypoints: {
        create: [{ userId: user.id, position: 100, title: 'rollback verify waypoint' }],
      },
    },
    include: { waypoints: true },
  });
  const waypoint = course.waypoints[0];
  await prisma.course.update({
    where: { id: course.id },
    data: { currentWaypointId: waypoint.id },
  });
  await prisma.courseAnchorLink.create({
    data: {
      userId: user.id,
      courseId: course.id,
      waypointId: waypoint.id,
      anchorId: anchor.id,
      role: 'WAYPOINT_PRIMARY',
      anchorSnapshot: {
        anchorId: anchor.id,
        intentionText: 'rollback verify anchor',
        category: 'health',
      },
    },
  });
  await prisma.courseEvent.create({
    data: {
      userId: user.id,
      courseId: course.id,
      waypointId: waypoint.id,
      eventType: 'COURSE_CREATED',
      occurredAt: new Date(),
      idempotencyKey: `rb-event-${Date.now()}`,
    },
  });
  await prisma.reflection.create({
    data: {
      userId: user.id,
      source: 'MANUAL_COURSE',
      promptType: 'COURSE_STATUS',
      promptVersion: 1,
      body: CANARY,
      courseId: course.id,
      idempotencyKey: `rb-reflection-${Date.now()}`,
    },
  });
  await prisma.aIPlanProposal.create({
    data: {
      userId: user.id,
      inputHash: 'rb-hash',
      status: 'PENDING',
      plannerVersion: 'verify-1',
      modelVersion: 'verify-model',
      destinationInterpretation: 'rollback verify interpretation',
      waypoints: [{ title: 'rollback verify waypoint', position: 100 }],
      generationSource: 'deterministic_fallback',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      idempotencyKey: `rb-proposal-${Date.now()}`,
    },
  });
  await prisma.practiceSession.create({
    data: practiceSession(user.id, anchor.id, {
      courseId: course.id,
      waypointId: waypoint.id,
      practiceEntrySource: 'chart_waypoint_detail',
    }),
  });
  await prisma.practiceSession.create({ data: practiceSession(user.id, anchor.id) });
  return { user, anchor };
}

async function main() {
  console.log('— migrate forward —');
  const forward = migrateDeploy();
  check('migration applies forward', forward.ok, forward.ok ? '' : forward.output);

  const seeded = await seed();
  const before = await counts();
  check('seeded Chart data present', before.canary === 1 && before.courses >= 1, JSON.stringify(before));

  // The supported production rollback is flag composition; it executes no SQL.
  // The shipped rollback artifact must refuse if an operator reaches for it.
  console.log('\n— production rollback artifact —');
  const refused = executeSql(PRODUCTION_ROLLBACK);
  check('production rollback script refuses to execute', !refused.ok, refused.output.split('\n').slice(0, 3).join(' '));

  const after = await counts();
  check('1. Course data preserved', after.courses === before.courses && after.waypoints === before.waypoints);
  check('2. Reflection text preserved', after.canary === 1 && after.reflections === before.reflections);
  check('3. Course Events preserved', after.events === before.events);
  check('4. AI proposals preserved', after.proposals === before.proposals);
  check('5. PracticeSession Chart context preserved', after.chartSessions === before.chartSessions);
  check('6. Sanctuary usable (users/anchors intact)', after.users === before.users && after.anchors === before.anchors);
  check('7. Practice usable', after.sessions === before.sessions);
  check('   Course/Anchor links preserved', after.links === before.links);

  await prisma.practiceSession.create({
    data: practiceSession(seeded.user.id, seeded.anchor.id),
  });
  check('   old-client Practice write succeeds', (await counts()).sessions === before.sessions + 1);

  console.log('\n— destructive script guard —');
  const aborted = executeSql(DEV_ROLLBACK);
  check('10. default execution of the destructive SQL aborts', !aborted.ok);
  check(
    '12. the abort reports irreversible data loss',
    /permanently destroyed/i.test(aborted.output) && /recovers none/i.test(aborted.output),
    aborted.output.split('\n').filter((line) => /Refusing|permanently|recovers/i.test(line)).join(' ')
  );
  const survived = await counts();
  check('   the refused run deleted nothing', survived.canary === 1 && survived.courses === before.courses);

  console.log('\n— opted-in disposable cleanup —');
  const destroyed = executeSql(DEV_ROLLBACK, { optIn: true });
  check('11. explicit disposable opt-in permits destructive cleanup', destroyed.ok, destroyed.ok ? '' : destroyed.output);

  const remaining = Number(
    (
      await prisma.$queryRawUnsafe(
        `SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('courses','waypoints','course_events','course_anchor_links','ai_plan_proposals','reflections')`
      )
    )[0].count
  );
  check('   Chart tables dropped on the disposable database', remaining === 0, `${remaining} remain`);
  check('   Sanctuary and Practice survive even the destructive path', (await count('SELECT count(*) FROM practice_sessions')) > 0);

  console.log('\n— migration reapply —');
  const reapply = migrateDeploy();
  check('13. migration reapplies cleanly', reapply.ok, reapply.ok ? '' : reapply.output);
  const reapplied = await counts();
  check(
    '   reapply recreates EMPTY tables (destroyed text is unrecoverable)',
    reapplied.courses === 0 && reapplied.reflections === 0,
    JSON.stringify({ courses: reapplied.courses, reflections: reapplied.reflections })
  );
}

main()
  .catch((error) => {
    console.error(error);
    results.push({ name: 'script completed', ok: false });
  })
  .finally(async () => {
    await prisma.$disconnect();
    const failed = results.filter((entry) => !entry.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length === 0 ? 0 : 1);
  });

