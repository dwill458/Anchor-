/**
 * Anchor App - Native Firebase Authentication Service
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config';
import {
  DEVELOPER_MASTER_ACCOUNT_ID,
  DEVELOPER_MASTER_ACCOUNT_TOKEN,
  isDeveloperMasterAccountEnabled,
} from '@/utils/developerMasterAccount';
import { logger } from '@/utils/logger';
import type { ApiResponse, FirebaseUser, User } from '@/types';

const CACHED_USER_KEY = 'anchor:cached_user';

export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

export interface AuthSyncOptions {
  hasCompletedOnboarding?: boolean;
}

type AuthProvider = 'email' | 'google' | 'apple';

function normalizeDate(value?: Date | string | null): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function normalizeUser(data: User): User {
  return {
    ...data,
    createdAt: normalizeDate(data.createdAt),
    stabilizesTotal: data.stabilizesTotal ?? 0,
    stabilizeStreakDays: data.stabilizeStreakDays ?? 0,
    lastStabilizeAt: data.lastStabilizeAt ? normalizeDate(data.lastStabilizeAt) : undefined,
  };
}

function toFirebaseUser(user: FirebaseAuthTypes.User): FirebaseUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

function providerIdToAuthProvider(providerId?: string | null): AuthProvider {
  switch (providerId) {
    case 'google.com':
      return 'google';
    case 'apple.com':
      return 'apple';
    default:
      return 'email';
  }
}

function getAuthProvider(user: FirebaseAuthTypes.User): AuthProvider {
  const providerId = user.providerData[0]?.providerId;
  return providerIdToAuthProvider(providerId);
}

function messageFromApiError(payload: ApiResponse<User> | { error?: unknown } | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const { error } = payload as { error?: unknown };
  if (typeof error === 'string') {
    return error;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return null;
}

function mapAuthError(error: unknown): Error {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return new Error('That email is already in use.');
    case 'auth/invalid-email':
      return new Error('Enter a valid email address.');
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new Error('Incorrect email or password.');
    case 'auth/weak-password':
      return new Error('Choose a stronger password.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Try again later.');
    case 'auth/network-request-failed':
      return new Error('Network error. Please check your connection.');
    default:
      return error instanceof Error ? error : new Error('Authentication failed.');
  }
}

async function syncUserWithBackend(
  firebaseUser: FirebaseAuthTypes.User,
  idToken: string,
  displayNameOverride?: string,
  options?: AuthSyncOptions
): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      displayName: displayNameOverride ?? firebaseUser.displayName ?? undefined,
      authProvider: getAuthProvider(firebaseUser),
      hasCompletedOnboarding: options?.hasCompletedOnboarding === true ? true : undefined,
    }),
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<User> | null;

  if (!response.ok || !payload?.success || !payload.data) {
    const apiMessage = messageFromApiError(payload);
    throw new Error(apiMessage ?? 'Failed to sync your account with the server.');
  }

  return normalizeUser(payload.data);
}

async function buildAuthResult(
  firebaseUser: FirebaseAuthTypes.User,
  displayNameOverride?: string,
  options?: AuthSyncOptions
): Promise<AuthResult> {
  const idToken = await firebaseUser.getIdToken();
  const user = await syncUserWithBackend(firebaseUser, idToken, displayNameOverride, options);

  return {
    user,
    token: idToken,
    isNewUser: !user.hasCompletedOnboarding,
  };
}

export class AuthService {
  static initialize(): void {
    auth();
  }

  static async signInWithEmail(
    email: string,
    password: string,
    options?: AuthSyncOptions
  ): Promise<AuthResult> {
    try {
      const credential = await auth().signInWithEmailAndPassword(email.trim(), password);
      return await buildAuthResult(credential.user, undefined, options);
    } catch (error) {
      logger.error('Failed to sign in with email', error);
      throw mapAuthError(error);
    }
  }

  static async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
    options?: AuthSyncOptions
  ): Promise<AuthResult> {
    try {
      const credential = await auth().createUserWithEmailAndPassword(email.trim(), password);
      const trimmedName = displayName?.trim();

      if (trimmedName) {
        await credential.user.updateProfile({ displayName: trimmedName });
        await credential.user.reload();
      }

      const currentUser = auth().currentUser ?? credential.user;
      return await buildAuthResult(currentUser, trimmedName, options);
    } catch (error) {
      logger.error('Failed to sign up with email', error);
      await auth().signOut().catch(() => undefined);
      throw mapAuthError(error);
    }
  }

  static async signInWithGoogle(): Promise<AuthResult> {
    throw new Error('Google sign-in is not configured yet.');
  }

  static async syncCurrentUser(): Promise<AuthResult | null> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      return null;
    }

    try {
      const result = await buildAuthResult(currentUser);
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(result.user)).catch(() => {});
      return result;
    } catch (error) {
      logger.error('Failed to sync current Firebase user', error);
      throw mapAuthError(error);
    }
  }

  static async getCachedUser(): Promise<User | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  static async signOut(): Promise<void> {
    await auth().signOut();
  }

  static hasAuthenticatedSession(): boolean {
    return auth().currentUser != null;
  }

  static getCurrentFirebaseUser(): FirebaseUser | null {
    const currentUser = auth().currentUser;
    if (currentUser) {
      return toFirebaseUser(currentUser);
    }

    if (!isDeveloperMasterAccountEnabled()) {
      return null;
    }

    return {
      uid: DEVELOPER_MASTER_ACCOUNT_ID,
      email: 'dev+master@anchor.local',
      displayName: 'Developer Master',
    };
  }

  static async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      return isDeveloperMasterAccountEnabled()
        ? DEVELOPER_MASTER_ACCOUNT_TOKEN
        : null;
    }

    return currentUser.getIdToken(forceRefresh);
  }

  static async sendPasswordResetEmail(email: string): Promise<void> {
    await auth().sendPasswordResetEmail(email.trim());
  }

  static async deleteAccount(): Promise<void> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('No user is currently signed in.');
    }

    try {
      const idToken = await currentUser.getIdToken();

      // Call backend to delete account records
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const apiMessage = messageFromApiError(payload);
        throw new Error(apiMessage ?? 'Failed to delete account from server.');
      }

      // Delete Firebase Auth account
      await currentUser.delete();

      logger.info('Account successfully deleted');
    } catch (error) {
      logger.error('Failed to delete account', error);
      throw error instanceof Error
        ? error
        : new Error('An unexpected error occurred while deleting your account.');
    }
  }

  static onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    return auth().onAuthStateChanged((user) => {
      callback(user ? toFirebaseUser(user) : null);
    });
  }
}
