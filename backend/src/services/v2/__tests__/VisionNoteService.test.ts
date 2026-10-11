const note = {
  id: 'note-1', visionId: 'vision-1', userId: 'user-1', clientRequestId: '5a6df40e-8dce-4b9d-8d1f-308e7fa377f5',
  text: 'A future', styleId: 'sticky_blush_pink', x: .5, y: .5, width: .34, height: .34,
  rotation: 0, scale: 1, layerOrder: 0, isArchived: false,
  createdAt: new Date('2026-10-10T12:00:00Z'), updatedAt: new Date('2026-10-10T12:00:00Z'),
};
const tx = {
  $queryRaw: jest.fn().mockResolvedValue([]),
  vision: { findFirst: jest.fn(), create: jest.fn() },
  visionNote: { findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)),
  anchor: { findFirst: jest.fn() },
  vision: { findFirst: jest.fn(), create: jest.fn() },
  visionNote: { findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  visionScene: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), updateMany: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../StorageService', () => ({ resolveStorageKeyUrl: jest.fn().mockResolvedValue(null) }));

import { visionService } from '../VisionService';
import { VISION_NOTE_STYLE_IDS } from '../../../domain/v2/vision';
import { AppError } from '../../../api/middleware/errorHandler';

const input = {
  clientRequestId: note.clientRequestId,
  content: { text: note.text },
  presentation: { styleId: note.styleId, x: note.x, y: note.y, width: note.width, height: note.height, rotation: note.rotation, scale: note.scale, layerOrder: note.layerOrder },
};
const visionModel = (notes: typeof note[] = [note]) => ({
  id: 'vision-1', anchorId: 'anchor-1', userId: 'user-1', title: null, description: null, status: 'ACTIVE',
  createdAt: note.createdAt, updatedAt: note.updatedAt, scenes: [], views: [], notes,
});

describe('Vision note service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
    tx.vision.findFirst.mockResolvedValue({ id: 'vision-1' });
    tx.visionNote.findUnique.mockResolvedValue(null);
    tx.visionNote.count.mockResolvedValue(0);
    tx.visionNote.create.mockResolvedValue(note);
    mockPrisma.visionNote.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.vision.findFirst.mockResolvedValue(visionModel());
  });

  it('creates against the owned active Vision, locks the Anchor, and returns saved notes', async () => {
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1' }).mockResolvedValueOnce(visionModel());
    const result = await visionService.createNote('user-1', 'anchor-1', input as never);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.visionNote.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', text: 'A future', clientRequestId: note.clientRequestId }) }));
    expect(result.notes?.[0]).toMatchObject({ id: 'note-1', content: { text: 'A future' }, presentation: { styleId: 'sticky_blush_pink' } });
  });

  it.each(VISION_NOTE_STYLE_IDS)('persists the selected %s material identifier', async styleId => {
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1' }).mockResolvedValueOnce(visionModel());
    const styledInput = { ...input, presentation: { ...input.presentation, styleId } };
    await visionService.createNote('user-1', 'anchor-1', styledInput as never);
    expect(tx.visionNote.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ styleId }),
    }));
  });

  it('replays the same request id without creating a duplicate and rejects a different payload', async () => {
    tx.visionNote.findUnique.mockResolvedValue(note);
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1' }).mockResolvedValueOnce(visionModel());
    await visionService.createNote('user-1', 'anchor-1', input as never);
    expect(tx.visionNote.create).not.toHaveBeenCalled();
    tx.visionNote.findUnique.mockResolvedValue(note);
    await expect(visionService.createNote('user-1', 'anchor-1', { ...input, content: { text: 'Changed' } } as never))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('requires ownership of the Anchor and enforces the active note cap', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);
    await expect(visionService.createNote('other-user', 'anchor-1', input as never)).rejects.toBeInstanceOf(AppError);
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.vision.findFirst.mockResolvedValue({ id: 'vision-1' });
    tx.visionNote.count.mockResolvedValue(24);
    await expect(visionService.createNote('user-1', 'anchor-1', input as never)).rejects.toMatchObject({ code: 'VISION_NOTE_LIMIT' });
  });

  it('updates only the requested owned note fields and soft-archives it', async () => {
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1', anchorId: 'anchor-1' }).mockResolvedValueOnce(visionModel([]));
    mockPrisma.visionNote.findFirst.mockResolvedValue(note);
    mockPrisma.visionNote.updateMany.mockResolvedValue({ count: 1 });
    const updated = await visionService.updateNote('user-1', 'vision-1', 'note-1', { content: { text: 'A clearer future' } } as never);
    expect(mockPrisma.visionNote.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'note-1', visionId: 'vision-1', userId: 'user-1', isArchived: false }, data: { text: 'A clearer future' } }));
    expect(updated.notes).toEqual([]);

    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1', anchorId: 'anchor-1' }).mockResolvedValueOnce(visionModel([]));
    mockPrisma.visionNote.findFirst.mockResolvedValue(note);
    await visionService.deleteNote('user-1', 'vision-1', 'note-1');
    expect(mockPrisma.visionNote.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isArchived: true } }));
  });

  it('restores archived notes under the active-note cap while serializing the count', async () => {
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1', anchorId: 'anchor-1' }).mockResolvedValueOnce(visionModel());
    mockPrisma.visionNote.findFirst.mockResolvedValue({ ...note, isArchived: true });
    tx.visionNote.count.mockResolvedValue(23);
    tx.visionNote.findFirst.mockResolvedValue({ ...note, isArchived: true });
    const restored = await visionService.restoreNote('user-1', 'vision-1', 'note-1');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.visionNote.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isArchived: false } }));
    expect(restored.notes?.[0]?.id).toBe('note-1');
  });

  it('updates only an owned active scene caption and normalizes blank text to null', async () => {
    mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1', anchorId: 'anchor-1' }).mockResolvedValueOnce(visionModel([]));
    mockPrisma.visionScene.findFirst.mockResolvedValue({ id: 'scene-1' });
    mockPrisma.visionScene.updateMany.mockResolvedValue({ count: 1 });
    await visionService.updateSceneCaption('user-1', 'vision-1', 'scene-1', { caption: '   ' });
    expect(mockPrisma.visionScene.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'scene-1', visionId: 'vision-1', userId: 'user-1', isArchived: false }, data: { caption: null } }));
  });
});
