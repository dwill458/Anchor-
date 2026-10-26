import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { clearPendingVisionWrite, releasePendingVisionWrites, retainPendingVisionWrite, takePendingVisionWrites } from '../visionPendingWrites';

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));
const disk = new Map<string, string>();
const storage = jest.mocked(encryptedPersistStorage);
const path = '/api/v2/visions/vision-1/scenes/photo-1';
const account = 'owner:/account';
const anchor = 'anchor:/one';
const keyFor = (accountId: string, anchorId: string) => `anchor:v2:vision-pending:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`;

describe('encrypted account-scoped pending Vision writes', () => {
  beforeEach(() => {
    for (const [accountId, anchorId] of [[account, anchor], ['a', 'same-anchor'], ['b', 'same-anchor'], ['a', 'other-anchor']])
      releasePendingVisionWrites(accountId, anchorId);
    jest.resetAllMocks();
    disk.clear();
    storage.getItem.mockImplementation(async key => disk.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => { disk.set(key, value); });
  });

  it('persists retry content through encrypted storage under the exact account and Anchor scope', async () => {
    const body = { caption: 'My saved words', expectedUpdatedAt: '2026-10-22T12:00:00Z' };
    await retainPendingVisionWrite(account, anchor, 'patch', path, body);
    expect(storage.setItem).toHaveBeenCalledWith(keyFor(account, anchor), expect.any(String));
    expect(JSON.parse(disk.get(keyFor(account, anchor))!)).toMatchObject({
      version: 1, accountId: account, anchorId: anchor,
      writes: [{ method: 'patch', path, body }],
    });
  });

  it('keeps accounts and Anchors independent even when the API path is identical', async () => {
    await Promise.all([
      retainPendingVisionWrite('a', 'same-anchor', 'patch', path, { caption: 'Account A' }),
      retainPendingVisionWrite('b', 'same-anchor', 'patch', path, { caption: 'Account B' }),
      retainPendingVisionWrite('a', 'other-anchor', 'patch', path, { caption: 'Other Anchor' }),
    ]);
    expect((await takePendingVisionWrites('a', 'same-anchor')).map(write => write.body.caption)).toEqual(['Account A']);
    expect((await takePendingVisionWrites('b', 'same-anchor')).map(write => write.body.caption)).toEqual(['Account B']);
    expect((await takePendingVisionWrites('a', 'other-anchor')).map(write => write.body.caption)).toEqual(['Other Anchor']);
  });

  it.each([
    { accountId: 'another-owner', anchorId: anchor, version: 1 },
    { accountId: account, anchorId: 'another-anchor', version: 1 },
    { accountId: account, anchorId: anchor, version: 99 },
  ])('refuses a stored envelope from a different scope or schema: %j', async mismatch => {
    disk.set(keyFor(account, anchor), JSON.stringify({ ...mismatch, writes: [{ id: 'wrong', method: 'patch', path, body: { caption: 'Other content' } }] }));
    expect(await takePendingVisionWrites(account, anchor)).toEqual([]);
  });

  it('deduplicates the same edited field and keeps its newest payload despite timestamp changes', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Old draft', expectedUpdatedAt: 'old-time' });
    await retainPendingVisionWrite(account, anchor, 'patch', path, { expectedUpdatedAt: 'new-time', caption: 'Newest draft' });
    const writes = await takePendingVisionWrites(account, anchor);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toEqual({ expectedUpdatedAt: 'new-time', caption: 'Newest draft' });
  });

  it('preserves independent fields, scene paths and mutation methods', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Caption' });
    await retainPendingVisionWrite(account, anchor, 'patch', path, { focal: { x: .3, y: .7 } });
    await retainPendingVisionWrite(account, anchor, 'patch', `${path}-2`, { caption: 'Another photo' });
    await retainPendingVisionWrite(account, anchor, 'put', '/api/v2/visions/vision-1/scenes/slots', { slots: [{ sceneId: 'photo-1', slotIndex: 1 }] });
    expect(await takePendingVisionWrites(account, anchor)).toHaveLength(4);
  });

  it('claims saved edits exactly once across simultaneous refreshes while retaining them durably until acknowledgement', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Retry once' });
    const attempts = await Promise.all([takePendingVisionWrites(account, anchor), takePendingVisionWrites(account, anchor)]);
    expect(attempts.map(writes => writes.length)).toEqual([1, 0]);
    expect(await takePendingVisionWrites(account, anchor)).toEqual([]);
    expect(JSON.parse(disk.get(keyFor(account, anchor))!).writes).toHaveLength(1);
    await clearPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Retry once', expectedUpdatedAt: 'confirmed-time' });
    expect(JSON.parse(disk.get(keyFor(account, anchor))!).writes).toEqual([]);
    releasePendingVisionWrites(account, anchor);
    expect(await takePendingVisionWrites(account, anchor)).toEqual([]);
  });

  it('serializes concurrent retains and clear without losing independent pending fields', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Confirmed' });
    await Promise.all([
      retainPendingVisionWrite(account, anchor, 'patch', path, { focal: { x: .4, y: .6 } }),
      clearPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Confirmed', expectedUpdatedAt: 'new-server-time' }),
      retainPendingVisionWrite(account, anchor, 'put', '/api/v2/visions/vision-1/scenes/slots', { slots: [{ sceneId: 'photo-1', slotIndex: 3 }] }),
    ]);
    const writes = await takePendingVisionWrites(account, anchor);
    expect(writes.map(write => Object.keys(write.body))).toEqual([['focal'], ['slots']]);
  });

  it('does not let completion of an older retry clear a newer failed edit of the same field', async () => {
    const oldRetry = { caption: 'Old failed caption', expectedUpdatedAt: 'old-time' };
    const latestRetry = { caption: 'Newer failed caption', expectedUpdatedAt: 'new-time' };
    await retainPendingVisionWrite(account, anchor, 'patch', path, oldRetry);
    await retainPendingVisionWrite(account, anchor, 'patch', path, latestRetry);
    await clearPendingVisionWrite(account, anchor, 'patch', path, oldRetry);
    const writes = await takePendingVisionWrites(account, anchor);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toEqual(latestRetry);
  });

  it('keeps newly retained work after a concurrent claim and makes it available after release', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'First retry' });
    const drained = takePendingVisionWrites(account, anchor);
    const retained = retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'New failed edit' });
    expect((await drained).map(write => write.body.caption)).toEqual(['First retry']);
    await retained;
    releasePendingVisionWrites(account, anchor);
    expect((await takePendingVisionWrites(account, anchor)).map(write => write.body.caption)).toEqual(['New failed edit']);
  });

  it('propagates encrypted write failures instead of claiming the retry was retained', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('Encrypted vault write failed'));
    await expect(retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Unsaved' })).rejects.toThrow('Encrypted vault write failed');
    expect(disk.has(keyFor(account, anchor))).toBe(false);
  });

  it('does not replace existing retry content when reading encrypted storage fails', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Existing retry' });
    const before = disk.get(keyFor(account, anchor));
    storage.getItem.mockRejectedValueOnce(new Error('Encrypted vault is temporarily unavailable'));
    await expect(retainPendingVisionWrite(account, anchor, 'patch', path, { focal: { x: .5, y: .5 } }))
      .rejects.toThrow('Encrypted vault is temporarily unavailable');
    expect(disk.get(keyFor(account, anchor))).toBe(before);
  });

  it('retains acknowledged work when its durable deletion fails so the next released batch can retry it', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Still retained' });
    expect((await takePendingVisionWrites(account, anchor)).map(write => write.body.caption)).toEqual(['Still retained']);
    storage.setItem.mockRejectedValueOnce(new Error('Encrypted vault write failed'));
    await expect(clearPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Still retained' }))
      .rejects.toThrow('Encrypted vault write failed');
    releasePendingVisionWrites(account, anchor);
    expect((await takePendingVisionWrites(account, anchor)).map(write => write.body.caption)).toEqual(['Still retained']);
  });

  it('releases a failed or interrupted batch without losing its persisted retry payload', async () => {
    const body = { caption: 'Unacknowledged after interruption', expectedUpdatedAt: 'old-time' };
    await retainPendingVisionWrite(account, anchor, 'patch', path, body);
    const snapshotBeforeClaim = disk.get(keyFor(account, anchor));
    expect((await takePendingVisionWrites(account, anchor))[0].body).toEqual(body);
    expect(disk.get(keyFor(account, anchor))).toBe(snapshotBeforeClaim);
    expect(await takePendingVisionWrites(account, anchor)).toEqual([]);
    releasePendingVisionWrites(account, anchor);
    expect((await takePendingVisionWrites(account, anchor))[0].body).toEqual(body);
  });

  it('releases its in-memory claim when encrypted reading fails so a later refresh can recover', async () => {
    await retainPendingVisionWrite(account, anchor, 'patch', path, { caption: 'Retry after read recovery' });
    storage.getItem.mockRejectedValueOnce(new Error('Encrypted vault read failed'));
    await expect(takePendingVisionWrites(account, anchor)).rejects.toThrow('Encrypted vault read failed');
    expect((await takePendingVisionWrites(account, anchor)).map(write => write.body.caption)).toEqual(['Retry after read recovery']);
  });

  it('retains more than 32 independent offline edits without discarding the earliest content', async () => {
    const paths = Array.from({ length: 40 }, (_, i) => `${path}-${i}`);
    for (const [i, editedPath] of paths.entries())
      await retainPendingVisionWrite(account, anchor, 'patch', editedPath, { caption: `Offline caption ${i}` });
    const durable = JSON.parse(disk.get(keyFor(account, anchor))!).writes;
    expect(durable).toHaveLength(40);
    expect(durable[0]).toMatchObject({ path: paths[0], body: { caption: 'Offline caption 0' } });
    const claimed = await takePendingVisionWrites(account, anchor);
    expect(claimed.map(write => write.path)).toEqual(paths);
    expect(claimed[0].body).toEqual({ caption: 'Offline caption 0' });
    expect(JSON.parse(disk.get(keyFor(account, anchor))!).writes).toHaveLength(40);
  });

  it('restores every valid edit from an existing encrypted backlog larger than 32', async () => {
    const writes = Array.from({ length: 40 }, (_, i) => ({
      id: `stored-write-${i}`, method: 'patch', path: `${path}-${i}`, body: { caption: `Restored caption ${i}` },
    }));
    disk.set(keyFor(account, anchor), JSON.stringify({ version: 1, accountId: account, anchorId: anchor, writes }));
    expect(await takePendingVisionWrites(account, anchor)).toEqual(writes);
    expect(JSON.parse(disk.get(keyFor(account, anchor))!).writes).toEqual(writes);
  });
});
