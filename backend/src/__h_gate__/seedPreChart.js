/* Workstream H release-gate helper — TEST ONLY.
 *
 * Seeds pre-Chart Sanctuary/Practice rows so the Chart migration can be proven
 * non-destructive. Uses raw SQL because the generated Prisma Client already
 * knows about Chart columns that do not exist yet at this point. */
const { PrismaClient } = require('@prisma/client');

const USER_ID = 'h-user-1';
const ANCHOR_ID = 'h-anchor-1';
const SESSION_ID = 'h-session-pre-chart';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO users (id, email, "authProvider", "authUid", "createdAt", "updatedAt")
      VALUES ('${USER_ID}', 'h-gate@example.test', 'firebase', 'h-auth-uid-1', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO anchors (id, "userId", "intentionText", category, "createdAt", "updatedAt")
      VALUES ('${ANCHOR_ID}', '${USER_ID}', 'H canary anchor intention', 'GROWTH', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO practice_sessions (
        id, "userId", "anchorId", practice_mode, planned_duration_seconds,
        completed_duration_seconds, completion_status, started_at, completed_at,
        guidance_voice, background_audio, created_at, updated_at,
        local_date_key, time_zone, utc_offset_minutes_at_completion, completion_source
      ) VALUES (
        '${SESSION_ID}', '${USER_ID}', '${ANCHOR_ID}', 'focus', 300,
        300, 'completed', NOW(), NOW(),
        'none', 'none', NOW(), NOW(),
        '2026-08-04', 'UTC', 0, 'natural'
      ) ON CONFLICT (id) DO NOTHING
    `);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS sessions FROM practice_sessions WHERE id = '${SESSION_ID}'`
    );
    console.log('SEEDED', JSON.stringify(rows));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('SEED_ERROR:', error.message);
  process.exit(1);
});
