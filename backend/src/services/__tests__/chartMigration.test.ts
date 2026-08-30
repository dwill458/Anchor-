/**
 * Chart migration contract.
 *
 * Verified statically against the checked-in SQL rather than against a live
 * database: these are the structural guarantees the frozen contract depends on,
 * and they must hold in the file that actually ships. A behavioral migration run
 * needs a Postgres instance and belongs in CI integration, not here.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_DIR = join(
  __dirname,
  '../../../prisma/migrations/20260802000000_add_chart_backend_foundation',
);
const ROLLBACK_PATH = join(
  __dirname,
  '../../../prisma/migrations/ROLLBACK_20260802000000_add_chart_backend_foundation.sql',
);
const DEV_ROLLBACK_PATH = join(
  __dirname,
  '../../../prisma/migrations/DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql',
);

const migration = readFileSync(join(MIGRATION_DIR, 'migration.sql'), 'utf8');
const rollback = readFileSync(ROLLBACK_PATH, 'utf8');
const devRollback = readFileSync(DEV_ROLLBACK_PATH, 'utf8');
const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

const CHART_TABLES = [
  'courses',
  'waypoints',
  'course_anchor_links',
  'course_events',
  'reflections',
  'ai_plan_proposals',
];

const CHART_ENUMS = [
  'CourseStatus',
  'CourseAnchorRole',
  'CourseEventType',
  'ReflectionSource',
  'ReflectionPromptType',
  'ReflectionMood',
];

const FROZEN_EVENT_TYPES = [
  'COURSE_CREATED',
  'DESTINATION_CHANGED',
  'WAYPOINT_ADDED',
  'WAYPOINT_REORDERED',
  'DESTINATION_ANCHOR_LINKED',
  'WAYPOINT_ANCHOR_LINKED',
  'PRACTICE_COMPLETED',
  'REFLECTION_ADDED',
  'WAYPOINT_REACHED',
  'WAYPOINT_SKIPPED',
  'WAYPOINT_CANCELLED',
  'WAYPOINT_BLOCKED',
  'WAYPOINT_UNBLOCKED',
  'COURSE_COMPLETED',
  'COURSE_ARCHIVED',
  'COURSE_RESTORED',
];

describe('Chart migration — additive shape', () => {
  it('creates every Chart table', () => {
    for (const table of CHART_TABLES) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it('creates every Chart enum', () => {
    for (const enumName of CHART_ENUMS) {
      expect(migration).toContain(`CREATE TYPE "${enumName}"`);
    }
  });

  it('adds the Chart columns to existing tables without dropping anything', () => {
    expect(migration).toContain('ADD COLUMN "chart_schema_version" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('ADD COLUMN "course_id" TEXT');
    expect(migration).toContain('ADD COLUMN "waypoint_id" TEXT');
    expect(migration).toContain('ADD COLUMN "practice_entry_source" TEXT');
    // A Chart migration must never destroy pre-Chart data.
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/DROP\s+COLUMN/i);
  });

  it('defaults existing users to the uninitialized Chart schema version', () => {
    // 0 is what makes every pre-existing account read as migrationRequired
    // instead of silently getting write access.
    expect(migration).toMatch(/"chart_schema_version"\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0/);
  });
});

describe('Chart migration — frozen event taxonomy', () => {
  it('declares exactly the frozen CourseEventType values', () => {
    const match = migration.match(/CREATE TYPE "CourseEventType" AS ENUM \(([\s\S]*?)\);/);
    expect(match).not.toBeNull();
    const values = (match![1].match(/'([A-Z_]+)'/g) ?? []).map(value =>
      value.replace(/'/g, ''),
    );
    expect(values.sort()).toEqual([...FROZEN_EVENT_TYPES].sort());
  });

  it('includes the A1 amendment WAYPOINT_CANCELLED', () => {
    expect(migration).toContain("'WAYPOINT_CANCELLED'");
    expect(schema).toContain('WAYPOINT_CANCELLED');
  });
});

describe('Chart migration — invariants enforced in the database', () => {
  it('allows at most one live Course per user', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "courses_one_active_per_user"');
  });

  it('allows at most one Course pointing at a given waypoint', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "courses_current_waypoint_id_key"');
  });

  it('allows at most one active link per role and per waypoint', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "course_anchor_links_one_active_destination"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "course_anchor_links_one_active_waypoint_primary"',
    );
  });

  it('makes every idempotency key unique', () => {
    for (const index of [
      'courses_idempotency_key_key',
      'course_events_idempotency_key_key',
      'reflections_idempotency_key_key',
      'ai_plan_proposals_idempotency_key_key',
    ]) {
      expect(migration).toContain(`CREATE UNIQUE INDEX "${index}"`);
    }
  });

  it('keeps waypoint positions unique within a course', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "waypoints_course_id_position_key"');
  });
});

describe('Chart migration — deletion behavior matches the burn contract', () => {
  it('nulls the Course pointer rather than cascading a waypoint delete into the Course', () => {
    expect(migration).toMatch(
      /FOREIGN KEY \("current_waypoint_id"\) REFERENCES "waypoints"\("id"\) ON DELETE SET NULL/,
    );
  });

  it('nulls anchor_id on a hard Anchor delete so link history survives', () => {
    // Amendment A2: burn hard-deletes the Anchor after Chart links and snapshots
    // are closed; the link row and its anchorSnapshot must remain.
    expect(migration).toMatch(
      /FOREIGN KEY \("anchor_id"\) REFERENCES "anchors"\("id"\) ON DELETE SET NULL/,
    );
  });

  it('keeps practice history free of Chart foreign keys', () => {
    // Practice history must survive Course deletion, so course_id/waypoint_id on
    // practice_sessions are soft references by contract.
    const practiceBlock = migration.slice(
      migration.indexOf('ALTER TABLE "practice_sessions"'),
    );
    const chartFkOnPractice = /practice_sessions[\s\S]{0,400}FOREIGN KEY \("(course_id|waypoint_id)"\)/;
    expect(practiceBlock).not.toMatch(chartFkOnPractice);
    expect(schema).toContain('courseId            String? @map("course_id")');
  });

  it('indexes the Chart practice lookup', () => {
    expect(migration).toContain('practice_sessions_course_id_completed_at_idx');
  });
});

describe('Chart migration — rollback safety', () => {
  it('refuses a destructive production rollback', () => {
    expect(rollback).toMatch(/RAISE\s+EXCEPTION/i);
    expect(rollback).not.toMatch(/DROP\s+TABLE/i);
    expect(rollback).not.toMatch(/DROP\s+COLUMN/i);
    expect(rollback).not.toMatch(/DELETE\s+FROM/i);
  });

  it('keeps the destructive rollback explicitly disposable and guarded', () => {
    expect(devRollback).toMatch(/DISPOSABLE DEVELOPMENT DATABASES ONLY/i);
    expect(devRollback).toMatch(/NEVER RUN THIS IN PRODUCTION/i);
    expect(devRollback).toMatch(/RAISE\s+EXCEPTION/i);
    expect(devRollback).toContain("current_setting('anchor.chart_destructive_rollback', true)");
  });

  it('drops every table the disposable rollback migration created', () => {
    for (const table of CHART_TABLES) {
      expect(devRollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
  });

  it('drops every enum the disposable rollback migration created', () => {
    for (const enumName of CHART_ENUMS) {
      expect(devRollback).toContain(`DROP TYPE IF EXISTS "${enumName}"`);
    }
  });

  it('drops every column the disposable rollback migration added to existing tables', () => {
    expect(devRollback).toContain('DROP COLUMN IF EXISTS "course_id"');
    expect(devRollback).toContain('DROP COLUMN IF EXISTS "waypoint_id"');
    expect(devRollback).toContain('DROP COLUMN IF EXISTS "practice_entry_source"');
    expect(devRollback).toContain('DROP COLUMN IF EXISTS "chart_schema_version"');
  });

  it('drops the added index in the disposable rollback migration', () => {
    expect(devRollback).toContain(
      'DROP INDEX IF EXISTS "practice_sessions_course_id_completed_at_idx"',
    );
  });

  it('touches no unrelated tables', () => {
    // A rollback that dropped anchors/users/practice_sessions would destroy
    // pre-Chart production data.
    for (const table of ['anchors', 'users', 'practice_sessions', 'activations']) {
      expect(devRollback).not.toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
  });

  it('is idempotent so a disposable rollback can be re-run', () => {
    const destructive = devRollback
      .split('\n')
      .filter(line => /^\s*(DROP|ALTER TABLE .*DROP)/i.test(line));
    expect(destructive.length).toBeGreaterThan(0);
    for (const line of destructive) {
      expect(line).toMatch(/IF EXISTS/i);
    }
  });
});
