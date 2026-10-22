/**
 * Local development seed: the developer-master user with one Anchor and an active Chart, so Ask Chart can be tried on
 * a device against a local database. Idempotent. Never run against a shared or production database.
 *
 *   DATABASE_URL=postgresql://…@127.0.0.1:…/anchor_dev npx ts-node --transpile-only scripts/seed-dev-ask-chart.ts
 */
import { PrismaClient } from '@prisma/client';
import { chartService } from '../src/services/chart/ChartService';

const prisma = new PrismaClient();
const ANCHOR_ID = 'demo-v2-anchor';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing to seed a database that is not local.');

  const user = await prisma.user.upsert({
    where: { authUid: 'dev-master-account' },
    update: { chartSchemaVersion: 1 },
    create: {
      authUid: 'dev-master-account',
      email: 'dev+master@anchor.local',
      displayName: 'Developer Master',
      authProvider: 'dev',
      isComped: true,
      subscriptionStatus: 'pro',
      hasCompletedOnboarding: true,
      chartSchemaVersion: 1,
    },
  });
  await prisma.anchor.upsert({
    where: { id: ANCHOR_ID },
    update: {},
    create: { id: ANCHOR_ID, userId: user.id, intentionText: 'Restore my 1987 Buick Regal', category: 'desire', distilledLetters: [] },
  });
  const existing = await prisma.course.findFirst({ where: { userId: user.id, anchorId: ANCHOR_ID, status: 'ACTIVE' } });
  if (existing) {
    console.log('Chart already seeded:', existing.id);
    return;
  }
  const chart = await chartService.createChart(user.id, {
    anchorId: ANCHOR_ID,
    idempotencyKey: 'dev-seed-ask-chart-1',
    destinationText: 'A fully restored 1987 Buick Regal',
    waypoints: [
      { title: 'Get it running', rationale: 'The engine has to start and idle.', kind: 'MILESTONE', completionCriteria: 'Starts and idles for ten minutes', suggestedMoves: [{ title: 'Replace the fuel pump', rationale: null }] },
      { title: 'Prepare the exterior', rationale: 'Bare, rust-free panels.', kind: 'MILESTONE', completionCriteria: 'Bare, rust-free panels ready for primer', suggestedMoves: [{ title: 'Strip the paint from the hood', rationale: null }] },
      { title: 'Paint and clearcoat', rationale: null, kind: 'MILESTONE', completionCriteria: 'Even paint with clearcoat', suggestedMoves: [] },
      { title: 'Wheels and final details', rationale: null, kind: 'MILESTONE', completionCriteria: 'New wheels fitted, trim reinstalled', suggestedMoves: [] },
    ],
    oneMove: { title: 'Strip the paint from the hood', rationale: 'The biggest visible step.' },
  } as never);
  console.log('Seeded chart:', (chart as { id: string }).id);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
