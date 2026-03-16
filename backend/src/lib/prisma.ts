import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient instance — reuse across all routes to avoid
// connection pool exhaustion from multiple instantiations.
export const prisma = new PrismaClient();
