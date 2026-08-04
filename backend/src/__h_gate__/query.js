/* Workstream H release-gate helper — TEST ONLY. Runs a raw read against the
 * disposable verification database and prints JSON. Not shipped, not imported
 * by application code. */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const sql = process.argv.slice(2).join(' ');
  if (!sql) throw new Error('usage: node query.js "<SQL>"');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    console.log(
      JSON.stringify(rows, (_key, value) => (typeof value === 'bigint' ? Number(value) : value), 2)
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('QUERY_ERROR:', error.message);
  process.exit(1);
});
