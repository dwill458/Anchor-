import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Disposable-database verification for Workstream A.
 *
 * This script intentionally refuses to run without CHART_DATABASE_VERIFY=1.
 * It uses structural test identifiers only and is for a disposable or staging
 * database, never production.
 */

const prisma = new PrismaClient();
const USER_ID = 'chart-db-verify-user';
const NOW = '2026-08-02T12:00:00.000Z';

function literal(value: string): string {
  return `'${value.split("'").join("''")}'`;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectRejected(work: Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await work;
  } catch {
    rejected = true;
  }
  expect(rejected, message);
}

async function pause(milliseconds = 75): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function runSerializable(
  work: (tx: Prisma.TransactionClient) => Promise<void>
): Promise<void> {
  await prisma.$transaction(work, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

async function insertUser(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "users" ("id", "email", "authProvider", "authUid", "updatedAt")
    VALUES (${literal(id)}, ${literal(`${id}@example.invalid`)}, 'test', ${literal(`${id}-auth`)}, ${literal(NOW)})
    ON CONFLICT ("id") DO NOTHING
  `);
}

async function insertCourse(
  id: string,
  status: 'DRAFT' | 'ACTIVE' = 'DRAFT',
  ownerId = USER_ID
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "courses" ("id", "user_id", "destination_text", "status", "version", "created_at", "updated_at", "schema_version")
    VALUES (${literal(id)}, ${literal(ownerId)}, 'verification destination', '${status}', 1, ${literal(NOW)}, ${literal(NOW)}, 1)
  `);
}

async function insertWaypoint(
  id: string,
  courseId: string,
  position = 100,
  title = 'verification waypoint',
  ownerId = USER_ID
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "waypoints" ("id", "user_id", "course_id", "position", "title", "created_at", "updated_at")
    VALUES (${literal(id)}, ${literal(ownerId)}, ${literal(courseId)}, ${position}, ${literal(title)}, ${literal(NOW)}, ${literal(NOW)})
  `);
}

async function insertAnchor(id: string, ownerId = USER_ID): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "anchors" ("id", "userId", "intentionText", "category", "distilledLetters", "baseSigilSvg", "updatedAt")
    VALUES (${literal(id)}, ${literal(ownerId)}, 'verification intention', 'verification', ARRAY['V'], '<svg/>', ${literal(NOW)})
  `);
}

async function linkAnchor(
  id: string,
  courseId: string,
  waypointId: string,
  anchorId: string,
  role = 'WAYPOINT_PRIMARY',
  ownerId = USER_ID
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "course_anchor_links" ("id", "user_id", "course_id", "waypoint_id", "anchor_id", "role", "anchor_snapshot", "linked_at", "created_at", "updated_at")
    VALUES (${literal(id)}, ${literal(ownerId)}, ${literal(courseId)}, ${literal(waypointId)}, ${literal(anchorId)}, '${role}', '{"snapshotVersion":1,"anchorId":"${anchorId}","intentionText":"verification intention","category":"verification","releasedAtUnlink":false}'::jsonb, ${literal(NOW)}, ${literal(NOW)}, ${literal(NOW)})
  `);
}

async function runRace(
  label: string,
  left: () => Promise<void>,
  right: () => Promise<void>
): Promise<{ label: string; successes: number; failures: number }> {
  const outcomes = await Promise.all(
    [left, right].map(async work => {
      try {
        await work();
        return 'success';
      } catch {
        return 'failure';
      }
    })
  );
  return {
    label,
    successes: outcomes.filter(outcome => outcome === 'success').length,
    failures: outcomes.filter(outcome => outcome === 'failure').length,
  };
}

async function main(): Promise<void> {
  if (process.env.CHART_DATABASE_VERIFY !== '1') {
    throw new Error('Set CHART_DATABASE_VERIFY=1 to run disposable database verification');
  }

  const beforePractice = (await prisma.$queryRawUnsafe(
    `SELECT "id", "course_id", "waypoint_id", "practice_entry_source" FROM "practice_sessions" WHERE "id" = 'verify-practice'`
  )) as Array<Record<string, unknown>>;
  expect(beforePractice.length === 1, 'Representative legacy PracticeSession seed is missing');

  const tables = (await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('courses','waypoints','course_anchor_links','reflections','course_events','ai_plan_proposals')
    ORDER BY table_name
  `)) as Array<{ table_name: string }>;
  const expectedTables = [
    'ai_plan_proposals',
    'course_anchor_links',
    'course_events',
    'courses',
    'reflections',
    'waypoints',
  ];
  expect(
    JSON.stringify(tables.map(row => row.table_name)) === JSON.stringify(expectedTables),
    'Chart table set is incomplete'
  );

  const userColumn = (await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'chart_schema_version'
  `)) as Array<{ column_name: string }>;
  const practiceColumns = (await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'practice_sessions' AND column_name IN ('course_id','waypoint_id','practice_entry_source')
    ORDER BY column_name
  `)) as Array<{ column_name: string }>;
  expect(userColumn.length === 1, 'User.chartSchemaVersion is missing');
  expect(practiceColumns.length === 3, 'Chart PracticeSession columns are incomplete');

  const eventEnum = (await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'CourseEventType'
    ORDER BY enumsortorder
  `)) as Array<{ enumlabel: string }>;
  expect(
    eventEnum.some(row => row.enumlabel === 'WAYPOINT_CANCELLED'),
    'WAYPOINT_CANCELLED enum value is missing'
  );

  const indexes = (await prisma.$queryRawUnsafe(`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      AND indexname IN ('practice_sessions_course_id_completed_at_idx','courses_one_active_per_user','course_anchor_links_one_active_waypoint_primary','course_anchor_links_one_active_destination')
    ORDER BY indexname
  `)) as Array<{ indexname: string }>;
  expect(indexes.length === 4, 'Required Chart indexes are incomplete');
  const reflectionChecks = (await prisma.$queryRawUnsafe(`
    SELECT constraint_name FROM information_schema.check_constraints
    WHERE constraint_schema = 'public' AND constraint_name IN ('reflections_exactly_one_content_check','reflections_prompt_content_check')
  `)) as Array<{ constraint_name: string }>;
  expect(reflectionChecks.length === 2, 'Reflection check constraints are incomplete');

  const verifierCourseIds = [
    'index-active-1',
    'index-active-2',
    'link-course',
    'publish-1',
    'publish-2',
    'complete-race',
    'skip-race',
    'burn-complete-race',
    'replace-burn-race',
    'burn-contract',
  ];
  await prisma.$executeRawUnsafe(
    `DELETE FROM "courses" WHERE "id" IN (${verifierCourseIds.map(literal).join(',')})`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "anchors" WHERE "id" LIKE 'link-%' OR "id" LIKE 'burn-%' OR "id" LIKE 'replace-%'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "burned_anchors" WHERE "id" = 'burn-contract-anchor'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "practice_sessions" WHERE "id" IN ('chart-context-practice','burn-contract-practice')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "course_events" WHERE "user_id" = ${literal(USER_ID)}`
  );
  for (const verifierUser of [
    USER_ID,
    'index-active-user',
    'link-user',
    'publish-user',
    'complete-user',
    'skip-user',
    'burn-complete-user',
    'replace-burn-user',
    'burn-contract-user',
  ]) {
    await insertUser(verifierUser);
  }

  await insertCourse('index-active-1', 'ACTIVE', 'index-active-user');
  await expectRejected(
    prisma.$executeRawUnsafe(`
      INSERT INTO "courses" ("id", "user_id", "destination_text", "status", "version", "created_at", "updated_at", "schema_version")
      VALUES ('index-active-2', ${literal('index-active-user')}, 'verification destination', 'ACTIVE', 1, ${literal(NOW)}, ${literal(NOW)}, 1)
    `),
    'partial active-course index did not reject a duplicate'
  );

  await insertCourse('link-course', 'ACTIVE', 'link-user');
  await insertWaypoint('link-waypoint', 'link-course', 100, 'verification waypoint', 'link-user');
  await prisma.$executeRawUnsafe(
    `UPDATE "courses" SET "current_waypoint_id" = 'link-waypoint' WHERE "id" = 'link-course'`
  );
  await insertAnchor('link-anchor', 'link-user');
  await linkAnchor(
    'link-1',
    'link-course',
    'link-waypoint',
    'link-anchor',
    'WAYPOINT_PRIMARY',
    'link-user'
  );
  await expectRejected(
    prisma.$executeRawUnsafe(`
      INSERT INTO "course_anchor_links" ("id", "user_id", "course_id", "waypoint_id", "anchor_id", "role", "anchor_snapshot", "linked_at", "created_at", "updated_at")
      VALUES ('link-2', ${literal(USER_ID)}, 'link-course', 'link-waypoint', 'link-anchor', 'WAYPOINT_PRIMARY', '{}'::jsonb, ${literal(NOW)}, ${literal(NOW)}, ${literal(NOW)})
    `),
    'partial waypoint-primary index did not reject a duplicate'
  );

  await expectRejected(
    prisma.$executeRawUnsafe(`
      INSERT INTO "reflections" ("id", "user_id", "source", "prompt_type", "body", "idempotency_key", "created_at", "updated_at")
      VALUES ('invalid-reflection', ${literal(USER_ID)}, 'MANUAL_COURSE', 'COURSE_STATUS', NULL, 'invalid-reflection-key', ${literal(NOW)}, ${literal(NOW)})
    `),
    'Reflection check constraint did not reject invalid content'
  );

  await prisma.$executeRawUnsafe(`
    INSERT INTO "practice_sessions" ("id", "userId", "practice_mode", "planned_duration_seconds", "completed_duration_seconds", "completion_status", "started_at", "completed_at", "local_date_key", "time_zone", "utc_offset_minutes_at_completion", "completion_source", "schema_version", "guidance_voice", "background_audio", "updated_at", "course_id", "waypoint_id", "practice_entry_source")
    VALUES ('chart-context-practice', ${literal(USER_ID)}, 'focus', 60, 60, 'completed', ${literal(NOW)}, ${literal(NOW)}, '2026-08-02', 'UTC', 0, 'chart', 2, 'none', 'off', ${literal(NOW)}, 'link-course', 'link-waypoint', 'chart_waypoint_detail')
  `);
  const chartPractice = (await prisma.$queryRawUnsafe(`
    SELECT "course_id", "waypoint_id", "practice_entry_source" FROM "practice_sessions" WHERE "id" = 'chart-context-practice'
  `)) as Array<Record<string, unknown>>;
  expect(
    chartPractice[0]?.course_id === 'link-course' &&
      chartPractice[0]?.waypoint_id === 'link-waypoint' &&
      chartPractice[0]?.practice_entry_source === 'chart_waypoint_detail',
    'Chart PracticeSession context did not persist'
  );

  await insertCourse('publish-1', 'DRAFT', 'publish-user');
  await insertCourse('publish-2', 'DRAFT', 'publish-user');
  await insertWaypoint(
    'publish-waypoint-1',
    'publish-1',
    100,
    'verification waypoint',
    'publish-user'
  );
  await insertWaypoint(
    'publish-waypoint-2',
    'publish-2',
    100,
    'verification waypoint',
    'publish-user'
  );
  const publishRace = await runRace(
    'simultaneous Course publication',
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "status" = 'ACTIVE', "current_waypoint_id" = 'publish-waypoint-1' WHERE "id" = 'publish-1' AND "status" = 'DRAFT'`
        );
        expect(count === 1, 'publication lost its draft guard');
        await pause();
      }),
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "status" = 'ACTIVE', "current_waypoint_id" = 'publish-waypoint-2' WHERE "id" = 'publish-2' AND "status" = 'DRAFT'`
        );
        expect(count === 1, 'publication lost its draft guard');
        await pause();
      })
  );
  expect(publishRace.successes === 1, 'simultaneous Course publication did not have one winner');

  await insertCourse('complete-race', 'ACTIVE', 'complete-user');
  await insertWaypoint(
    'complete-race-waypoint',
    'complete-race',
    100,
    'verification waypoint',
    'complete-user'
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "courses" SET "current_waypoint_id" = 'complete-race-waypoint' WHERE "id" = 'complete-race'`
  );
  const completionRace = await runRace(
    'simultaneous waypoint completion',
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "waypoints" SET "reached_at" = NOW() WHERE "id" = 'complete-race-waypoint' AND "reached_at" IS NULL AND "skipped_at" IS NULL AND "cancelled_at" IS NULL`
        );
        expect(count === 1, 'completion lost its terminal-state guard');
        await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "status" = 'COMPLETED', "current_waypoint_id" = NULL, "version" = "version" + 1 WHERE "id" = 'complete-race' AND "version" = 1`
        );
        await pause();
      }),
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "waypoints" SET "reached_at" = NOW() WHERE "id" = 'complete-race-waypoint' AND "reached_at" IS NULL AND "skipped_at" IS NULL AND "cancelled_at" IS NULL`
        );
        expect(count === 1, 'completion lost its terminal-state guard');
        await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "status" = 'COMPLETED', "current_waypoint_id" = NULL, "version" = "version" + 1 WHERE "id" = 'complete-race' AND "version" = 1`
        );
        await pause();
      })
  );
  expect(completionRace.successes === 1, 'simultaneous completion did not have one winner');

  await insertCourse('skip-race', 'ACTIVE', 'skip-user');
  await insertWaypoint(
    'skip-race-waypoint',
    'skip-race',
    100,
    'verification waypoint',
    'skip-user'
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "courses" SET "current_waypoint_id" = 'skip-race-waypoint' WHERE "id" = 'skip-race'`
  );
  const completionSkipRace = await runRace(
    'completion versus skip',
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "waypoints" SET "reached_at" = NOW() WHERE "id" = 'skip-race-waypoint' AND "reached_at" IS NULL AND "skipped_at" IS NULL AND "cancelled_at" IS NULL`
        );
        expect(count === 1, 'completion lost its guard');
        await pause();
      }),
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "waypoints" SET "skipped_at" = NOW() WHERE "id" = 'skip-race-waypoint' AND "reached_at" IS NULL AND "skipped_at" IS NULL AND "cancelled_at" IS NULL`
        );
        expect(count === 1, 'skip lost its guard');
        await pause();
      })
  );
  expect(completionSkipRace.successes === 1, 'completion versus skip did not have one winner');

  await insertCourse('burn-complete-race', 'ACTIVE', 'burn-complete-user');
  await insertWaypoint(
    'burn-complete-waypoint',
    'burn-complete-race',
    100,
    'verification waypoint',
    'burn-complete-user'
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "courses" SET "current_waypoint_id" = 'burn-complete-waypoint' WHERE "id" = 'burn-complete-race'`
  );
  await insertAnchor('burn-complete-anchor', 'burn-complete-user');
  await linkAnchor(
    'burn-complete-link',
    'burn-complete-race',
    'burn-complete-waypoint',
    'burn-complete-anchor',
    'WAYPOINT_PRIMARY',
    'burn-complete-user'
  );
  const burnCompletionRace = await runRace(
    'completion versus burn',
    () =>
      runSerializable(async tx => {
        const count = await tx.$executeRawUnsafe(
          `UPDATE "waypoints" SET "reached_at" = NOW() WHERE "id" = 'burn-complete-waypoint' AND "reached_at" IS NULL AND "skipped_at" IS NULL AND "cancelled_at" IS NULL`
        );
        expect(count === 1, 'completion lost its guard');
        await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "status" = 'COMPLETED', "current_waypoint_id" = NULL, "version" = "version" + 1 WHERE "id" = 'burn-complete-race' AND "version" = 1`
        );
        await pause();
      }),
    () =>
      runSerializable(async tx => {
        await tx.$executeRawUnsafe(
          `UPDATE "course_anchor_links" SET "unlinked_at" = NOW(), "anchor_snapshot" = jsonb_set("anchor_snapshot", '{releasedAtUnlink}', 'true'::jsonb) WHERE "id" = 'burn-complete-link' AND "unlinked_at" IS NULL`
        );
        await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "version" = "version" + 1 WHERE "id" = 'burn-complete-race' AND "version" = 1`
        );
        await tx.$executeRawUnsafe(`DELETE FROM "anchors" WHERE "id" = 'burn-complete-anchor'`);
        await pause();
      })
  );
  expect(
    burnCompletionRace.successes === 1,
    'completion versus burn did not serialize to one winner'
  );

  await insertCourse('replace-burn-race', 'ACTIVE', 'replace-burn-user');
  await insertWaypoint(
    'replace-burn-waypoint',
    'replace-burn-race',
    100,
    'verification waypoint',
    'replace-burn-user'
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "courses" SET "current_waypoint_id" = 'replace-burn-waypoint' WHERE "id" = 'replace-burn-race'`
  );
  await insertAnchor('replace-old-anchor', 'replace-burn-user');
  await insertAnchor('replace-new-anchor', 'replace-burn-user');
  await linkAnchor(
    'replace-old-link',
    'replace-burn-race',
    'replace-burn-waypoint',
    'replace-old-anchor',
    'WAYPOINT_PRIMARY',
    'replace-burn-user'
  );
  const replacementBurnRace = await runRace(
    'Anchor replacement versus burn',
    () =>
      runSerializable(async tx => {
        await tx.$executeRawUnsafe(
          `UPDATE "course_anchor_links" SET "unlinked_at" = NOW() WHERE "id" = 'replace-old-link' AND "unlinked_at" IS NULL`
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "course_anchor_links" ("id", "user_id", "course_id", "waypoint_id", "anchor_id", "role", "anchor_snapshot", "linked_at", "created_at", "updated_at") VALUES ('replace-new-link', ${literal(USER_ID)}, 'replace-burn-race', 'replace-burn-waypoint', 'replace-new-anchor', 'WAYPOINT_PRIMARY', '{}'::jsonb, NOW(), NOW(), NOW())`
        );
        await tx.$executeRawUnsafe(
          `UPDATE "courses" SET "version" = "version" + 1 WHERE "id" = 'replace-burn-race' AND "version" = 1`
        );
        await pause();
      }),
    () =>
      runSerializable(async tx => {
        await tx.$executeRawUnsafe(
          `UPDATE "course_anchor_links" SET "unlinked_at" = NOW(), "anchor_snapshot" = jsonb_set("anchor_snapshot", '{releasedAtUnlink}', 'true'::jsonb) WHERE "anchor_id" = 'replace-old-anchor' AND "unlinked_at" IS NULL`
        );
        await tx.$executeRawUnsafe(`DELETE FROM "anchors" WHERE "id" = 'replace-old-anchor'`);
        await pause();
      })
  );
  expect(
    replacementBurnRace.successes === 1,
    'replacement versus burn did not serialize to one winner'
  );

  await insertCourse('burn-contract', 'ACTIVE', 'burn-contract-user');
  await insertWaypoint(
    'burn-contract-waypoint',
    'burn-contract',
    100,
    'verification waypoint',
    'burn-contract-user'
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "courses" SET "current_waypoint_id" = 'burn-contract-waypoint' WHERE "id" = 'burn-contract'`
  );
  await insertAnchor('burn-contract-anchor', 'burn-contract-user');
  await linkAnchor(
    'burn-contract-link',
    'burn-contract',
    'burn-contract-waypoint',
    'burn-contract-anchor',
    'WAYPOINT_PRIMARY',
    'burn-contract-user'
  );
  await prisma.$executeRawUnsafe(`
    INSERT INTO "practice_sessions" ("id", "userId", "anchorId", "practice_mode", "planned_duration_seconds", "completed_duration_seconds", "completion_status", "started_at", "completed_at", "local_date_key", "time_zone", "utc_offset_minutes_at_completion", "completion_source", "schema_version", "guidance_voice", "background_audio", "updated_at")
    VALUES ('burn-contract-practice', ${literal(USER_ID)}, 'burn-contract-anchor', 'focus', 60, 60, 'completed', ${literal(NOW)}, ${literal(NOW)}, '2026-08-02', 'UTC', 0, 'chart', 2, 'none', 'off', ${literal(NOW)})
  `);
  const practiceBeforeBurn = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "practice_sessions" WHERE "id" = 'burn-contract-practice'`
  )) as Array<{ count: number }>;
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`
      UPDATE "course_anchor_links" AS link
      SET "anchor_snapshot" = jsonb_build_object(
        'snapshotVersion', 1,
        'anchorId', anchor."id",
        'intentionText', anchor."intentionText",
        'category', anchor."category",
        'releasedAtUnlink', true
      ), "unlinked_at" = ${literal(NOW)}::timestamptz, "updated_at" = ${literal(NOW)}::timestamptz
      FROM "anchors" AS anchor
      WHERE link."anchor_id" = anchor."id" AND link."id" = 'burn-contract-link' AND link."unlinked_at" IS NULL
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "course_events" ("id", "user_id", "course_id", "waypoint_id", "event_type", "source_entity_type", "source_entity_id", "snapshot", "occurred_at", "idempotency_key")
      VALUES ('burn-contract-event', ${literal(USER_ID)}, 'burn-contract', 'burn-contract-waypoint', 'WAYPOINT_BLOCKED', 'Waypoint', 'burn-contract-waypoint', '{"reason":"ANCHOR_RELEASED"}'::jsonb, ${literal(NOW)}, 'burn-contract-event-key')
    `);
    await tx.$executeRawUnsafe(
      `UPDATE "courses" SET "version" = "version" + 1 WHERE "id" = 'burn-contract'`
    );
    await tx.$executeRawUnsafe(`
      INSERT INTO "burned_anchors" ("id", "originalAnchorId", "userId", "intentionText", "category", "distilledLetters", "activationCount", "activation_history", "charge_history", "createdAt", "burnedAt")
      SELECT "id", "id", "userId", "intentionText", "category", "distilledLetters", "activationCount", '[]'::jsonb, '[]'::jsonb, "createdAt", ${literal(NOW)}::timestamptz
      FROM "anchors" WHERE "id" = 'burn-contract-anchor'
    `);
    await tx.$executeRawUnsafe(`DELETE FROM "anchors" WHERE "id" = 'burn-contract-anchor'`);
  });
  const burnLink = (await prisma.$queryRawUnsafe(`
    SELECT "anchor_id", "unlinked_at", "anchor_snapshot" FROM "course_anchor_links" WHERE "id" = 'burn-contract-link'
  `)) as Array<{
    anchor_id: string | null;
    unlinked_at: Date | null;
    anchor_snapshot: { releasedAtUnlink?: boolean };
  }>;
  const burnState = (await prisma.$queryRawUnsafe(`
    SELECT course."status", course."current_waypoint_id", course."version", waypoint."reached_at", waypoint."skipped_at", waypoint."cancelled_at"
    FROM "courses" AS course JOIN "waypoints" AS waypoint ON waypoint."id" = course."current_waypoint_id"
    WHERE course."id" = 'burn-contract'
  `)) as Array<Record<string, unknown>>;
  const burnEvent = (await prisma.$queryRawUnsafe(`
    SELECT "event_type", "snapshot" FROM "course_events" WHERE "id" = 'burn-contract-event'
  `)) as Array<{ event_type: string; snapshot: { reason?: string } }>;
  const burnArchive = (await prisma.$queryRawUnsafe(`
    SELECT "originalAnchorId" FROM "burned_anchors" WHERE "id" = 'burn-contract-anchor'
  `)) as Array<{ originalAnchorId: string }>;
  const practiceAfterBurn = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "practice_sessions" WHERE "id" = 'burn-contract-practice'`
  )) as Array<{ count: number }>;
  expect(
    burnLink.length === 1 && burnLink[0].anchor_id === null && burnLink[0].unlinked_at !== null,
    'burn did not close and null the active Anchor link'
  );
  expect(
    burnLink[0].anchor_snapshot.releasedAtUnlink === true,
    'burn did not persist the released Anchor snapshot'
  );
  expect(
    burnState[0]?.status === 'ACTIVE' &&
      burnState[0]?.current_waypoint_id === 'burn-contract-waypoint' &&
      burnState[0]?.version === 2,
    'burn changed the Course pointer or failed to increment once'
  );
  expect(
    burnState[0]?.reached_at === null &&
      burnState[0]?.skipped_at === null &&
      burnState[0]?.cancelled_at === null,
    'burn advanced or terminalized the current waypoint'
  );
  expect(
    burnEvent[0]?.event_type === 'WAYPOINT_BLOCKED' &&
      burnEvent[0]?.snapshot.reason === 'ANCHOR_RELEASED',
    'burn did not record the blocking event'
  );
  expect(
    burnArchive[0]?.originalAnchorId === 'burn-contract-anchor',
    'BurnedAnchor archive is not canonical'
  );
  expect(
    practiceAfterBurn[0]?.count === practiceBeforeBurn[0]?.count,
    'burn deleted PracticeSession history'
  );

  const postPractice = (await prisma.$queryRawUnsafe(
    `SELECT "id", "course_id", "waypoint_id", "practice_entry_source" FROM "practice_sessions" WHERE "id" = 'verify-practice'`
  )) as Array<Record<string, unknown>>;
  expect(
    JSON.stringify(postPractice) === JSON.stringify(beforePractice),
    'existing PracticeSession changed during Chart verification'
  );
  const eventCount = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "course_events" WHERE "user_id" = ${literal(USER_ID)}`
  )) as Array<{ count: number }>;

  console.log(
    JSON.stringify({
      tables: tables.map(row => row.table_name),
      userChartSchemaColumn: userColumn.length === 1,
      practiceChartColumns: practiceColumns.map(row => row.column_name),
      requiredIndexes: indexes.map(row => row.indexname),
      reflectionChecks: reflectionChecks.map(row => row.constraint_name),
      courseEventEnumIncludesWaypointCancelled: true,
      oldPracticeSessionPreserved: true,
      chartPracticeContextPersisted: true,
      burnContract: {
        linkAnchorIdNull: true,
        releasedSnapshotPreserved: true,
        currentWaypointUnchanged: true,
        burnedAnchorArchived: true,
        practiceSessionPreserved: true,
      },
      eventRowsForVerifier: eventCount[0]?.count ?? 0,
      concurrency: [
        publishRace,
        completionRace,
        completionSkipRace,
        burnCompletionRace,
        replacementBurnRace,
      ],
    })
  );
}

main()
  .catch(error => {
    console.error(
      'CHART_DATABASE_VERIFY_FAILED',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
