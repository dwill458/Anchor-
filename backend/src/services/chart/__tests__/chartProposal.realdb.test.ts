const raw = process.env.CHART_PROPOSAL_TEST_URL;
const target = raw ? new URL(raw) : null;
if (target && !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Refusing non-local database');
const suite = target ? describe : describe.skip;
suite('proposal batches on disposable PostgreSQL', () => {
  let prisma: any, chartService: any, ask: any, userId: string;
  let counter = 0;
  beforeAll(async () => {
    process.env.DATABASE_URL = raw;
    prisma = require('../../../lib/prisma').prisma;
    chartService = require('../ChartService').chartService;
    ask = require('../ask/AskChartService').askChartService;
    userId = (await prisma.user.create({ data: { email: `proposal-it-${Date.now()}@test.anchor.invalid`, authProvider: 'email', authUid: `proposal-it-${Date.now()}` } })).id;
  });
  afterAll(async () => { if (prisma) { await prisma.user.deleteMany({ where: { id: userId } }); await prisma.$disconnect(); } });
  async function fixture() {
    const n = ++counter;
    const anchor = await prisma.anchor.create({ data: { userId, intentionText: `Proposal test ${n}`, category: 'career' } });
    const chart = await chartService.createChart(userId, { anchorId: anchor.id, idempotencyKey: `it-create-${userId}-${n}`, destinationText: 'Test destination', waypoints: [{ title: 'Current waypoint' }], oneMove: { title: 'Existing move' } });
    const conversation = await prisma.chartConversation.create({ data: { userId, anchorId: anchor.id, courseId: chart.id, mode: 'ONGOING' } });
    const message = await prisma.chartMessage.create({ data: { userId, conversationId: conversation.id, role: 'ASSISTANT', text: 'Plan', structured: { action: { type: 'ADD_MOVES', status: 'PENDING', waypointId: chart.currentWaypointId, moves: [{title:'First',detail:'one'},{title:'Second',detail:'two'},{title:'Third',detail:'three'}] } } } });
    return { chart, message };
  }
  it('applies ordered moves under one batch and double apply is a no-op', async () => {
    const { chart, message } = await fixture();
    const first = await ask.approveMoves(userId, chart.id, message.id);
    const moves = await prisma.move.findMany({ where: { courseId: chart.id }, orderBy: { position: 'asc' } });
    expect(moves.map((m: any) => m.title)).toEqual(['First','Second','Third','Existing move']);
    expect(moves.slice(0,3).map((m: any) => m.batchId)).toEqual([message.id,message.id,message.id]);
    expect(first.chart.currentMoveId).toBe(moves[0].id);
    await ask.approveMoves(userId, chart.id, message.id);
    expect(await prisma.move.count({ where: { batchId: message.id } })).toBe(3);
  });
  it('rolls back all inserts and status when the second insert fails', async () => {
    const { chart, message } = await fixture();
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION proposal_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.batch_id = '${message.id}' AND NEW.title = 'Second' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER proposal_test_fail_trigger BEFORE INSERT ON moves FOR EACH ROW EXECUTE FUNCTION proposal_test_fail()');
    try {
      await expect(ask.approveMoves(userId, chart.id, message.id)).rejects.toThrow();
      expect(await prisma.move.count({ where: { batchId: message.id } })).toBe(0);
      const saved = await prisma.chartMessage.findUnique({ where: { id: message.id } });
      expect(saved.structured.action.status).toBe('PENDING');
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS proposal_test_fail_trigger ON moves');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS proposal_test_fail()');
    }
  });
  it('serializes concurrent apply and dismiss with one winner and a typed conflict', async () => {
    const { chart, message } = await fixture();
    const results = await Promise.allSettled([ask.approveMoves(userId, chart.id, message.id), ask.dismiss(userId, chart.id, message.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'SYNC_CONFLICT' });
    const saved = await prisma.chartMessage.findUnique({ where: { id: message.id } });
    expect(await prisma.move.count({ where: { batchId: message.id } })).toBe(saved.structured.action.status === 'APPLIED' ? 3 : 0);
  });
  it('undo removes incomplete batch moves but preserves completed moves', async () => {
    const { chart, message } = await fixture();
    await ask.approveMoves(userId, chart.id, message.id);
    const moves = await prisma.move.findMany({ where: { batchId: message.id }, orderBy: { position: 'asc' } });
    await prisma.move.update({ where: { id: moves[0].id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await ask.undoProposal(userId, chart.id, message.id);
    const remaining = await prisma.move.findMany({ where: { courseId: chart.id }, orderBy: { position: 'asc' } });
    expect(remaining.map((m: any) => m.title)).toEqual(['First','Existing move']);
    expect(remaining[0].status).toBe('COMPLETED');
  });
  it('additive migration preserves populated legacy rows with null batch id', async () => {
    const fs = require('fs'); const path = require('path');
    const sql = fs.readFileSync(path.resolve(__dirname, '../../../../prisma/migrations/20261026120000_move_proposal_batch/migration.sql'), 'utf8');
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE moves (id TEXT PRIMARY KEY, title TEXT NOT NULL) ON COMMIT DROP');
      await tx.$executeRawUnsafe("INSERT INTO moves (id,title) VALUES ('legacy-1','Existing move')");
      for (const statement of sql.split(';').map((s: string) => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      expect(await tx.$queryRawUnsafe('SELECT id,title,batch_id FROM moves')).toEqual([{ id: 'legacy-1', title: 'Existing move', batch_id: null }]);
    });
  });
});
