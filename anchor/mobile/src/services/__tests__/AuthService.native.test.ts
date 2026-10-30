jest.unmock('../AuthService.native');
jest.mock('@react-native-firebase/auth', () => {
  const instance = { currentUser: null, signInAnonymously: jest.fn(), signInWithEmailAndPassword: jest.fn(), signInWithCredential: jest.fn(), signOut: jest.fn(), createUserWithEmailAndPassword: jest.fn(), onAuthStateChanged: jest.fn() };
  const factory = Object.assign(jest.fn(() => instance), { EmailAuthProvider: { credential: jest.fn(() => ({ providerId: 'password' })) }, GoogleAuthProvider: { credential: jest.fn(() => ({ providerId: 'google.com' })) }, AppleAuthProvider: { credential: jest.fn(() => ({ providerId: 'apple.com' })) } });
  return { __esModule: true, default: factory };
});
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), signInAsync: jest.fn().mockResolvedValue({ identityToken: 'apple-token' }), AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } }));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'google-token' } }) } }));
jest.mock('@/config', () => ({ API_URL: 'https://isolated.test', ENABLE_GOOGLE_SIGN_IN: true, GOOGLE_WEB_CLIENT_ID: 'fixture-client' }));
jest.mock('@/stores/encryptedPersistStorage', () => ({ writeSecureValue: jest.fn().mockResolvedValue(undefined), readSecureValue: jest.fn(), encryptedPersistStorage: { removeItem: jest.fn() } }));
jest.mock('@/services/NotificationSessionService', () => ({ clearNotificationSession: jest.fn() }));
jest.mock('@/services/NotificationSyncService', () => ({ clearPushTokensFromServer: jest.fn() }));

import auth from '@react-native-firebase/auth';
import { AuthService } from '../AuthService.native';
import { readSecureValue, writeSecureValue, encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

const instance = auth() as any;
const guest = () => ({ uid: 'persistent-guest', isAnonymous: true, email: null, providerData: [], getIdToken: jest.fn().mockResolvedValue('verified-token'), linkWithCredential: jest.fn(), updateProfile: jest.fn(), reload: jest.fn() });
beforeEach(() => {
  jest.clearAllMocks();
  instance.currentUser = null;
  (readSecureValue as jest.Mock).mockResolvedValue(null);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { id: 'same-db-user', email: 'persistent-guest@guest.anchor.invalid', totalAnchorsCreated: 1, createdAt: '2026-10-29' } }) });
});

it('preserves durable guest proof before an existing-account sign-in and merges before returning', async () => {
  const user = guest();
  instance.currentUser = user;
  const registered = { ...guest(), uid: 'registered', isAnonymous: false };
  let pending: string | null = null;
  (readSecureValue as jest.Mock).mockImplementation(async (key: string) => key === 'anchor:pending_guest_transfer' ? pending : null);
  (writeSecureValue as jest.Mock).mockImplementation(async (key: string, value: string) => { if (key === 'anchor:pending_guest_transfer') pending = value; });
  instance.signInWithEmailAndPassword.mockImplementation(async () => {
    expect(pending).toContain('durable-proof');
    instance.currentUser = registered;
    return { user: registered };
  });
  (fetch as jest.Mock).mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('guest-transfer-token')
    ? { success: true, data: { guestUid: user.uid, transferToken: 'durable-proof' } }
    : { success: true, data: { id: 'registered-db', createdAt: '2026-10-29' } } }));
  const result = await AuthService.signInWithEmail('existing@example.com', 'password');
  expect(result.user.id).toBe('registered-db');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/merge-guest'), expect.objectContaining({ body: JSON.stringify({ guestUid: user.uid, transferToken: 'durable-proof' }) }));
  expect(encryptedPersistStorage.removeItem).toHaveBeenCalledWith('anchor:pending_guest_transfer');
});

it('keeps the guest identity if preserving transfer proof fails before login', async () => {
  instance.currentUser = guest();
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) });
  await expect(AuthService.signInWithEmail('existing@example.com', 'password')).rejects.toThrow('Reconnect');
  expect(instance.signInWithEmailAndPassword).not.toHaveBeenCalled();
  expect(instance.signOut).not.toHaveBeenCalled();
  expect(instance.currentUser.uid).toBe('persistent-guest');
});

it.each(['Google', 'Apple'] as const)('merges guest progress when %s credentials already belong to an existing account', async (provider) => {
  const user = guest();
  instance.currentUser = user;
  user.linkWithCredential.mockRejectedValue({ code: 'auth/credential-already-in-use' });
  const registered = { ...guest(), uid: 'registered-social', isAnonymous: false };
  let pending: string | null = null;
  (readSecureValue as jest.Mock).mockImplementation(async (key: string) => key === 'anchor:pending_guest_transfer' ? pending : null);
  (writeSecureValue as jest.Mock).mockImplementation(async (key: string, value: string) => { if (key === 'anchor:pending_guest_transfer') pending = value; });
  instance.signInWithCredential.mockImplementation(async () => { instance.currentUser = registered; return { user: registered }; });
  (fetch as jest.Mock).mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('guest-transfer-token')
    ? { success: true, data: { guestUid: user.uid, transferToken: 'social-proof' } }
    : { success: true, data: { id: 'registered-db', createdAt: '2026-10-29' } } }));
  const result = await AuthService[`signInWith${provider}`]();
  expect(result.user.id).toBe('registered-db');
  expect(user.linkWithCredential).toHaveBeenCalledTimes(1);
  expect(instance.signInWithCredential).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/merge-guest'), expect.objectContaining({ body: JSON.stringify({ guestUid: user.uid, transferToken: 'social-proof' }) }));
  expect(instance.signOut).not.toHaveBeenCalled();
});
it('deduplicates guest sign-in and reuses the native persistent identity', async () => {
  const user = guest();
  instance.signInAnonymously.mockImplementation(async () => { instance.currentUser = user; return { user }; });
  const results = await Promise.all([AuthService.ensureGuestSession(), AuthService.ensureGuestSession()]);
  expect(instance.signInAnonymously).toHaveBeenCalledTimes(1);
  expect(results[0].token).toBe('verified-token');
  expect(results[0].isAnonymous).toBe(true);
  await AuthService.ensureGuestSession();
  expect(instance.signInAnonymously).toHaveBeenCalledTimes(1);
});
it('keeps guest credentials available without presenting a registered UI session', async () => {
  instance.currentUser = guest();
  expect(AuthService.hasAuthenticatedSession()).toBe(false);
  expect(AuthService.getCurrentFirebaseUser()).toBeNull();
  expect(await AuthService.getIdToken()).toBe('verified-token');
  expect(await AuthService.syncCurrentUser()).toBeNull();
});
it('links signup credentials to the guest UID and retains the backend account', async () => {
  const user = guest();
  instance.currentUser = user;
  user.linkWithCredential.mockImplementation(async () => { user.isAnonymous = false; return { user }; });
  const result = await AuthService.signUpWithEmail('person@example.com', 'password');
  expect(user.linkWithCredential).toHaveBeenCalledTimes(1);
  expect(instance.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  expect(result.user.id).toBe('same-db-user');
});
it('preserves the guest session after a credential collision', async () => {
  const user = guest();
  instance.currentUser = user;
  user.linkWithCredential.mockRejectedValue({ code: 'auth/credential-already-in-use' });
  await expect(AuthService.signUpWithEmail('existing@example.com', 'password')).rejects.toThrow();
  expect(instance.signOut).not.toHaveBeenCalled();
  expect(instance.currentUser.uid).toBe('persistent-guest');
});
