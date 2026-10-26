import type { VisionBoardLayout, VisionReadModel } from '../../../domain/v2/vision';

const tx = {
  $queryRaw: jest.fn(),
  vision: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  visionScene: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(),
  anchor: { findFirst: jest.fn() },
  vision: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  visionScene: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../milestones/MilestoneService', () => ({ milestoneService: { evaluateQuietly: jest.fn() } }));
jest.mock('../../StorageService', () => ({ resolveStorageKeyUrl: jest.fn() }));

import { visionService } from '../VisionService';
import { resolveStorageKeyUrl } from '../../StorageService';
import { UpdateVisionSchema } from '../../../domain/v2/vision';

// The final handoff adds this method. Keeping its contract explicit lets the
// reproduction execute against the pre-implementation service and fail honestly.
type SceneSlotsInput = { slots: Array<{ sceneId: string; slotIndex: number }>; expectedUpdatedAt?: string };
const service = visionService as typeof visionService & {
  updateSceneSlots(userId: string, visionId: string, input: SceneSlotsInput): Promise<VisionReadModel>;
};
const date = new Date('2026-10-22T12:00:00Z');
const savedDate = new Date('2026-10-22T12:01:00Z');
function fixture() {
  return {
    id: 'vision', anchorId: 'anchor', userId: 'owner', title: 'My future', description: 'Studio by the ocean',
    status: 'ACTIVE', boardLayout: 'CLASSIC' as VisionBoardLayout | undefined,
    scenes: ['a', 'b'].map((id, index) => ({
      id: `photo-${id}`, visionId: 'vision', userId: 'owner', assetId: `asset-${id}`, sourceType: 'USER_UPLOAD',
      prompt: `Original ${id}`, caption: `Caption ${id}`, slotIndex: index, sortOrder: index,
      focalX: .25 + index * .25, focalY: .75, isArchived: false,
      asset: { storageKey: `photo-${id}.jpg` }, createdAt: date, updatedAt: date,
    })),
    notes: [{ id: 'note-a', visionId: 'vision', userId: 'owner', text: 'Build this life',
      styleId: 'paper_ivory_torn', fontId: 'classic', x: .5, y: .5, width: .2, height: .12,
      rotation: 0, scale: 1, layerOrder: 2, isArchived: false, createdAt: date, updatedAt: date,
      layoutPositions: { EDITORIAL: { x: .42, y: 3.2 }, SCRAPBOOK: null } as Record<string, { x: number; y: number } | null> | null,
    }],
    views: [], createdAt: date, updatedAt: date,
  };
}
type StoredBoard = ReturnType<typeof fixture>;
type Where = { id?: string; userId?: string; visionId?: string; status?: string; isArchived?: boolean; updatedAt?: Date };
let committed: StoredBoard;
let draft: StoredBoard;

function owned(row: { id: string; userId: string }, where: Where) {
  return (where.id === undefined || row.id === where.id) && (where.userId === undefined || row.userId === where.userId);
}
function matchingPhotos(board: StoredBoard, where: Where) {
  return board.scenes.filter(scene => owned(scene, where) &&
    (where.visionId === undefined || scene.visionId === where.visionId) &&
    (where.isArchived === undefined || scene.isArchived === where.isArchived));
}
function writeVision(board: StoredBoard, where: Where, data: object) {
  if (!owned(board, where) || (where.updatedAt && board.updatedAt.getTime() !== where.updatedAt.getTime())) return { count: 0 };
  Object.assign(board, data, { updatedAt: savedDate });
  return { count: 1 };
}
function layoutInput(boardLayout: VisionBoardLayout, expectedUpdatedAt?: string) {
  // The pre-change schema drops boardLayout, which reproduces the absent API contract.
  return UpdateVisionSchema.parse({ boardLayout, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) });
}
const swappedSlots = [{ sceneId: 'photo-a', slotIndex: 1 }, { sceneId: 'photo-b', slotIndex: 0 }];

describe('Vision final handoff: shared slots and additive layout persistence', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    committed = fixture();
    draft = structuredClone(committed);
    jest.mocked(resolveStorageKeyUrl).mockImplementation(async key => `https://cdn.test/${key}`);
    mockPrisma.anchor.findFirst.mockImplementation(async ({ where }) => where.id === 'anchor' && where.userId === 'owner' ? { id: 'anchor' } : null);
    mockPrisma.vision.findFirst.mockImplementation(async ({ where }) => owned(committed, where) && (!where.status || committed.status === where.status) ? structuredClone(committed) : null);
    mockPrisma.vision.update.mockImplementation(async ({ where, data }) => { writeVision(committed, where, data); return structuredClone(committed); });
    mockPrisma.vision.updateMany.mockImplementation(async ({ where, data }) => writeVision(committed, where, data));
    mockPrisma.visionScene.findMany.mockImplementation(async ({ where }) => structuredClone(matchingPhotos(committed, where)));
    mockPrisma.visionScene.findFirst.mockImplementation(async ({ where }) => structuredClone(matchingPhotos(committed, where)[0] ?? null));
    mockPrisma.visionScene.count.mockImplementation(async ({ where }) => matchingPhotos(committed, where).length);
    mockPrisma.visionScene.update.mockImplementation(async ({ where, data }) => {
      const row = matchingPhotos(committed, where)[0]; Object.assign(row, data); return row;
    });
    // Draft writes commit only if the complete transaction callback succeeds.
    let transactionTail: Promise<unknown> = Promise.resolve();
    mockPrisma.$transaction.mockImplementation((operation: (transaction: typeof tx) => Promise<unknown>) => {
      const task = transactionTail.catch(() => undefined).then(async () => {
        draft = structuredClone(committed);
        const result = await operation(tx);
        committed = draft;
        return result;
      });
      transactionTail = task;
      return task;
    });
    tx.$queryRaw.mockResolvedValue([]);
    tx.vision.findFirst.mockImplementation(async ({ where }) => owned(draft, where) && (!where.status || draft.status === where.status) ? {
      ...structuredClone(draft), scenes: draft.scenes.filter(scene => !scene.isArchived), notes: draft.notes.filter(note => !note.isArchived),
    } : null);
    tx.vision.updateMany.mockImplementation(async ({ where, data }) => writeVision(draft, where, data));
    tx.vision.update.mockImplementation(async ({ where, data }) => { writeVision(draft, where, data); return structuredClone(draft); });
    tx.visionScene.findMany.mockImplementation(async ({ where }) => structuredClone(matchingPhotos(draft, where)));
    tx.visionScene.findFirst.mockImplementation(async ({ where }) => structuredClone(matchingPhotos(draft, where)[0] ?? null));
    tx.visionScene.count.mockImplementation(async ({ where }) => matchingPhotos(draft, where).length);
    tx.visionScene.update.mockImplementation(async ({ where, data }) => {
      const row = matchingPhotos(draft, where)[0]; Object.assign(row, data); return row;
    });
    tx.visionScene.updateMany.mockImplementation(async ({ where, data }) => {
      const row = matchingPhotos(draft, where)[0];
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    });
  });

  it('reads pre-layout records as Classic without changing photos, captions or focal points', async () => {
    committed.boardLayout = undefined;
    committed.notes[0].layoutPositions = null;
    const result = await service.getAnchorVision('owner', 'anchor');
    expect(result?.boardLayout).toBe('CLASSIC');
    expect(result?.scenes[0]).toMatchObject({ caption: 'Caption a', focal: { x: .25, y: .75 }, slotIndex: 0 });
    expect(result?.notes?.[0]).toMatchObject({ content: { text: 'Build this life' }, presentation: { x: .5, y: .5 } });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('advances the layout conflict token even when two writes share a millisecond', async () => {
    const clock=jest.spyOn(Date,'now').mockReturnValue(date.getTime());
    try {
      await service.updateVision('owner','vision',layoutInput('EDITORIAL',date.toISOString()));
      expect(mockPrisma.vision.updateMany.mock.calls[0][0].data.updatedAt.getTime()).toBeGreaterThan(date.getTime());
    } finally { clock.mockRestore(); }
  });

  it('does not bypass conflict protection when a layout change also includes status', async () => {
    const before=structuredClone(committed);
    await expect(service.updateVision('owner','vision',{boardLayout:'EDITORIAL',status:'ACTIVE',expectedUpdatedAt:'2026-10-01T00:00:00Z'}))
      .rejects.toMatchObject({code:'VISION_CONFLICT',statusCode:409});
    expect(committed).toEqual(before);
  });

  it('returns layout-specific note positions with board-width y units and explicit null unchanged', async () => {
    const result = await service.getAnchorVision('owner', 'anchor');
    expect(result?.notes?.[0]).toMatchObject({
      layoutPositions: { EDITORIAL: { x: .42, y: 3.2 }, SCRAPBOOK: null },
      presentation: { x: .5, y: .5 },
    });
  });

  it.each(['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const)('persists %s through existing updateVision without changing shared slots or content', async layout => {
    const before = structuredClone(committed);
    const result = await service.updateVision('owner', 'vision', layoutInput(layout, date.toISOString()));
    expect(result.boardLayout).toBe(layout);
    expect(committed.boardLayout).toBe(layout);
    expect(committed.scenes).toEqual(before.scenes);
    expect(committed.notes).toEqual(before.notes);
  });

  it('accepts a layout update without expectedUpdatedAt for older clients', async () => {
    const result = await service.updateVision('owner', 'vision', layoutInput('EDITORIAL'));
    expect(result.boardLayout).toBe('EDITORIAL');
  });

  it('rejects another account before changing its layout', async () => {
    const before = structuredClone(committed);
    await expect(service.updateVision('intruder', 'vision', layoutInput('SCRAPBOOK')))
      .rejects.toMatchObject({ statusCode: 404, code: 'VISION_NOT_FOUND' });
    expect(committed).toEqual(before);
  });

  it('rejects a layout save with stale expectedUpdatedAt', async () => {
    const before = structuredClone(committed);
    await expect(service.updateVision('owner', 'vision', layoutInput('EDITORIAL', '2026-10-20T12:00:00Z')))
      .rejects.toMatchObject({ statusCode: 409, code: 'VISION_CONFLICT' });
    expect(committed).toEqual(before);
  });

  it('atomically swaps the one shared slot map and keeps photo identity, captions, crops and notes', async () => {
    const before = structuredClone(committed);
    const result = await service.updateSceneSlots('owner', 'vision', { slots: swappedSlots, expectedUpdatedAt: date.toISOString() });
    expect(committed.scenes).toEqual([
      { ...before.scenes[0], slotIndex: 1, sortOrder: 1 },
      { ...before.scenes[1], slotIndex: 0, sortOrder: 0 },
    ]);
    expect(result.scenes.find(scene => scene.id === 'photo-a')).toMatchObject({
      slotIndex: 1, caption: 'Caption a', focal: { x: .25, y: .75 }, resolvedImageUrl: 'https://cdn.test/photo-a.jpg',
    });
    expect(committed.notes).toEqual(before.notes);
    expect(committed.boardLayout).toBe('CLASSIC');
  });

  it('keeps shared slots unchanged when changing layout after a swap', async () => {
    await service.updateSceneSlots('owner', 'vision', { slots: swappedSlots });
    const slotsBefore = structuredClone(committed.scenes);
    await service.updateVision('owner', 'vision', layoutInput('EDITORIAL'));
    expect(committed.scenes).toEqual(slotsBefore);
    expect(committed.boardLayout).toBe('EDITORIAL');
  });

  it('supports a slot mutation without expectedUpdatedAt for older clients', async () => {
    const result = await service.updateSceneSlots('owner', 'vision', { slots: swappedSlots });
    expect(result.scenes.find(scene => scene.id === 'photo-a')?.slotIndex).toBe(1);
  });

  it('rejects another account before changing shared slots', async () => {
    const before = structuredClone(committed);
    await expect(service.updateSceneSlots('intruder', 'vision', { slots: swappedSlots }))
      .rejects.toMatchObject({ statusCode: 404, code: 'VISION_NOT_FOUND' });
    expect(committed).toEqual(before);
  });

  it('rejects stale expectedUpdatedAt on a slot mutation without changing a photo', async () => {
    const before = structuredClone(committed);
    await expect(service.updateSceneSlots('owner', 'vision', { slots: swappedSlots, expectedUpdatedAt: '2026-10-20T12:00:00Z' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'VISION_CONFLICT' });
    expect(committed).toEqual(before);
  });

  it('rolls back the entire swap when a scene write fails midway', async () => {
    const before = structuredClone(committed);
    tx.visionScene.updateMany.mockImplementationOnce(async ({ where, data }) => {
      Object.assign(matchingPhotos(draft, where)[0], data);
      return { count: 1 };
    }).mockRejectedValueOnce(new Error('Connection lost'));
    await expect(service.updateSceneSlots('owner', 'vision', { slots: swappedSlots })).rejects.toThrow('Connection lost');
    expect(committed).toEqual(before);
  });

  it.each([
    ['missing photo', [{ sceneId: 'photo-a', slotIndex: 0 }]],
    ['duplicate photo', [{ sceneId: 'photo-a', slotIndex: 0 }, { sceneId: 'photo-a', slotIndex: 1 }]],
    ['foreign photo', [{ sceneId: 'photo-a', slotIndex: 0 }, { sceneId: 'photo-foreign', slotIndex: 1 }]],
    ['duplicate slot', [{ sceneId: 'photo-a', slotIndex: 0 }, { sceneId: 'photo-b', slotIndex: 0 }]],
    ['negative slot', [{ sceneId: 'photo-a', slotIndex: -1 }, { sceneId: 'photo-b', slotIndex: 0 }]],
    ['out-of-bounds slot', [{ sceneId: 'photo-a', slotIndex: 0 }, { sceneId: 'photo-b', slotIndex: 8 }]],
  ])('rejects %s without partially saving the shared map', async (_label, slots) => {
    const before = structuredClone(committed);
    await expect(service.updateSceneSlots('owner', 'vision', { slots })).rejects.toBeInstanceOf(Error);
    expect(committed).toEqual(before);
    expect(tx.visionScene.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an arrangement containing a photo archived on another device', async () => {
    committed.scenes[1].isArchived = true;
    const before = structuredClone(committed);
    await expect(service.updateSceneSlots('owner', 'vision', { slots: swappedSlots })).rejects.toBeInstanceOf(Error);
    expect(committed).toEqual(before);
  });

  it('archives an owned photo only after locking its Anchor and counting active photos inside the transaction', async () => {
    await expect(service.archiveScene('owner', 'vision', 'photo-a')).resolves.toEqual({ success: true });
    expect(committed.scenes.filter(scene => !scene.isArchived).map(scene => scene.id)).toEqual(['photo-b']);
    expect(tx.$queryRaw).toHaveBeenCalled();
    const lock = tx.$queryRaw.mock.calls[0][0];
    expect(lock.sql).toMatch(/anchors.*FOR UPDATE/s);
    expect(tx.visionScene.count).toHaveBeenCalledWith({ where: { visionId: 'vision', userId: 'owner', isArchived: false } });
    expect(tx.visionScene.count.mock.invocationCallOrder[0]).toBeGreaterThan(tx.$queryRaw.mock.invocationCallOrder[0]);
    expect(mockPrisma.visionScene.count).not.toHaveBeenCalled();
    expect(mockPrisma.visionScene.update).not.toHaveBeenCalled();
  });

  it('does not let two overlapping removals archive both remaining photos', async () => {
    const attempts = await Promise.allSettled([
      service.archiveScene('owner', 'vision', 'photo-a'),
      service.archiveScene('owner', 'vision', 'photo-b'),
    ]);
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.find(attempt => attempt.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'VISION_IMAGE_MINIMUM' });
    expect(committed.scenes.filter(scene => !scene.isArchived)).toHaveLength(1);
  });

  it('rejects removing the last photo and preserves all content', async () => {
    committed.scenes = [committed.scenes[0]];
    const before = structuredClone(committed);
    await expect(service.archiveScene('owner', 'vision', 'photo-a')).rejects.toMatchObject({ code: 'VISION_IMAGE_MINIMUM' });
    expect(committed).toEqual(before);
  });

  it('rejects photo removal from an archived Vision even when the photo itself is active', async () => {
    committed.status = 'ARCHIVED';
    const before = structuredClone(committed);
    await expect(service.archiveScene('owner', 'vision', 'photo-a')).rejects.toMatchObject({ code: 'VISION_NOT_FOUND' });
    expect(committed).toEqual(before);
  });

  it('rechecks that the Vision is active inside the removal transaction', async () => {
    tx.vision.findFirst.mockResolvedValueOnce(null);
    const before = structuredClone(committed);
    await expect(service.archiveScene('owner', 'vision', 'photo-a')).rejects.toMatchObject({ code: 'VISION_NOT_FOUND' });
    expect(committed).toEqual(before);
  });

  it('rejects removing a foreign photo without mutating either board', async () => {
    const before = structuredClone(committed);
    await expect(service.archiveScene('intruder', 'vision', 'photo-a')).rejects.toMatchObject({ statusCode: 404 });
    expect(committed).toEqual(before);
  });

  it('treats replayed removal of an already archived photo as an idempotent success', async () => {
    committed.scenes[0].isArchived = true;
    const before = structuredClone(committed);
    await expect(service.archiveScene('owner', 'vision', 'photo-a')).resolves.toEqual({ success: true });
    expect(committed).toEqual(before);
    expect(tx.visionScene.count).not.toHaveBeenCalled();
  });
});
