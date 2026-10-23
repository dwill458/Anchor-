/** Opt-in, disposable Postgres only. Every DDL/data change rolls back, including on success. */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const url = process.env.VISION_INTEGRATION_DATABASE_URL;
const migration = readFileSync(
  path.resolve(
    __dirname,
    '../../../../prisma/migrations/20261022120000_vision_board_layout/migration.sql'
  ),
  'utf8'
);
const run = url ? describe : describe.skip;

run('Vision 2.1 additive migration on legacy Postgres rows', () => {
  it('defaults legacy boards to Classic and preserves normalized content', async () => {
    // Never fall back to DATABASE_URL: that may identify the real application database.
    const client = new PrismaClient({ datasources: { db: { url: url! } } });
    const schema = `vision21_migration_${randomUUID().replace(/-/g, '')}`;
    const rollback = new Error('Intentional test rollback');
    try {
      await expect(
        client.$transaction(
          async tx => {
            await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
            await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
            await tx.$executeRawUnsafe(
              'CREATE TABLE visions (id TEXT PRIMARY KEY, anchor_id TEXT, description TEXT)'
            );
            await tx.$executeRawUnsafe(
              'CREATE TABLE vision_notes (id TEXT PRIMARY KEY, vision_id TEXT, text TEXT, x DOUBLE PRECISION, y DOUBLE PRECISION)'
            );
            await tx.$executeRawUnsafe(
              'CREATE TABLE vision_scenes (id TEXT PRIMARY KEY, vision_id TEXT, slot_index INTEGER, caption TEXT, focal_x DOUBLE PRECISION, focal_y DOUBLE PRECISION)'
            );
            await tx.$executeRaw`INSERT INTO visions VALUES ('v', 'actual-anchor', 'My original intention')`;
            await tx.$executeRaw`INSERT INTO vision_notes VALUES ('n', 'v', 'Keep my words', .25, .7)`;
            await tx.$executeRaw`INSERT INTO vision_scenes VALUES ('s', 'v', 6, 'Original caption', .3, .8)`;
            for (const statement of migration.split(';').filter(sql => sql.trim()))
              await tx.$executeRawUnsafe(statement);
            expect(await tx.$queryRaw`SELECT * FROM visions`).toEqual([
              {
                id: 'v',
                anchor_id: 'actual-anchor',
                description: 'My original intention',
                board_layout: 'CLASSIC',
              },
            ]);
            expect(await tx.$queryRaw`SELECT * FROM vision_notes`).toEqual([
              {
                id: 'n',
                vision_id: 'v',
                text: 'Keep my words',
                x: 0.25,
                y: 0.7,
                layout_positions: null,
              },
            ]);
            expect(await tx.$queryRaw`SELECT * FROM vision_scenes`).toEqual([
              {
                id: 's',
                vision_id: 'v',
                slot_index: 6,
                caption: 'Original caption',
                focal_x: 0.3,
                focal_y: 0.8,
              },
            ]);
            for (const layout of ['EDITORIAL', 'SCRAPBOOK', 'CLASSIC']) {
              await tx.$executeRaw`UPDATE visions SET board_layout = ${layout}::"VisionBoardLayout" WHERE id = 'v'`;
              expect(await tx.$queryRaw`SELECT board_layout FROM visions`).toEqual([
                { board_layout: layout },
              ]);
            }
            await tx.$executeRawUnsafe('SAVEPOINT invalid_layout');
            await expect(
              tx.$executeRawUnsafe("UPDATE visions SET board_layout = 'GRID'")
            ).rejects.toThrow();
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_layout');
            throw rollback;
          },
          { timeout: 15000 }
        )
      ).rejects.toBe(rollback);
    } finally {
      await client.$disconnect();
    }
  });
});
