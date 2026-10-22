const mockDisk = new Map<string, string>();
jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockDisk.delete(key); }),
  },
  readSecureValue: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
  writeSecureValue: jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); }),
}));
import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

const key = 'anchor-vault-storage';
const a = createMockUser({ id: 'synthetic-owner-a' });
const b = createMockUser({ id: 'synthetic-owner-b' });

describe('durable ownership partitions', () => {
  beforeEach(async () => {
    await useAnchorStore.persist.rehydrate();
    await useAuthStore.persist.rehydrate();
    useAuthStore.setState({ user: null, pendingFirstAnchorDraft: null, pendingFirstAnchorMutations: [], pendingFirstAnchorAccounts: {} });
    useAnchorStore.setState({ partitions: {}, guestTransfers: {}, activeScope: 'guest', anchors: [],
      persistedHydrated: true, persistenceRecoveryRequired: false, currentAnchorId: undefined });
    mockDisk.clear();
    (encryptedPersistStorage.setItem as jest.Mock).mockImplementation(async (k, v) => { mockDisk.set(k, v); });
  });

  it('restores A from persisted bytes after discarding every in-memory partition', async () => {
    useAuthStore.getState().setSession(a, 'synthetic-a');
    const anchor = createMockAnchor({ id: 'synthetic-unsynced', userId: a.id, chargeCount: 3 });
    useAnchorStore.getState().setAnchors([anchor]);
    await useAnchorStore.getState().flushPersistence();
    useAuthStore.getState().setSession(b, 'synthetic-b');
    const bytes = mockDisk.get(key)!;
    expect(JSON.parse(bytes).state.anchors).toHaveLength(1);
    useAnchorStore.setState({ partitions: {}, guestTransfers: {}, anchors: [], persistedHydrated: false });
    mockDisk.set(key, bytes);
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().anchors).toEqual([]);
    useAuthStore.getState().setSession(a, 'synthetic-a');
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
  });

  it.each([0, 2, 72])('imports %i legacy records without changing their identities or private content', async (count) => {
    const anchors = Array.from({ length: count }, (_, index) => createMockAnchor({
      id: `synthetic-legacy-${index}`, userId: a.id, baseSigilSvg: 'S'.repeat(9000),
    }));
    useAuthStore.getState().setSession(a, 'synthetic-a');
    useAnchorStore.setState({ partitions: {}, anchors: [], persistedHydrated: false });
    mockDisk.set(key, JSON.stringify({ state: { anchors }, version: 0 }));
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().anchors).toEqual(anchors);
    expect(JSON.parse(mockDisk.get(key)!).state.anchors).toEqual(JSON.parse(JSON.stringify(anchors)));
  });

  it('quarantines uncertain legacy ownership and preserves the source', async () => {
    const anchors = [createMockAnchor({ userId: a.id }), createMockAnchor({ id: 'ambiguous', userId: '' })];
    const source = JSON.stringify({ state: { anchors }, version: 0 });
    useAnchorStore.setState({ partitions: {}, anchors: [], persistedHydrated: false });
    mockDisk.set(key, source);
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().persistenceRecoveryRequired).toBe(true);
    expect(useAnchorStore.getState().anchors).not.toContainEqual(expect.objectContaining({ id: 'ambiguous' }));
    expect(mockDisk.get(key)).toBe(source);
  });

  it('restores saved dates and selection for the proven legacy owner', async () => {
    const anchor = createMockAnchor({ id: 'legacy-selected', userId: a.id });
    useAuthStore.getState().setSession(a, 'synthetic-a');
    useAnchorStore.setState({ partitions: {}, anchors: [], persistedHydrated: false });
    mockDisk.set(key, JSON.stringify({ state: { anchors: [anchor], currentAnchorId: anchor.id,
      primeStreak: 3, lastPrimedDate: '2026-10-12', lastSyncedAt: '2026-10-12T10:00:00Z' }, version: 0 }));
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().lastPrimedDate).toBe('2026-10-12');
    expect(useAnchorStore.getState().lastSyncedAt).toEqual(new Date('2026-10-12T10:00:00Z'));
    useAuthStore.getState().setSession(b, 'synthetic-b');
    useAuthStore.getState().setSession(a, 'synthetic-a');
    expect(useAnchorStore.getState().currentAnchorId).toBe(anchor.id);
    expect(useAnchorStore.getState().primeStreak).toBe(3);
  });

  it('a late A update cannot erase or expose data in B', () => {
    useAuthStore.getState().setSession(b, 'synthetic-b');
    const own = createMockAnchor({ id: 'synthetic-b-private', userId: b.id });
    useAnchorStore.getState().setAnchors([own]);
    useAnchorStore.getState().setAnchors([createMockAnchor({ userId: a.id })]);
    expect(useAnchorStore.getState().anchors).toEqual([own]);
  });

  it('binds a guest draft and its pending mutations to A, keeps it through B, and returns it to A', () => {
    const guest = createMockAnchor({ id: 'pending-first-anchor-synthetic', userId: 'guest' });
    useAnchorStore.getState().setAnchors([guest]);
    useAuthStore.getState().setPendingFirstAnchorDraft({ tempAnchorId: guest.id, source: 'onboarding_first_anchor',
      requiresAccountGate: true, createdAt: guest.createdAt, nextPendingMutationIndex: 1 });
    useAuthStore.getState().enqueuePendingFirstAnchorMutation({ type: 'charge_anchor', tempAnchorId: guest.id,
      chargeType: 'initial_quick', durationSeconds: 30, queuedAt: '2026-10-13T00:00:00Z' });
    useAuthStore.getState().setSession(a, 'synthetic-a');
    expect(useAnchorStore.getState().anchors).toEqual([guest]);
    useAuthStore.getState().setSession(b, 'synthetic-b');
    expect(useAnchorStore.getState().anchors).toEqual([]);
    expect(useAuthStore.getState().pendingFirstAnchorDraft).toBeNull();
    useAuthStore.getState().setSession(a, 'synthetic-a');
    expect(useAnchorStore.getState().anchors).toEqual([guest]);
    expect(useAuthStore.getState().pendingFirstAnchorDraft?.nextPendingMutationIndex).toBe(1);
    expect(useAuthStore.getState().pendingFirstAnchorMutations).toHaveLength(1);
  });

  it('reports a failed write and leaves the last durable record recoverable', async () => {
    useAuthStore.getState().setSession(a, 'synthetic-a');
    useAnchorStore.getState().setAnchors([createMockAnchor({ userId: a.id })]);
    const saved = mockDisk.get(key);
    (encryptedPersistStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('synthetic write failed'));
    useAnchorStore.getState().updateAnchor('test-anchor-123', { intentionText: 'new unsaved edit' });
    await expect(useAnchorStore.getState().flushPersistence()).rejects.toThrow('synthetic write failed');
    expect(useAnchorStore.getState().persistenceRecoveryRequired).toBe(true);
    expect(mockDisk.get(key)).toBe(saved);
  });

  it('retains a timestamp-conflict recovery copy across complete memory loss and isolates it from B', async () => {
    useAuthStore.getState().setSession(a, 'synthetic-a');
    const original = createMockAnchor({ id: 'synthetic-recovered-writing', userId: a.id,
      intentionText: 'Synthetic original local writing', activationCount: 7 });
    useAnchorStore.getState().setAnchors([{ ...original, intentionText: 'Synthetic current server writing',
      localReconciliation: { recoveryCopy: original } }]);
    await useAnchorStore.getState().flushPersistence();
    useAuthStore.getState().setSession(b, 'synthetic-b');
    const bytes = mockDisk.get(key)!;
    useAnchorStore.setState({ partitions: {}, guestTransfers: {}, anchors: [], persistedHydrated: false });
    mockDisk.set(key, bytes);
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(original.id)).toBeUndefined();
    useAuthStore.getState().setSession(a, 'synthetic-a');
    expect(useAnchorStore.getState().getLocalRecoveryAnchor(original.id)).toEqual(original);
    expect(useAnchorStore.getState().getAnchorById(original.id)?.intentionText).toBe('Synthetic current server writing');
  });
});
