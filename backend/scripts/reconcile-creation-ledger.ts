/**
 * Pre-ledger creation reconciliation CLI.
 *
 *   Dry-run (default, read-only, REPEATABLE READ):
 *     npx ts-node scripts/reconcile-creation-ledger.ts --cutover-at=2026-11-01T00:00:00Z
 *   Apply (writes; requires explicit database confirmation):
 *     npx ts-node scripts/reconcile-creation-ledger.ts --apply --cutover-at=<ISO> \
 *       --confirm-database=<exact database name from DATABASE_URL> [--after-id=<uuid>] [--limit=N]
 *
 * Applying to production requires separate written authorization. See
 * docs/release/anchor-2-historical-reconciliation.md.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { runReconciliation } from '../src/services/CreationLedgerReconciliationService';

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const dbName = new URL(url.replace(/^postgres(ql)?:/, 'http:')).pathname.replace(/^\//, '');
  const cutoverRaw = arg('cutover-at');
  if (!cutoverRaw) throw new Error('--cutover-at=<ISO instant> is required (first ledger-enforcing deploy)');
  const cutover = new Date(cutoverRaw);
  if (Number.isNaN(cutover.getTime())) throw new Error('--cutover-at is not a valid instant');
  if (apply && arg('confirm-database') !== dbName) {
    throw new Error(`--apply requires --confirm-database=${dbName}`);
  }
  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  const db = new PrismaClient();
  try {
    console.error(`[reconcile] mode=${apply ? 'APPLY' : 'dry-run'} database=${dbName}`);
    const report = await runReconciliation(db, {
      apply,
      runId: arg('run-id') ?? randomUUID(),
      cutover: { at: cutover },
      afterId: arg('after-id'),
      limit,
      onProgress: r => console.error(`[reconcile] scanned=${r.accountsScanned} last=${r.lastUserId}`),
    });
    // Aggregate counts only: no emails, no user ids other than the resume cursor.
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error('[reconcile] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
