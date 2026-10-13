/** Release gate: intentionally remains red until a durable account handoff is approved.
 * Real Zustand/store/hydration code, isolated in-memory storage; no native or network access.
 */
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
const mockGet = jest.fn();
const mockProfile = jest.fn();
jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
  fetchCompleteProfile: (...args: unknown[]) => mockProfile(...args),
}));
import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import AuthHydrationService from '@/services/AuthHydrationService';
import { loadAnchorSnapshot } from '@/services/UserLocalStateService';

describe('Account A durable retention release gate', () => {
  beforeEach(async () => {
    await useAnchorStore.persist.rehydrate();
    await useAuthStore.persist.rehydrate();
    mockDisk.clear();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false,
      pendingFirstAnchorDraft: null, pendingFirstAnchorMutations: [] });
    useAnchorStore.getState().clearAnchors();
    mockGet.mockReset();
    mockProfile.mockReset();
  });

  it.each([
    ['setSession', 'success'], ['setSession', 'failure'],
    ['setUser', 'success'], ['setUser', 'failure'],
  ] as const)('%s A -> B (%s hydration) -> restart -> offline A retains unsynced content', async (method, hydration) => {
    const a = createMockUser({ id: 'synthetic-retention-a' });
    const b = createMockUser({ id: 'synthetic-retention-b' });
    const privateAnchor = createMockAnchor({ id: 'unsynced-only-a', userId: a.id,
      intentionText: 'SYNTHETIC PRIVATE A', updatedAt: new Date('2026-10-13T10:00:00Z') });
    const switchTo = (user: typeof a) => method === 'setSession'
      ? useAuthStore.getState().setSession(user, `synthetic-token-${user.id}`)
      : useAuthStore.getState().setUser(user);
    switchTo(a);
    useAnchorStore.getState().setAnchors([privateAnchor]);
    expect(JSON.parse(mockDisk.get('anchor-vault-storage')!).state.anchors[0].id).toBe(privateAnchor.id);
    switchTo(b);
    expect(useAnchorStore.getState().anchors.some((anchor) => anchor.userId === a.id)).toBe(false);
    if (hydration === 'success') {
      mockProfile.mockResolvedValue({ user: b, stats: {}, activeAnchors: [] });
      mockGet.mockResolvedValue({ data: { success: true, data: [] } });
    } else {
      mockProfile.mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));
      mockGet.mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));
    }
    await AuthHydrationService.hydrateAuthenticatedData().catch(() => undefined);
    expect(useAnchorStore.getState().anchors.some((anchor) => anchor.userId === a.id)).toBe(false);
    // Simulate loss of process memory and reload the captured persisted bytes with real middleware.
    // This is not a native app kill; the native restart remains a separate gate.
    const vaultAfterSwitch = mockDisk.get('anchor-vault-storage')!;
    useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
    mockDisk.set('anchor-vault-storage', vaultAfterSwitch);
    await useAnchorStore.persist.rehydrate();
    switchTo(a);
    mockProfile.mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));
    mockGet.mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));
    await AuthHydrationService.hydrateAuthenticatedData().catch(() => undefined);
    const snapshot = await loadAnchorSnapshot(a.id);
    const recoverable = [...useAnchorStore.getState().anchors, ...(snapshot?.anchors ?? [])];
    expect(recoverable).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: privateAnchor.id, userId: a.id, intentionText: 'SYNTHETIC PRIVATE A' }),
    ]));
    expect(useAnchorStore.getState().anchors.some((anchor) => anchor.userId === b.id)).toBe(false);
  });
});
