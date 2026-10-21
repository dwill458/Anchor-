import { AppError } from '../../../../api/middleware/errorHandler';
import { ChartProviderError, type ChartModelProvider, type ChartModelRequest } from '../../chartModelProviders';
import type { AskContext } from '../askChartContext';

// ── in-memory stand-in for the four Ask Chart tables ────────────────────────────────────────────
type Row = Record<string, any>;
const db = { conversations: [] as Row[], messages: [] as Row[], memories: [] as Row[], assets: [] as Row[], proposals: [] as Row[], anchors: [] as Row[] };
let clock = 0;
let idCounter = 0;
const now = () => new Date(Date.UTC(2026, 9, 21, 12, 0, 0) + ++clock * 1000);

function matches(row: Row, where: Row | undefined, relations: Record<string, Row[] | undefined> = {}): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'conversation') {
      const conversation = db.conversations.find(item => item.id === row.conversationId);
      return Boolean(conversation) && matches(conversation!, expected);
    }
    const actual = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('gt' in expected) return actual > expected.gt;
      if ('lt' in expected) return actual < expected.lt;
      return true;
    }
    return actual === expected;
  });
}
const sortBy = (rows: Row[], orderBy: Row | undefined) => {
  if (!orderBy) return rows;
  const [[field, direction]] = Object.entries(orderBy);
  return [...rows].sort((a, b) => (a[field] < b[field] ? -1 : 1) * (direction === 'desc' ? -1 : 1));
};
const table = (rows: () => Row[], defaults: () => Row = () => ({})) => ({
  findUnique: jest.fn(async ({ where }: any) => rows().find(row => Object.entries(where).every(([k, v]) => row[k] === v)) ?? null),
  findFirst: jest.fn(async ({ where, orderBy }: any = {}) => sortBy(rows().filter(row => matches(row, where)), orderBy)[0] ?? null),
  findMany: jest.fn(async ({ where, orderBy, take }: any = {}) => sortBy(rows().filter(row => matches(row, where)), orderBy).slice(0, take ?? undefined)),
  create: jest.fn(async ({ data }: any) => {
    if (data.idempotencyKey && rows().some(row => row.idempotencyKey === data.idempotencyKey)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    const row = { id: `id-${++idCounter}`, createdAt: now(), lastMessageAt: now(), attachments: null, structured: null, meta: null, skill: null, ...defaults(), ...data };
    rows().push(row);
    return row;
  }),
  update: jest.fn(async ({ where, data }: any) => {
    const row = rows().find(item => item.id === where.id)!;
    Object.assign(row, data);
    return row;
  }),
});

const mockPrisma: any = {
  chartConversation: table(() => db.conversations),
  chartMessage: table(() => db.messages),
  asset: { findFirst: jest.fn(async ({ where }: any) => db.assets.find(a => a.id === where.id && a.userId === where.userId) ?? null) },
  aIPlanProposal: { findFirst: jest.fn(async ({ where }: any) => db.proposals.find(p => p.id === where.id && p.userId === where.userId && p.courseId === where.courseId) ?? null) },
  anchor: { findFirst: jest.fn(async ({ where }: any) => db.anchors.find(a => a.id === where.id && a.userId === where.userId) ?? null) },
  chartMemory: {
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const key = where.userId_anchorId_key;
      const existing = db.memories.find(m => m.userId === key.userId && m.anchorId === key.anchorId && m.key === key.key);
      if (existing) Object.assign(existing, update);
      else db.memories.push({ ...create });
      return existing ?? create;
    }),
  },
};
jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../../../config/chartFlags', () => ({ getChartFeatureFlags: () => ({ chart_ai_planner_enabled: true }) }));
jest.mock('../../../StorageService', () => ({ readPrivateImageAsset: jest.fn(async () => Buffer.from('img')) }));

const mockContext: { value: AskContext } = { value: null as unknown as AskContext };
jest.mock('../askChartContext', () => ({ loadAskContext: jest.fn(async () => mockContext.value) }));

const mockAddMove = jest.fn();
jest.mock('../../ChartService', () => ({ chartService: { addMove: (...args: unknown[]) => mockAddMove(...args) } }));
const mockAdjust = jest.fn();
jest.mock('../../ChartPlannerService', () => ({ chartPlannerService: { adjust: (...args: unknown[]) => mockAdjust(...args) } }));

import { AskChartService } from '../AskChartService';

const baseContext = (overrides: Partial<AskContext> = {}): AskContext => ({
  anchor: { id: 'anchor-1', intention: 'Restore my Buick Regal', category: 'desire' },
  vision: null,
  onboarding: null,
  practice: null,
  chart: {
    courseId: 'course-1',
    version: 4,
    destination: 'Restored Regal',
    currentWaypointId: 'wp-1',
    currentMoveId: null,
    waypoints: [
      { id: 'wp-0', title: 'Buy the car', state: 'REACHED', completionCriteria: null, metric: null, moves: [] },
      { id: 'wp-1', title: 'Prepare the exterior', state: 'CURRENT', completionCriteria: null, metric: null, moves: [{ id: 'mv-1', title: 'Strip paint', status: 'ACTIVE' }] },
    ],
    recentCompletedMoves: [],
  },
  memories: [],
  style: 'DRIVEN',
  ...overrides,
});

const answer = (extra: Record<string, unknown> = {}) => ({
  reply: 'Start with the rust.',
  suggestions: ['Mostly myself'],
  requestPhoto: null,
  readyToPlan: false,
  startingPoint: null,
  context: null,
  action: null,
  remember: null,
  ...extra,
});

function fakeProvider(name: 'openai' | 'gemini', behaviour: (request: ChartModelRequest) => unknown | Promise<unknown>): ChartModelProvider & { calls: ChartModelRequest[] } {
  const calls: ChartModelRequest[] = [];
  return {
    name,
    model: `${name}-model`,
    calls,
    generateJson: async request => {
      calls.push(request);
      return behaviour(request);
    },
    streamJson: async (request, onText) => {
      calls.push(request);
      const value = await behaviour(request);
      const text = JSON.stringify(value);
      onText(text.slice(0, 30));
      onText(text);
      return value;
    },
  };
}
const service = (...providers: ChartModelProvider[]) => new AskChartService(() => ({ providers, primaryTimeoutMs: 1000, fallbackTimeoutMs: 1000 }));
const input = (overrides: Record<string, unknown> = {}) => ({
  anchorId: 'anchor-1', idempotencyKey: `key-${Math.random()}`, text: 'It runs but needs work', attachments: [], skill: 'FREE' as const, ...overrides,
});

beforeEach(() => {
  Object.values(db).forEach(rows => (rows.length = 0));
  db.anchors.push({ id: 'anchor-1', userId: 'user-1' });
  mockContext.value = baseContext();
  mockAddMove.mockReset().mockImplementation(async () => ({ id: 'course-1', moved: true }));
  mockAdjust.mockReset();
  jest.clearAllMocks();
});

describe('AskChartService.turn', () => {
  it('sends the Chart context, the chosen coaching style and earlier turns to the model, and saves both messages', async () => {
    mockContext.value = baseContext({ style: 'DIRECT', memories: [{ key: 'availability', value: 'Weekends only' }] });
    const provider = fakeProvider('openai', () => answer());
    const ask = service(provider);

    await ask.turn('user-1', input({ idempotencyKey: 'first-message-1', text: 'Hello' }));
    const result = await ask.turn('user-1', input({ idempotencyKey: 'second-message-1', text: 'It runs but needs work' }));

    const request = provider.calls[1];
    expect(request.system).toContain('Coaching style for this person (DIRECT)');
    expect(request.user).toContain('Restore my Buick Regal');
    expect(request.user).toContain('Weekends only');
    expect(request.user).toContain('"id":"wp-1"');
    expect(request.history?.map(turn => turn.role)).toEqual(['user', 'assistant']);
    expect(request.history?.[0].text).toBe('Hello');
    expect(result.mode).toBe('ONGOING');
    expect(result.assistantMessage.text).toBe('Start with the rust.');
    expect(db.messages.map(m => m.role)).toEqual(['USER', 'ASSISTANT', 'USER', 'ASSISTANT']);
    expect(db.messages[3].meta).toMatchObject({ source: 'ai', provider: 'openai', model: 'openai-model', fallbackUsed: false, agentVersion: expect.any(String) });
  });

  it('streams the reply text through the hook when a provider can stream', async () => {
    const provider = fakeProvider('openai', () => answer({ reply: 'Streaming reply here.' }));
    const seen: string[] = [];
    await service(provider).turn('user-1', input(), { onReply: text => seen.push(text) });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe('Streaming reply here.');
  });

  it('is idempotent: a retried send returns the original answer without calling the model again', async () => {
    const provider = fakeProvider('openai', () => answer());
    const ask = service(provider);
    const body = input({ idempotencyKey: 'same-key-12345' });
    const first = await ask.turn('user-1', body);
    const second = await ask.turn('user-1', body);
    expect(provider.calls).toHaveLength(1);
    expect(second.replayed).toBe(true);
    expect(second.assistantMessage.id).toBe(first.assistantMessage.id);
    expect(db.messages).toHaveLength(2);
  });

  it('leaves one answer when two attempts at the same message overlap', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => (release = resolve));
    const provider = fakeProvider('openai', async () => {
      await gate;
      return answer();
    });
    const ask = service(provider);
    const body = input({ idempotencyKey: 'overlap-key-1' });
    const first = ask.turn('user-1', body);
    await new Promise(resolve => setTimeout(resolve, 10));
    const second = ask.turn('user-1', body);
    await new Promise(resolve => setTimeout(resolve, 10));
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(db.messages.filter(m => m.role === 'ASSISTANT')).toHaveLength(1);
    expect(b.assistantMessage.id).toBe(a.assistantMessage.id);
  });

  it('keeps the person’s message when the model is unavailable, says so, and answers it on retry', async () => {
    const failing = fakeProvider('openai', () => {
      throw new ChartProviderError('unavailable', 'openai');
    });
    const body = input({ idempotencyKey: 'retry-key-12345' });
    await expect(service(failing).turn('user-1', body)).rejects.toMatchObject({ code: 'ASK_UNAVAILABLE', statusCode: 503 });
    expect(db.messages.map(m => m.role)).toEqual(['USER']);

    const working = fakeProvider('openai', () => answer());
    const retried = await service(working).turn('user-1', body);
    expect(db.messages.map(m => m.role)).toEqual(['USER', 'ASSISTANT']);
    expect(retried.userMessage?.id).toBe(db.messages[0].id);
  });

  it('falls back to the second provider and records that it did', async () => {
    const primary = fakeProvider('openai', () => {
      throw new ChartProviderError('auth', 'openai');
    });
    const secondary = fakeProvider('gemini', () => answer());
    const result = await service(primary, secondary).turn('user-1', input());
    expect(result.generation.fallbackUsed).toBe(true);
    expect(db.messages[1].meta).toMatchObject({ provider: 'gemini', fallbackUsed: true });
  });

  it('treats an invalid model answer as a failure rather than saving it', async () => {
    const bad = fakeProvider('openai', () => ({ reply: '' }));
    await expect(service(bad).turn('user-1', input())).rejects.toMatchObject({ code: 'ASK_UNAVAILABLE' });
    expect(db.messages.filter(m => m.role === 'ASSISTANT')).toHaveLength(0);
  });

  it('says it is unavailable when no provider is configured instead of inventing coaching', async () => {
    await expect(service().turn('user-1', input())).rejects.toMatchObject({ code: 'ASK_UNAVAILABLE' });
  });

  it('requires a message or a photo', async () => {
    await expect(service(fakeProvider('openai', () => answer())).turn('user-1', input({ text: '  ' }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('never reads another person’s photo', async () => {
    db.assets.push({ id: 'asset-1', userId: 'someone-else', storageKey: 'k', mimeType: 'image/jpeg' });
    await expect(
      service(fakeProvider('openai', () => answer())).turn('user-1', input({ attachments: ['asset-1'] }))
    ).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
  });

  it('sends the person’s own photo to the model and stores only its id', async () => {
    db.assets.push({ id: 'asset-1', userId: 'user-1', storageKey: 'k', mimeType: 'image/jpeg' });
    const provider = fakeProvider('openai', () => answer({ requestPhoto: { reason: 'one more please' } }));
    const result = await service(provider).turn('user-1', input({ attachments: ['asset-1'] }));
    expect(provider.calls[0].images).toHaveLength(1);
    expect(provider.calls[0].user).toContain('attached 1 photo(s)');
    expect(db.messages[0].attachments).toEqual([{ assetId: 'asset-1' }]);
    expect(JSON.stringify(db.messages)).not.toContain('aW1n'); // base64 of "img": bytes are never persisted
    // A photo request right after the person already sent one is dropped.
    expect(result.assistantMessage.requestPhoto).toBeNull();
  });

  it('keeps conversations separate per Anchor', async () => {
    const provider = fakeProvider('openai', () => answer());
    const ask = service(provider);
    await ask.turn('user-1', input({ text: 'about the car' }));
    db.anchors.push({ id: 'anchor-2', userId: 'user-1' });
    mockContext.value = baseContext({ anchor: { id: 'anchor-2', intention: 'Run a marathon', category: 'health' }, chart: null });
    await ask.turn('user-1', input({ anchorId: 'anchor-2', text: 'about running' }));
    expect(provider.calls[1].history).toEqual([]);
    expect(provider.calls[1].user).not.toContain('Buick');
    expect(new Set(db.conversations.map(c => c.anchorId))).toEqual(new Set(['anchor-1', 'anchor-2']));
  });

  it('rejects a conversation id that is not the caller’s', async () => {
    db.conversations.push({ id: 'conv-x', userId: 'someone-else', anchorId: 'anchor-1', courseId: 'course-1' });
    await expect(
      service(fakeProvider('openai', () => answer())).turn('user-1', input({ conversationId: 'conv-x' }))
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
  });

  it('saves only whitelisted, explicitly stated preferences, per Anchor', async () => {
    const provider = fakeProvider('openai', () => answer({ remember: { key: 'availability', value: 'Weekends only' } }));
    const result = await service(provider).turn('user-1', input({ text: 'I only have weekends' }));
    expect(result.remembered).toEqual({ key: 'availability', value: 'Weekends only' });
    expect(db.memories).toEqual([expect.objectContaining({ userId: 'user-1', anchorId: 'anchor-1', key: 'availability', source: 'CONVERSATION' })]);
  });

  describe('opening turn', () => {
    it('greets without saving a user message and tells the model it is an opening', async () => {
      const provider = fakeProvider('openai', () => answer({ reply: 'You are mid-way through exterior prep.' }));
      const result = await service(provider).turn('user-1', input({ text: '', opening: true }));
      expect(result.userMessage).toBeNull();
      expect(result.assistantMessage.text).toBe('You are mid-way through exterior prep.');
      expect(provider.calls[0].user).toContain('(opening:');
      expect(provider.calls[0].history).toEqual([]);
      expect(db.messages.map(m => m.role)).toEqual(['ASSISTANT']);
    });

    it('is idempotent and never opens a conversation that has started', async () => {
      const provider = fakeProvider('openai', () => answer());
      const ask = service(provider);
      const body = input({ text: '', opening: true, idempotencyKey: 'opening-key-1' });
      const first = await ask.turn('user-1', body);
      const second = await ask.turn('user-1', body);
      expect(second.replayed).toBe(true);
      expect(second.assistantMessage.id).toBe(first.assistantMessage.id);
      expect(provider.calls).toHaveLength(1);
      await expect(ask.turn('user-1', input({ text: '', opening: true, idempotencyKey: 'opening-key-2' }))).rejects.toMatchObject({ code: 'ASK_ALREADY_OPEN' });
    });
  });

  describe('creation mode', () => {
    beforeEach(() => {
      mockContext.value = baseContext({ chart: null });
    });

    it('uses the creation skill and hands back exactly what the plan endpoint needs once ready', async () => {
      db.assets.push({ id: 'asset-9', userId: 'user-1', storageKey: 'k', mimeType: 'image/png' });
      const provider = fakeProvider('openai', request => answer({
        readyToPlan: true, startingPoint: 'Runs, needs paint and wheels', context: 'Has a garage on weekends',
        action: { type: 'ADD_MOVES', waypointId: 'wp-1', moves: [{ title: 'x', rationale: null }], reason: null, detail: null, summary: 'x' },
        reply: request.system.includes('Skill for this turn (CREATION)') ? 'Ready when you are.' : 'wrong skill',
      }));
      const result = await service(provider).turn('user-1', input({ skill: 'STUCK', attachments: ['asset-9'] }));
      expect(result.mode).toBe('CREATE');
      expect(result.assistantMessage.text).toBe('Ready when you are.');
      expect(result.assistantMessage.readyToPlan).toBe(true);
      expect(result.assistantMessage.planInput).toEqual({
        actualStartingPoint: 'Runs, needs paint and wheels', startingContext: 'Has a garage on weekends', photoAssetIds: ['asset-9'],
      });
      // There is no Chart yet, so a Chart action is dropped.
      expect(result.assistantMessage.action).toBeNull();
    });

    it('falls back to what the person actually wrote when the model leaves the summary blank', async () => {
      const provider = fakeProvider('openai', () => answer({ readyToPlan: true }));
      const result = await service(provider).turn('user-1', input({ text: 'Just draft something' }));
      expect(result.assistantMessage.planInput?.actualStartingPoint).toBe('Just draft something');
    });

    it('does not offer a plan unless the model says it has enough', async () => {
      const result = await service(fakeProvider('openai', () => answer())).turn('user-1', input());
      expect(result.assistantMessage.planInput).toBeNull();
    });

    it('continues the same conversation once the Chart exists', async () => {
      const ask = service(fakeProvider('openai', () => answer()));
      await ask.turn('user-1', input({ text: 'planning chat' }));
      mockContext.value = baseContext();
      const provider = fakeProvider('openai', () => answer());
      await service(provider).turn('user-1', input({ text: 'now with a chart' }));
      expect(provider.calls[0].history?.map(turn => turn.text)).toEqual(['planning chat', 'Start with the rust.']);
      expect(db.conversations).toHaveLength(1);
      expect(db.conversations[0].courseId).toBe('course-1');
    });
  });

  describe('proposed actions are checked against the real Chart', () => {
    const moves = [{ title: 'Treat rust spots', rationale: 'Stops it spreading' }];
    const act = (extra: Record<string, unknown>) =>
      answer({ action: { type: 'ADD_MOVES', waypointId: 'wp-1', moves, reason: null, detail: null, summary: 'Add a move', ...extra } });

    it('offers a valid ADD_MOVES proposal as pending', async () => {
      const result = await service(fakeProvider('openai', () => act({}))).turn('user-1', input({ skill: 'SUGGEST_MOVE' }));
      expect(result.assistantMessage.action).toMatchObject({ type: 'ADD_MOVES', status: 'PENDING', waypointId: 'wp-1', waypointTitle: 'Prepare the exterior', moves });
    });

    it('defaults to the current waypoint when the model gives no id', async () => {
      const result = await service(fakeProvider('openai', () => act({ waypointId: null }))).turn('user-1', input());
      expect(result.assistantMessage.action?.waypointId).toBe('wp-1');
    });

    it('drops an invented waypoint id and flags that the change could not be prepared', async () => {
      const result = await service(fakeProvider('openai', () => act({ waypointId: 'made-up' }))).turn('user-1', input());
      expect(result.assistantMessage.action).toBeNull();
      expect(result.assistantMessage.actionUnavailable).toBe(true);
    });

    it('drops moves for a waypoint that is already reached', async () => {
      const result = await service(fakeProvider('openai', () => act({ waypointId: 'wp-0' }))).turn('user-1', input());
      expect(result.assistantMessage.action).toBeNull();
    });

    it('does not re-propose a move the person already has', async () => {
      const result = await service(fakeProvider('openai', () => act({ moves: [{ title: 'strip paint!', rationale: null }] }))).turn('user-1', input());
      expect(result.assistantMessage.action).toBeNull();
      expect(result.assistantMessage.actionUnavailable).toBe(false);
    });

    it('prepares a route revision with the real planner and never writes it', async () => {
      mockAdjust.mockResolvedValue({
        status: 'proposal',
        proposal: { proposalId: 'prop-1', baseCourseVersion: 4, generation: { source: 'ai' }, waypoints: [{ title: 'A' }, { title: 'B' }] },
      });
      const provider = fakeProvider('openai', () => answer({ action: { type: 'REVISE_ROUTE', waypointId: null, moves: [], reason: 'TOO_MANY_STEPS', detail: 'Fewer steps', summary: 'Fewer waypoints' } }));
      const stages: string[] = [];
      const result = await service(provider).turn('user-1', input({ skill: 'REVISE_ROUTE' }), { onStage: stage => stages.push(stage) });
      expect(stages).toEqual(['preparing_change']);
      expect(mockAdjust).toHaveBeenCalledWith('user-1', expect.objectContaining({ anchorId: 'anchor-1', reason: 'TOO_MANY_STEPS', courseId: 'course-1' }));
      expect(result.assistantMessage.action).toMatchObject({ type: 'REVISE_ROUTE', status: 'PENDING', routeProposalId: 'prop-1', routeTitles: ['A', 'B'], baseCourseVersion: 4 });
      expect(mockAddMove).not.toHaveBeenCalled();
    });

    it('does not present a generic template route as a personalised revision', async () => {
      mockAdjust.mockResolvedValue({ status: 'proposal', proposal: { proposalId: 'p', baseCourseVersion: 4, generation: { source: 'template' }, waypoints: [] } });
      const provider = fakeProvider('openai', () => answer({ action: { type: 'REVISE_ROUTE', waypointId: null, moves: [], reason: 'OTHER', detail: null, summary: 's' } }));
      const result = await service(provider).turn('user-1', input());
      expect(result.assistantMessage.action).toBeNull();
      expect(result.assistantMessage.actionUnavailable).toBe(true);
    });
  });
});

describe('approvals', () => {
  const seed = (action: Row, extra: Row = {}) => {
    db.conversations.push({ id: 'conv-1', userId: 'user-1', anchorId: 'anchor-1', courseId: 'course-1' });
    db.messages.push({ id: 'msg-1', conversationId: 'conv-1', userId: 'user-1', role: 'ASSISTANT', text: 'x', structured: { action }, createdAt: now(), ...extra });
  };
  const addMoves = { type: 'ADD_MOVES', status: 'PENDING', summary: 's', waypointId: 'wp-1', waypointTitle: 'W', moves: [{ title: 'One', rationale: null }, { title: 'Two', rationale: 'because' }], reason: null, detail: null, routeProposalId: null, routeTitles: null, baseCourseVersion: 4 };

  it('applies the stored moves through addMove with stable keys, then marks the proposal applied', async () => {
    seed(addMoves);
    const result = await new AskChartService().approveMoves('user-1', 'course-1', 'msg-1');
    expect(result.added).toBe(2);
    expect(mockAddMove.mock.calls.map(call => call[2])).toEqual([
      expect.objectContaining({ waypointId: 'wp-1', title: 'One', source: 'AI', status: 'ACTIVE', idempotencyKey: 'ask-move:msg-1:0' }),
      expect.objectContaining({ title: 'Two', rationale: 'because', idempotencyKey: 'ask-move:msg-1:1' }),
    ]);
    expect(db.messages[0].structured.action.status).toBe('APPLIED');
  });

  it('does not mark anything applied when a save fails', async () => {
    seed(addMoves);
    mockAddMove.mockRejectedValueOnce(new AppError('boom', 500, 'X'));
    await expect(new AskChartService().approveMoves('user-1', 'course-1', 'msg-1')).rejects.toMatchObject({ code: 'X' });
    expect(db.messages[0].structured.action.status).toBe('PENDING');
  });

  it('reports a stale proposal when the waypoint has since been reached', async () => {
    seed(addMoves);
    mockAddMove.mockRejectedValueOnce(new AppError('behind you', 409, 'WAYPOINT_TRANSITION_INVALID'));
    await expect(new AskChartService().approveMoves('user-1', 'course-1', 'msg-1')).rejects.toMatchObject({ code: 'PROPOSAL_STALE' });
  });

  it('refuses a dismissed proposal', async () => {
    seed({ ...addMoves, status: 'DISMISSED' });
    await expect(new AskChartService().approveMoves('user-1', 'course-1', 'msg-1')).rejects.toMatchObject({ code: 'PROPOSAL_UNAVAILABLE' });
    expect(mockAddMove).not.toHaveBeenCalled();
  });

  it('cannot reach another person’s or another Chart’s proposal', async () => {
    seed(addMoves);
    await expect(new AskChartService().approveMoves('user-2', 'course-1', 'msg-1')).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });
    await expect(new AskChartService().approveMoves('user-1', 'course-2', 'msg-1')).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });
    expect(mockAddMove).not.toHaveBeenCalled();
  });

  it('dismisses, but never un-applies', async () => {
    seed(addMoves);
    await new AskChartService().dismiss('user-1', 'course-1', 'msg-1');
    expect(db.messages[0].structured.action.status).toBe('DISMISSED');
    db.messages[0].structured.action.status = 'APPLIED';
    await new AskChartService().dismiss('user-1', 'course-1', 'msg-1');
    expect(db.messages[0].structured.action.status).toBe('APPLIED');
  });

  it('marks a route revision applied only after the server has recorded the proposal as accepted', async () => {
    const revise = { ...addMoves, type: 'REVISE_ROUTE', waypointId: null, moves: [], routeProposalId: 'prop-1' };
    seed(revise);
    db.proposals.push({ id: 'prop-1', userId: 'user-1', courseId: 'course-1', acceptedAt: null });
    await expect(new AskChartService().confirmRouteApplied('user-1', 'course-1', 'msg-1')).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPLIED' });
    expect(db.messages[0].structured.action.status).toBe('PENDING');
    db.proposals[0].acceptedAt = new Date();
    await new AskChartService().confirmRouteApplied('user-1', 'course-1', 'msg-1');
    expect(db.messages[0].structured.action.status).toBe('APPLIED');
  });
});
