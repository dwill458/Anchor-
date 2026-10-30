const mockPost = jest.fn();
const mockGet = jest.fn();
const mockEnsureGuest = jest.fn(async (): Promise<{ user: { id: string }; token: string; isAnonymous?: boolean }> =>
  ({ user: { id: 'guest-db-user' }, token: 'verified-guest', isAnonymous: true }));
let mockAuth = { accountRevision: 1, user: null as { id: string } | null, token: null as string | null, isAuthenticated: false };
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock('@/services/ApiClient', () => ({ apiClient: {
  post: (...args: unknown[]) => mockPost(...args), get: (...args: unknown[]) => mockGet(...args),
} }));
jest.mock('@/services/AuthService', () => ({ AuthService: { ensureGuestSession: () => mockEnsureGuest() } }));
import { generateAuthorizedAnchor } from '../AnchorCreationSession';

const body = { sigilSvg: '<svg/>', styleChoice: 'cosmic', intentionText: 'I focus' };
beforeEach(() => { mockPost.mockReset(); mockGet.mockReset(); mockEnsureGuest.mockClear();
  mockAuth = { accountRevision: 1, user: null, token: null, isAuthenticated: false }; });
it('reserves with verified guest identity and reuses the session after a lost generation response', async () => {
  mockPost.mockImplementation(async (url: string) => {
    if (url.endsWith('creation-sessions')) return { data: { creationSessionId: 'server-session' } };
    throw new Error('Network unavailable');
  });
  await expect(generateAuthorizedAnchor(body, 'draft-round-1')).rejects.toThrow('Network unavailable');
  mockPost.mockImplementation(async (url: string) => ({ data: url.endsWith('creation-sessions') ?
    { creationSessionId: 'server-session' } : { variations: [{ imageUrl: 'https://cdn.test/one', optionId: 'one' }] } }));
  await generateAuthorizedAnchor(body, 'draft-round-1');
  expect(mockEnsureGuest).toHaveBeenCalledTimes(2);
  const reservations = mockPost.mock.calls.filter(call => call[0].endsWith('creation-sessions'));
  expect(reservations).toHaveLength(2);
  expect(reservations[0][2].headers['Idempotency-Key']).toBe(reservations[1][2].headers['Idempotency-Key']);
  expect(mockPost.mock.calls[3][1]).toMatchObject({ creationSessionId: 'server-session' });
});
it('creates a new reservation only when a new interpretation set is requested', async () => {
  mockPost.mockImplementation(async (url: string) => ({ data: url.endsWith('creation-sessions') ?
    { creationSessionId: `session-${mockPost.mock.calls.length}` } : { variations: [] } }));
  await generateAuthorizedAnchor(body, 'draft-round-1');
  await generateAuthorizedAnchor(body, 'draft-round-2');
  const reservations = mockPost.mock.calls.filter(call => call[0].endsWith('creation-sessions'));
  expect(reservations).toHaveLength(2);
  expect(reservations[0][2].headers['Idempotency-Key']).not.toBe(reservations[1][2].headers['Idempotency-Key']);
});
it('keeps the same session binding when a guest links to an existing account', async () => {
  mockPost.mockImplementation(async (url: string) => ({ data: url.endsWith('creation-sessions') ?
    { creationSessionId: 'preserved-session' } : { variations: [] } }));
  await generateAuthorizedAnchor(body, 'persisted-flow-key');
  mockEnsureGuest.mockResolvedValueOnce({ user: { id: 'existing-account' }, token: 'linked-token' });
  await generateAuthorizedAnchor(body, 'persisted-flow-key');
  const reservations = mockPost.mock.calls.filter(call => call[0].endsWith('creation-sessions'));
  expect(reservations[0][1]).toEqual(reservations[1][1]);
  expect(reservations[0][2].headers['Idempotency-Key']).toBe(reservations[1][2].headers['Idempotency-Key']);
  expect(reservations[1][2].anchorAuthToken).toBe('linked-token');
});
it('recovers durable partial output when the second option cannot be generated', async () => {
  mockPost.mockImplementation(async (url: string) => {
    if (url.endsWith('creation-sessions')) return { data: { creationSessionId: 'partial-session' } };
    throw new Error('Recovery attempts exhausted');
  });
  mockGet.mockResolvedValue({ data: { variations: [{ optionId: 'durable-option', imageUrl: 'https://cdn.test/partial' }] } });
  const result = await generateAuthorizedAnchor(body, 'partial-flow');
  expect(result.variations?.[0].optionId).toBe('durable-option');
  expect(mockGet).toHaveBeenCalledWith('/api/ai/creation-sessions/partial-session', expect.objectContaining({ anchorAuthToken: 'verified-guest' }));
});
it('stops before reservation if an A to B to A switch occurs while identity is resolving', async () => {
  let resolveIdentity!: (value: { user: { id: string }; token: string }) => void;
  mockEnsureGuest.mockImplementationOnce(() => new Promise(resolve => { resolveIdentity = resolve; }));
  const operation = generateAuthorizedAnchor(body, 'switched-flow');
  mockAuth.accountRevision += 2;
  resolveIdentity({ user: { id: 'guest-db-user' }, token: 'verified-guest' });
  await expect(operation).rejects.toThrow('Authentication context changed');
  expect(mockPost).not.toHaveBeenCalled();
});
it('does not return late generation output after a token/account revision changes', async () => {
  mockPost.mockImplementation(async (url: string) => {
    if (url.endsWith('creation-sessions')) return { data: { creationSessionId: 'session' } };
    mockAuth.accountRevision += 2;
    return { data: { variations: [{ imageUrl: 'https://cdn.test/late' }] } };
  });
  await expect(generateAuthorizedAnchor(body, 'late-flow')).rejects.toThrow('Authentication context changed');
  expect(mockGet).not.toHaveBeenCalled();
});
it('does not borrow a Firebase identity that switched before authStore finished updating', async () => {
  mockAuth = { accountRevision: 1, user: { id: 'account-a' }, token: 'token-a', isAuthenticated: true };
  mockEnsureGuest.mockResolvedValueOnce({ user: { id: 'account-b' }, token: 'token-b' });
  await expect(generateAuthorizedAnchor(body, 'identity-race')).rejects.toThrow('Authentication context changed');
  expect(mockPost).not.toHaveBeenCalled();
});
it('does not treat a registered Firebase session as the guest while authStore is still restoring', async () => {
  mockEnsureGuest.mockResolvedValueOnce({ user: { id: 'registered-account' }, token: 'registered-token', isAnonymous: false });
  await expect(generateAuthorizedAnchor(body, 'guest-identity-race')).rejects.toThrow('Authentication context changed');
  expect(mockPost).not.toHaveBeenCalled();
});
it('does not share an in-flight reservation between two verified owners', async () => {
  let releaseA!: (value: { data: { creationSessionId: string } }) => void;
  mockEnsureGuest.mockResolvedValueOnce({ user: { id: 'account-a' }, token: 'token-a' })
    .mockResolvedValueOnce({ user: { id: 'account-b' }, token: 'token-b' });
  mockPost.mockImplementation(async (url: string, _body: unknown, config: { anchorAuthToken: string }) => {
    if (!url.endsWith('creation-sessions')) return { data: { variations: [] } };
    if (config.anchorAuthToken === 'token-a') return new Promise(resolve => { releaseA = resolve; });
    return { data: { creationSessionId: 'session-b' } };
  });
  const first = generateAuthorizedAnchor(body, 'shared-device-flow');
  await Promise.resolve(); await Promise.resolve();
  mockAuth.accountRevision += 1;
  const second = await generateAuthorizedAnchor(body, 'shared-device-flow');
  expect(second.creationSessionId).toBe('session-b');
  expect(mockPost.mock.calls.filter(call => call[0].endsWith('creation-sessions'))).toHaveLength(2);
  releaseA({ data: { creationSessionId: 'session-a' } });
  await expect(first).rejects.toThrow('Authentication context changed');
});
