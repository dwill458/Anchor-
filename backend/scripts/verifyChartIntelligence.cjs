// Live provider smoke test. Run from backend with an explicitly configured disposable localhost DB; invokes paid model calls.
const fs = require('fs');
const { prisma } = require('../src/lib/prisma');
const { ChartPlannerService } = require('../src/services/chart/ChartPlannerService');
(async () => {
  const dbUrl = new URL(process.env.DATABASE_URL || '');
  if (dbUrl.hostname !== '127.0.0.1' || dbUrl.port !== '55439') throw new Error('Disposable localhost database on port 55439 required');
  const run = `chart-live-${Date.now()}`;
  const user = await prisma.user.create({data:{email:`${run}@test.anchor.invalid`,authProvider:'email',authUid:run}});
  const report = {fixture: true, startingPoint:'Limited resources, no investments, little spare money; I can spend 15 minutes today reviewing my accounts. No current net worth number is known.',destination:'Reach $111,000 net worth',results:[]};
  try {
    const anchor = await prisma.anchor.create({data:{userId:user.id,intentionText:report.destination,category:'wealth'}});
    const service = new ChartPlannerService();
    const first = await service.generate(user.id,{anchorId:anchor.id,idempotencyKey:run,actualStartingPoint:report.startingPoint,destinationDescription:report.destination});
    report.results.push(first);
    if (first.status === 'proposal' && first.proposal.generation.source === 'ai') {
      report.results.push(await service.adjust(user.id,{anchorId:anchor.id,idempotencyKey:run+'-smaller',actualStartingPoint:report.startingPoint,reason:'SMALLER_STEPS',detail:'The first milestone still feels too big. Give me an easier start I can complete today.',draft:{destination:first.proposal.destination,waypoints:first.proposal.waypoints}}));
    }
  } catch (error) { report.error={code:error.code??'unknown',message:error.message}; }
  finally {
    fs.writeFileSync(require('path').resolve(__dirname, '../../docs/verification/chart-intelligence-live-ai.json'),JSON.stringify(report,null,2));
    await prisma.user.delete({where:{id:user.id}}); await prisma.$disconnect();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
