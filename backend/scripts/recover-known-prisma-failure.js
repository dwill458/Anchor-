const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const TARGET_MIGRATION = '20260506010000_add_user_data_cleanup_foreign_keys';
const prisma = new PrismaClient();

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

async function loadMigrationState() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE migration_name = $1
        ORDER BY started_at DESC
        LIMIT 1
      `,
      TARGET_MIGRATION
    );

    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('_prisma_migrations') &&
      (message.includes('does not exist') || message.includes('relation'))
    ) {
      return null;
    }

    throw error;
  }
}

function resolveFailedMigration() {
  execFileSync(
    getNpxCommand(),
    ['prisma', 'migrate', 'resolve', '--rolled-back', TARGET_MIGRATION, '--schema', 'prisma/schema.prisma'],
    { stdio: 'inherit' }
  );
}

async function main() {
  const migration = await loadMigrationState();

  if (!migration) {
    console.log(`[prisma-recover] No ${TARGET_MIGRATION} migration record found. Skipping recovery.`);
    return;
  }

  if (migration.finished_at || migration.rolled_back_at) {
    console.log(`[prisma-recover] ${TARGET_MIGRATION} is already resolved. Skipping recovery.`);
    return;
  }

  console.log(`[prisma-recover] Found failed ${TARGET_MIGRATION}. Marking it rolled back so deploy can continue.`);
  resolveFailedMigration();
}

main()
  .catch(error => {
    console.error('[prisma-recover] Recovery failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
