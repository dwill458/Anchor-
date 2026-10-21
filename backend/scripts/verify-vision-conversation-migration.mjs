// Disposable PostgreSQL/WASM verification. Never reads DATABASE_URL or production data.
// Usage: node scripts/verify-vision-conversation-migration.mjs <baseline.sql> <harness-module-root>
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const [baselinePath, moduleRoot] = process.argv.slice(2);
if (!baselinePath || !moduleRoot) throw new Error('Supply generated baseline SQL and an isolated PGlite module directory.');
const requireHarness = createRequire(resolve(moduleRoot, 'package.json'));
const { PGlite } = requireHarness('@electric-sql/pglite');
const db = await PGlite.create();
const quote = value => `"${value.replaceAll('"', '""')}"`;
const passed = [];
const test = async (name, run) => { await run(); passed.push(name); };
async function insert(table, input) {
  const columns = (await db.query('SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name=$1 AND is_nullable=\'NO\' AND column_default IS NULL', [table])).rows;
  const values = { ...input };
  for (const column of columns) {
    if (values[column.column_name] !== undefined) continue;
    if (column.data_type === 'USER-DEFINED') {
      values[column.column_name] = (await db.query('SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1', [column.udt_name])).rows[0].enumlabel;
    } else values[column.column_name] = column.data_type.includes('timestamp') ? new Date().toISOString() : column.data_type === 'integer' || column.data_type === 'double precision' ? 0 : `${table}.${column.column_name}`;
  }
  const keys = Object.keys(values);
  await db.query(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(values));
}
async function rejected(sql, params, code) {
  await assert.rejects(() => db.query(sql, params), error => error.code === code);
}
try {
  await db.exec(await readFile(resolve(baselinePath), 'utf8'));
  await insert('users', { id: 'qa-owner', email: 'vision-migration@example.invalid', authUid: 'qa-owner' });
  await insert('anchors', { id: 'qa-anchor', userId: 'qa-owner', intentionText: 'Create freely', category: 'creativity' });
  await insert('visions', { id: 'qa-vision', user_id: 'qa-owner', anchor_id: 'qa-anchor' });
  for (let i = 0; i < 8; i++) await insert('assets', { id: `asset-${i}`, user_id: 'qa-owner', storage_key: `private/qa/${i}.jpg`, mime_type: 'image/jpeg' });
  const generation = { user_id: 'qa-owner', anchor_id: 'qa-anchor', vision_id: 'qa-vision', description: 'A real scene', kind: 'SCENE' };
  await insert('vision_generations', { ...generation, id: 'legacy-job', set_number: 1 });
  await insert('vision_generation_candidates', { id: 'legacy-candidate', generation_id: 'legacy-job', asset_id: 'asset-0', role: 'original', prompt: 'Legacy moment', sort_order: 0, status: 'SUCCEEDED' });
  await db.exec(await readFile(new URL('../prisma/migrations/20261020220000_vision_conversation/migration.sql', import.meta.url), 'utf8'));
  await test('legacy rows survive with safe defaults', async () => {
    const row = (await db.query('SELECT operation,session_id FROM vision_generations WHERE id=$1', ['legacy-job'])).rows[0];
    assert.deepEqual(row, { operation: 'CREATE', session_id: null });
    assert.equal((await db.query('SELECT asset_id FROM vision_generation_candidates WHERE id=$1', ['legacy-candidate'])).rows[0].asset_id, 'asset-0');
  });
  await insert('vision_creation_sessions', { id: 'session', user_id: 'qa-owner', anchor_id: 'qa-anchor', vision_id: 'qa-vision', description: 'Independent scene', expires_at: new Date(Date.now() + 86400000).toISOString() });
  await insert('vision_generations', { ...generation, id: 'original-round', session_id: 'session', round_number: 0, set_number: 2 });
  for (let i = 0; i < 2; i++) await insert('vision_generation_candidates', { id: `original-option-${i + 1}`, generation_id: 'original-round', asset_id: `asset-${i + 1}`, role: 'option', prompt: 'Original', sort_order: i, status: 'SUCCEEDED' });
  await test('five ordered references persist independently of the source', async () => {
    for (let i = 0; i < 5; i++) await insert('vision_generation_references', { id: `ref-${i}`, generation_id: 'original-round', asset_id: `asset-${i}`, role: ['identity', 'place', 'object', 'inspiration', 'place'][i], sort_order: i });
    assert.deepEqual((await db.query('SELECT role FROM vision_generation_references ORDER BY sort_order')).rows.map(row => row.role), ['identity', 'place', 'object', 'inspiration', 'place']);
  });
  await test('database rejects a sixth slot, duplicate asset, and invalid role', async () => {
    await rejected('INSERT INTO vision_generation_references(id,generation_id,asset_id,role,sort_order) VALUES($1,$2,$3,$4,$5)', ['ref-6', 'original-round', 'asset-7', 'object', 5], '23514');
    await rejected('INSERT INTO vision_generation_references(id,generation_id,asset_id,role,sort_order) VALUES($1,$2,$3,$4,$5)', ['duplicate', 'original-round', 'asset-0', 'place', 0], '23505');
    await rejected('INSERT INTO vision_generation_references(id,generation_id,asset_id,role,sort_order) VALUES($1,$2,$3,$4,$5)', ['bad-role', 'original-round', 'asset-7', 'admin', 4], '23514');
  });
  await insert('vision_generations', { ...generation, id: 'edit-round', session_id: 'session', round_number: 1, set_number: 3, operation: 'EDIT', parent_candidate_id: 'original-option-2' });
  await insert('vision_generation_candidates', { id: 'new-option', generation_id: 'edit-round', asset_id: 'asset-6', role: 'option', prompt: 'Sunset', sort_order: 0, status: 'SUCCEEDED' });
  await test('exact older source lineage and round uniqueness are enforced', async () => {
    assert.equal((await db.query('SELECT parent_candidate_id FROM vision_generations WHERE id=$1', ['edit-round'])).rows[0].parent_candidate_id, 'original-option-2');
    await assert.rejects(() => insert('vision_generations', { ...generation, id: 'duplicate-round', session_id: 'session', round_number: 1, set_number: 4 }), error => error.code === '23505');
    await assert.rejects(() => insert('vision_generations', { ...generation, id: 'missing-source', session_id: 'session', round_number: 2, set_number: 4, operation: 'EDIT' }), error => error.code === '23514');
    await assert.rejects(() => insert('vision_generations', { ...generation, id: 'missing-round', session_id: 'session', round_number: null, set_number: 4 }), error => error.code === '23514');
  });
  await test('navigation and choosing an older option preserve newer candidates', async () => {
    await db.query('UPDATE vision_creation_sessions SET selected_candidate_id=$1,viewed_round_id=$2 WHERE id=$3', ['original-option-2', 'original-round', 'session']);
    assert.equal((await db.query('SELECT parent_candidate_id FROM vision_generations WHERE id=$1', ['edit-round'])).rows[0].parent_candidate_id, 'original-option-2');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM vision_generation_candidates WHERE generation_id=$1', ['edit-round'])).rows[0].n, 1);
  });
  await test('source assets and candidates cannot be pruned while referenced', async () => {
    await rejected('DELETE FROM assets WHERE id=$1', ['asset-1'], '23001');
    await rejected('DELETE FROM vision_generation_candidates WHERE id=$1', ['original-option-2'], '23001');
  });
  await test('account deletion still cascades through complete revision history', async () => {
    await db.query('DELETE FROM users WHERE id=$1', ['qa-owner']);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM vision_creation_sessions')).rows[0].n, 0);
  });
  console.log(JSON.stringify({ engine: 'PGlite PostgreSQL WASM (disposable memory database)', passed: passed.length, checks: passed }, null, 2));
} finally { await db.close(); }
