import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient instance — reuse across all routes to avoid
// connection pool exhaustion from multiple instantiations.
//
// Connection pool size is controlled via the DATABASE_URL query param:
//   ?connection_limit=20&pool_timeout=20
// See .env.example for the recommended format.
export const prisma = new PrismaClient();
