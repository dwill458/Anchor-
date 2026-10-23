/** Bounded production inspection. Railway variables arrive on stdin and are never printed. Every DB transaction is READ ONLY. */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const variables = JSON.parse(input);
  const url = variables.DATABASE_PUBLIC_URL;
  if (!url) throw new Error('Public database URL unavailable');
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const result = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const subject = await tx.aIPlanProposal.findFirst({ where: { destinationInterpretation: { contains: 'paying users', mode: 'insensitive' } }, orderBy: { createdAt: 'desc' }, select: { userId: true } });
      if (!subject) throw new Error('Relevant proposal unavailable');
      const proposals = await tx.aIPlanProposal.findMany({
        where: { userId: subject.userId },
        orderBy: { createdAt: 'desc' }, take: 12,
        select: { createdAt: true, modelVersion: true, plannerVersion: true, generationSource: true, fallbackReason: true, destinationInterpretation: true, complexity: true, routeScope: true, waypoints: true, courseId: true },
      });
      const courses = await tx.course.findMany({ where: { userId: subject.userId }, orderBy: { id: 'asc' }, include: { waypoints: { orderBy: { position: 'asc' } }, moves: { orderBy: { id: 'asc' } } } });
      return {
        proposals: proposals.map(p => ({ createdAt: p.createdAt, destination: p.destinationInterpretation, model: p.modelVersion, plannerVersion: p.plannerVersion, source: p.generationSource, fallbackReason: p.fallbackReason, complexity: p.complexity, routeScope: p.routeScope, proposalCount: Array.isArray(p.waypoints) ? p.waypoints.length : null, titles: Array.isArray(p.waypoints) ? p.waypoints.map(w => (w as { title?: string })?.title) : [], savedCourseCount: courses.find(c => c.id === p.courseId)?.waypoints.length ?? null })),
        existingCourseCount: courses.length,
        existingCourseHash: createHash('sha256').update(JSON.stringify(courses)).digest('hex'),
      };
    }, { timeout: 20_000 });
    const label = process.argv[2] === 'after' ? 'after' : 'before';
    const directory = resolve(__dirname, '../../tasks/chart-review-refinement');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, `existing-charts-${label}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(JSON.stringify({ error: error?.code ?? error?.name ?? 'inspection_failed' })); process.exitCode = 1; });
