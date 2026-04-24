/**
 * Anchor App - Native Firebase Authentication Service
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { API_URL } from '@/config';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config';

let GoogleSignin: any = null;
import {
  DEVELOPER_MASTER_ACCOUNT_ID,
  DEVELOPER_MASTER_ACCOUNT_TOKEN,
  isDeveloperMasterAccountEnabled,
} from '@/utils/developerMasterAccount';
import { logger } from '@/utils/logger';
import type { ApiResponse, FirebaseUser, User } from '@/types';

const CACHED_USER_KEY = 'anchor:cached_user';
let googleConfigured = false;

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

function generateNonce(length = 32): string {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  const values = new Uint32Array(length);
  const cryptoApi = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);

  if (cryptoApi) {
    cryptoApi(values);
  } else {
    for (let index = 0; index < length; index += 1) {
      values[index] = Math.floor(Math.random() * 0xffffffff);
    }
  }

  return Array.from(values, (value) => charset[value % charset.length]).join('');
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
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new Error('Incorrect email or password.');
    case 'auth/weak-password':
      return new Error('Choose a stronger password.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Try again later.');
    case 'auth/network-request-failed':
      return new Error('Network error. Please check your connection.');
    case 'auth/account-exists-with-different-credential':
      return new Error('An account already exists with a different sign-in method.');
    case 'auth/invalid-credential':
      return new Error('That sign-in credential is invalid or expired.');
    default:
      return error instanceof Error ? error : new Error('Authentication failed.');
  }
}

function configureGoogleSignin(): void {
  if (googleConfigured) {
    return;
  }

  if (!GoogleSignin) {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });

  googleConfigured = true;
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
    try {
      configureGoogleSignin();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') {
        throw new Error('Google sign-in was cancelled.');
      }

      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      const credential = auth.GoogleAuthProvider.credential(idToken);
      const firebaseCredential = await auth().signInWithCredential(credential);
      return await buildAuthResult(firebaseCredential.user);
    } catch (error) {
      logger.error('Failed to sign in with Google', error);
      throw mapAuthError(error);
    }
  }

  static async signInWithApple(): Promise<AuthResult> {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple sign-in is not available on this device.');
      }

      const nonce = generateNonce();
      const appleCredential = await AppleAuthentication.signInAsync({
        nonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!appleCredential.identityToken) {
        throw new Error('Apple sign-in did not return an identity token.');
      }

      const provider = new auth.OAuthProvider('apple.com');
      const credential = provider.credential(appleCredential.identityToken, nonce);
      const firebaseCredential = await auth().signInWithCredential(credential);

      const displayName =
        [appleCredential.fullName?.givenName, appleCredential.fullName?.familyName]
          .filter(Boolean)
          .join(' ')
          .trim() || undefined;

      if (displayName && !firebaseCredential.user.displayName) {
        await firebaseCredential.user.updateProfile({ displayName });
        await firebaseCredential.user.reload();
      }

      const currentUser = auth().currentUser ?? firebaseCredential.user;
      return await buildAuthResult(currentUser, displayName);
    } catch (error) {
      logger.error('Failed to sign in with Apple', error);
      throw mapAuthError(error);
    }
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
    if (GoogleSignin) {
      await GoogleSignin.signOut().catch(() => undefined);
    }
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
