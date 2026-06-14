import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  });
  console.log('Total users in database:', users.length);
  for (const u of users) {
    console.log(`ID: ${u.id} | Email: ${u.email} | CreatedAt: ${u.createdAt.toISOString()} | isComped: ${u.isComped} | subscriptionStatus: ${u.subscriptionStatus}`);
  }
}

main()
  .catch((e) => {
    console.error('Error running script:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
