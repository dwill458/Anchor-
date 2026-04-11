/**
 * Anchor App - Authentication Service (web/test fallback)
 *
 * Native Firebase auth lives in AuthService.native.ts.
 * This file preserves mock auth for web and test environments where the
 * native module is unavailable.
 */

import type { User, FirebaseUser } from '@/types';

export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

export interface AuthSyncOptions {
  hasCompletedOnboarding?: boolean;
}

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'mock-uid-123',
  email: 'guest@example.com',
  displayName: 'Guest User',
  hasCompletedOnboarding: false,
  subscriptionStatus: 'free',
  totalAnchorsCreated: 5,
  totalActivations: 20,
  currentStreak: 3,
  longestStreak: 5,
  stabilizesTotal: 0,
  stabilizeStreakDays: 0,
  createdAt: new Date(),
  ...overrides,
});

const mockAuthEnabled = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH === 'true';

function assertMockAuthEnabled(): void {
  if (mockAuthEnabled) {
    return;
  }

  throw new Error(
    'Mock auth is disabled in this environment. Run a native build for Firebase auth, or enable EXPO_PUBLIC_ENABLE_MOCK_AUTH=true for local web-only development.'
  );
}

export class AuthService {
  static initialize(): void {
    if (!mockAuthEnabled && !__DEV__) {
      throw new Error('Firebase auth is only available in the native build. Web fallback is not configured for production.');
    }
  }

  static async signInWithEmail(
    email: string,
    _password: string,
    options?: AuthSyncOptions
  ): Promise<AuthResult> {
    assertMockAuthEnabled();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      user: createMockUser({
        email,
        hasCompletedOnboarding: options?.hasCompletedOnboarding ?? true,
      }),
      token: 'mock-jwt-token',
      isNewUser: false,
    };
  }

  static async signUpWithEmail(
    email: string,
    _password: string,
    displayName?: string,
    options?: AuthSyncOptions
  ): Promise<AuthResult> {
    assertMockAuthEnabled();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      user: createMockUser({
        id: 'mock-uid-new',
        email,
        displayName: displayName || 'New User',
        hasCompletedOnboarding: options?.hasCompletedOnboarding ?? false,
        totalAnchorsCreated: 0,
        totalActivations: 0,
        currentStreak: 0,
        longestStreak: 0,
      }),
      token: 'mock-jwt-token',
      isNewUser: true,
    };
  }

  static async signInWithGoogle(): Promise<AuthResult> {
    assertMockAuthEnabled();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      user: createMockUser({
        id: 'mock-uid-google',
        email: 'google-user@example.com',
        displayName: 'Google Guest',
        hasCompletedOnboarding: true,
      }),
      token: 'mock-jwt-token',
      isNewUser: false,
    };
  }

  static async syncCurrentUser(): Promise<AuthResult | null> {
    assertMockAuthEnabled();
    return {
      user: createMockUser({ hasCompletedOnboarding: true }),
      token: 'mock-jwt-token',
      isNewUser: false,
    };
  }

  static async signOut(): Promise<void> {
    assertMockAuthEnabled();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  static getCurrentFirebaseUser(): FirebaseUser | null {
    if (!mockAuthEnabled) {
      return null;
    }

    return {
      uid: 'mock-uid-123',
      email: 'guest@example.com',
      displayName: 'Guest User',
    };
  }

  static async getIdToken(): Promise<string | null> {
    if (!mockAuthEnabled) {
      return null;
    }

    return 'mock-jwt-token';
  }

  static async sendPasswordResetEmail(_email: string): Promise<void> {
    assertMockAuthEnabled();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  static onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    if (!mockAuthEnabled) {
      callback(null);
      return () => {};
    }

    setTimeout(() => callback(null), 0);
    return () => {};
  }
}
