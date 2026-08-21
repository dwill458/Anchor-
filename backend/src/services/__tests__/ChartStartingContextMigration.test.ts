/**
 * The starting-context migration is intentionally forward-only and nullable:
 * existing Courses/proposals must remain valid while new planner requests can
 * preserve the user's stated baseline.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const migration = readFileSync(
  join(
    __dirname,
    '../../../prisma/migrations/20260821000000_add_chart_starting_context/migration.sql'
  ),
  'utf8'
);
const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

describe('Chart starting-context migration', () => {
  it('adds one nullable, bounded column to proposals and Courses', () => {
    expect(migration).toMatch(
      /ALTER TABLE "ai_plan_proposals"\s+ADD COLUMN "starting_context" VARCHAR\(500\)/
    );
    expect(migration).toMatch(
      /ALTER TABLE "courses"\s+ADD COLUMN "starting_context" VARCHAR\(500\)/
    );
    expect(migration).not.toMatch(/NOT\s+NULL|DEFAULT|UPDATE|DROP/i);
  });

  it('maps both Prisma fields to the same database column shape', () => {
    const mappedFields = schema.match(
      /startingContext\s+String\?\s+@map\("starting_context"\)\s+@db\.VarChar\(500\)/g
    );
    expect(mappedFields).toHaveLength(2);
  });
});
