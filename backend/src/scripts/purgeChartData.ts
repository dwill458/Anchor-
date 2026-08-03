import { prisma } from '../lib/prisma';
import { purgeExpiredChartData } from '../services/ChartCleanupService';

async function main(): Promise<void> {
  const result = await purgeExpiredChartData();
  console.log(JSON.stringify({ job: 'chart-purge', ...result }));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
