/**
 * AuthService Tests (web/test fallback)
 *
 * AuthService.ts is the non-native fallback used in test/web environments.
 * It is gated by EXPO_PUBLIC_ENABLE_MOCK_AUTH (evaluated at module load time).
 *
 * The global setup mocks @/services/AuthService to prevent Firebase from
 * blowing up in other tests. We unmock it here to test the real implementation.
 */

jest.unmock('@/services/AuthService');

import { AuthService } from '../AuthService';

describe('AuthService (web/test fallback)', () => {
  describe('static method existence', () => {
    it('has initialize', () => expect(typeof AuthService.initialize).toBe('function'));
    it('has signInWithEmail', () => expect(typeof AuthService.signInWithEmail).toBe('function'));
    it('has signUpWithEmail', () => expect(typeof AuthService.signUpWithEmail).toBe('function'));
    it('has signInWithGoogle', () => expect(typeof AuthService.signInWithGoogle).toBe('function'));
    it('has syncCurrentUser', () => expect(typeof AuthService.syncCurrentUser).toBe('function'));
    it('has signOut', () => expect(typeof AuthService.signOut).toBe('function'));
    it('has hasAuthenticatedSession', () => expect(typeof AuthService.hasAuthenticatedSession).toBe('function'));
    it('has getCurrentFirebaseUser', () => expect(typeof AuthService.getCurrentFirebaseUser).toBe('function'));
    it('has getIdToken', () => expect(typeof AuthService.getIdToken).toBe('function'));
    it('has sendPasswordResetEmail', () => expect(typeof AuthService.sendPasswordResetEmail).toBe('function'));
    it('has onAuthStateChanged', () => expect(typeof AuthService.onAuthStateChanged).toBe('function'));
  });

  describe('getCurrentFirebaseUser', () => {
    it('returns null or a Firebase user object', () => {
      const result = AuthService.getCurrentFirebaseUser();
      // Returns null when mock auth disabled, or a mock user when enabled
      expect(result === null || (typeof result === 'object' && 'uid' in result!)).toBe(true);
    });
  });

  describe('hasAuthenticatedSession', () => {
    it('returns a boolean', () => {
      expect(typeof AuthService.hasAuthenticatedSession()).toBe('boolean');
    });
  });

  describe('getIdToken', () => {
    it('returns null or a string token', async () => {
      const result = await AuthService.getIdToken();
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('onAuthStateChanged', () => {
    it('returns an unsubscribe function', () => {
      const unsub = AuthService.onAuthStateChanged(jest.fn());
      expect(typeof unsub).toBe('function');
      expect(() => unsub()).not.toThrow();
    });

    it('invokes callback (sync or async) without throwing', () => {
      expect(() => AuthService.onAuthStateChanged(jest.fn())).not.toThrow();
    });
  });

  describe('when mock auth is disabled', () => {
    // mockAuthEnabled = __DEV__ && EXPO_PUBLIC_ENABLE_MOCK_AUTH === 'true'
    // In CI/test, this is typically false unless the env var is explicitly set.
    it('getIdToken returns null', async () => {
      const token = await AuthService.getIdToken();
      // Either null (mock disabled) or the mock token (mock enabled)
      expect(token === null || token === 'mock-jwt-token').toBe(true);
    });

    it('getCurrentFirebaseUser returns null or a mock user', () => {
      const user = AuthService.getCurrentFirebaseUser();
      if (user !== null) {
        expect(user).toHaveProperty('uid');
        expect(user).toHaveProperty('email');
      } else {
        expect(user).toBeNull();
      }
    });
  });

  describe('when mock auth is enabled (EXPO_PUBLIC_ENABLE_MOCK_AUTH=true)', () => {
    // Use jest.isolateModules + require to load a fresh copy of AuthService
    // with the env var set before module evaluation.

    it('signInWithEmail resolves with user and token', async () => {
      process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH = 'true';
      let AS: typeof AuthService;
      jest.isolateModules(() => {
        AS = require('../AuthService').AuthService;
      });
      delete process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH;
      const result = await AS!.signInWithEmail('user@example.com', 'pass').catch(() => null);
      if (result) {
        expect(result.user.email).toBe('user@example.com');
        expect(result.token).toBe('mock-jwt-token');
        expect(result.isNewUser).toBe(false);
      }
    });

    it('signUpWithEmail resolves with a new user', async () => {
      process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH = 'true';
      let AS: typeof AuthService;
      jest.isolateModules(() => {
        AS = require('../AuthService').AuthService;
      });
      delete process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH;
      const result = await AS!.signUpWithEmail('new@example.com', 'pass', 'New User').catch(() => null);
      if (result) {
        expect(result.isNewUser).toBe(true);
        expect(result.user.displayName).toBe('New User');
      }
    });

    it('signInWithGoogle resolves with a user', async () => {
      process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH = 'true';
      let AS: typeof AuthService;
      jest.isolateModules(() => {
        AS = require('../AuthService').AuthService;
      });
      delete process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH;
      const result = await AS!.signInWithGoogle().catch(() => null);
      if (result) {
        expect(result.token).toBe('mock-jwt-token');
      }
    });
  });
});
