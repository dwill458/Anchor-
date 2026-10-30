import type { Anchor } from '@/types';
import type { CreationDraft } from '@/stores/v2/creationStore';
import { useCreationStore } from '@/stores/v2/creationStore';
const mockPost = jest.fn();
let mockUserId: string | null = null;
const mockPending = { tempAnchorId: 'server-guest-anchor', ownerUserId: undefined as string | undefined };
jest.mock('@/services/ApiClient', () => ({ apiClient: { post: (...args: unknown[]) => mockPost(...args) }, ApiClientError: class extends Error {} }));
jest.mock('@/services/AuthService', () => ({ AuthService: { ensureGuestSession: async () => ({ user: { id: 'verified-guest-db-id' }, token: 'guest-token' }) } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({
  isAuthenticated: Boolean(mockUserId), user: mockUserId ? { id: mockUserId } : null, pendingFirstAnchorDraft: mockPending,
}) } }));
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorOwnerScope, GUEST_SCOPE, accountScope } from '@/stores/anchorOwnership';
import { persistCreatedAnchor } from '../creationPersistence';

const server: Anchor = { id: 'server-guest-anchor', userId: 'verified-guest-db-id', intentionText: 'I focus', category: 'career',
  distilledLetters: ['F', 'C', 'S'], baseSigilSvg: '<svg/>', structureVariant: 'balanced', isCharged: false,
  activationCount: 0, createdAt: new Date(), updatedAt: new Date(), classifierMeta: { v2Expression: 'original' } };
const draft = { draftId: 'guest-draft', intention: 'I focus', category: 'career', distilledLetters: ['F', 'C', 'S'],
  structureSvg: '<svg/>', expression: 'original' } as CreationDraft;

it('rehydrates the verified guest save in the guest vault and transfers only its authorized reference', async () => {
  jest.spyOn(useCreationStore.persist, 'hasHydrated').mockReturnValue(true);
  useCreationStore.setState({ draft });
  mockUserId = null;
  useAnchorStore.setState({ anchors: [], partitions: {}, guestTransfers: {}, activeScope: GUEST_SCOPE, persistedHydrated: false });
  mockPost.mockResolvedValue({ data: { success: true, data: server } });
  await persistCreatedAnchor({ draft, idempotencyKey: 'first-save' });
  const current = useAnchorStore.getState();
  expect(anchorOwnerScope(current.anchors[0])).toBe(GUEST_SCOPE);
  const options = useAnchorStore.persist.getOptions();
  const saved = JSON.parse(JSON.stringify(options.partialize!(current)));
  const restored = options.merge!(saved, { ...current, anchors: [], partitions: {}, guestTransfers: {} });
  expect(restored.anchors.map(anchor => anchor.id)).toEqual([server.id]);
  useAnchorStore.setState(restored);
  mockUserId = 'unrelated-account';
  useAnchorStore.getState().bindAccount(mockUserId);
  expect(useAnchorStore.getState().anchors).toHaveLength(0);
  mockUserId = 'linked-account';
  mockPending.ownerUserId = mockUserId;
  useAnchorStore.getState().bindAccount(mockUserId, server.id);
  expect(useAnchorStore.getState().anchors.map(anchor => anchor.id)).toEqual([server.id]);
  // The verified merge's canonical fetch is the only point that adopts server ownership.
  useAnchorStore.getState().applySyncedAnchor(server.id, { ...server, userId: mockUserId });
  expect(anchorOwnerScope(useAnchorStore.getState().anchors[0])).toBe(accountScope(mockUserId));
  expect(useAnchorStore.getState().guestTransfers[server.id]).toBe(mockUserId);
});
afterEach(() => { jest.restoreAllMocks(); });
