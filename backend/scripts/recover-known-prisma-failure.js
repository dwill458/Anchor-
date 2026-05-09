const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const TARGET_MIGRATIONS = [
  '20260506010000_add_user_data_cleanup_foreign_keys',
  '20260508000000_diagnose_and_fix_orphaned_rows',
];
const prisma = new PrismaClient();

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

async function loadMigrationState(migrationName) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE migration_name = $1
        ORDER BY started_at DESC
        LIMIT 1
      `,
      migrationName
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

function resolveFailedMigration(migrationName) {
  execFileSync(
    getNpxCommand(),
    ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', 'prisma/schema.prisma'],
    { stdio: 'inherit' }
  );
}

async function main() {
  for (const migrationName of TARGET_MIGRATIONS) {
    const migration = await loadMigrationState(migrationName);

    if (!migration) {
      console.log(`[prisma-recover] No ${migrationName} migration record found. Skipping recovery.`);
      continue;
    }

    if (migration.finished_at || migration.rolled_back_at) {
      console.log(`[prisma-recover] ${migrationName} is already resolved. Skipping recovery.`);
      continue;
    }

    console.log(`[prisma-recover] Found failed ${migrationName}. Marking it rolled back so deploy can continue.`);
    resolveFailedMigration(migrationName);
  }
}

main()
  .catch(error => {
    console.error('[prisma-recover] Recovery failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
