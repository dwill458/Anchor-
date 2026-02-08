/**
 * Anchor App - Authentication Service (MOCK MODE)
 *
 * Mocked version to bypass native Firebase dependencies in Expo Go.
 */

import type { User, FirebaseUser } from '@/types';

export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'mock-uid-123',
  email: 'guest@example.com',
  displayName: 'Guest User',
  subscriptionStatus: 'free',
  totalAnchorsCreated: 5,
  totalActivations: 20,
  currentStreak: 3,
  longestStreak: 5,
  createdAt: new Date(),
  ...overrides,
});

export class AuthService {
  static initialize(): void {
    console.log('AuthService (Mock) initialized');
  }

  static async signInWithEmail(email: string, _password: string): Promise<AuthResult> {
    console.log('Mock signInWithEmail', email);
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      user: createMockUser({ email }),
      token: 'mock-jwt-token',
      isNewUser: false
    };
  }

  static async signUpWithEmail(
    email: string,
    _password: string,
    displayName?: string
  ): Promise<AuthResult> {
    console.log('Mock signUpWithEmail', email);
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      user: createMockUser({
        id: 'mock-uid-new',
        email,
        displayName: displayName || 'New User',
        totalAnchorsCreated: 0,
        totalActivations: 0,
        currentStreak: 0,
        longestStreak: 0,
      }),
      token: 'mock-jwt-token',
      isNewUser: true
    };
  }

  static async signInWithGoogle(): Promise<AuthResult> {
    console.log('Mock signInWithGoogle');
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      user: createMockUser({
        id: 'mock-uid-google',
        email: 'google-user@example.com',
        displayName: 'Google Guest',
      }),
      token: 'mock-jwt-token',
      isNewUser: false
    };
  }

  static async signOut(): Promise<void> {
    console.log('Mock signOut');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  static getCurrentFirebaseUser(): FirebaseUser | null {
    return {
      uid: 'mock-uid-123',
      email: 'guest@example.com',
      displayName: 'Guest User',
    };
  }

  static async getIdToken(): Promise<string> {
    return 'mock-jwt-token';
  }

  static async sendPasswordResetEmail(email: string): Promise<void> {
    console.log('Mock sendPasswordResetEmail', email);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  static onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    setTimeout(() => callback(null), 1000);
    return () => { };
  }
}
