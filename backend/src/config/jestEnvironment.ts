/**
 * Deterministic environment for ordinary Jest runs.
 *
 * Unit and mocked integration tests must not inherit a developer's .env or
 * contact a personal database. Production and development startup continue to
 * use the normal env validation path; this file is loaded only by Jest.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://anchor_test:anchor_test@127.0.0.1:1/anchor_test?connection_limit=1';

// Real PostgreSQL tests opt in explicitly with CHART_PG_DATABASE_URL. Keeping
// this unset makes an ordinary test run deterministic and database-free.
delete process.env.CHART_PG_DATABASE_URL;
