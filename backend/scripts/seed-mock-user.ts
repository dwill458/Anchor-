import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst({
    where: { authUid: 'mock-uid-123' },
  });

  if (existing) {
    console.log('Mock user already exists:', existing.id, existing.email);
  } else {
    const created = await prisma.user.create({
      data: {
        authUid: 'mock-uid-123',
        email: 'guest@example.com',
        displayName: 'Guest User',
        authProvider: 'mock',
        subscriptionStatus: 'free',
      },
    });
    console.log('Created mock user:', created.id, created.email);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
