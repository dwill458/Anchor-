import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { purgeExpiredVisionConversations } from '../services/v2/VisionConversationRetentionService';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter(arg => arg !== '--apply');
  if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(', ')}`);
  const result = await purgeExpiredVisionConversations({ apply: args.includes('--apply') });
  console.log(JSON.stringify({ job: 'vision-conversation-retention', ...result }));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
