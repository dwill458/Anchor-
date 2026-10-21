import { prisma } from '../lib/prisma';
import { purgeExpiredChartData } from '../services/ChartCleanupService';
import { purgeExpiredAskPhotos } from '../services/chart/ask/askChartPhotos';

async function main(): Promise<void> {
  const result = await purgeExpiredChartData();
  const askPhotosDeleted = await purgeExpiredAskPhotos();
  console.log(JSON.stringify({ job: 'chart-purge', ...result, askPhotosDeleted }));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
