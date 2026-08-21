/**
 * Deterministic environment for ordinary Jest runs.
 *
 * Unit and mocked integration tests must not inherit a developer's .env or
 * contact a personal database. Production and development startup continue to
 * use the normal env validation path; this file is loaded only by Jest.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://anchor_test:anchor_test@127.0.0.1:1/anchor_test?connection_limit=1';

// Real PostgreSQL tests opt in explicitly with CHART_PG_DATABASE_URL. Do not
// synthesize a value for ordinary runs, but preserve an explicitly supplied
// URL so the documented `src/__pg__` command can actually enable that suite.
