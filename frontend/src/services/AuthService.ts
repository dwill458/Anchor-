/**
 * Anchor App - Authentication Service
 *
 * Handles user authentication via Firebase Auth.
 * Supports email/password and Google Sign-In.
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { apiClient } from './ApiClient';
import type { User, ApiResponse } from '@/types';

/**
 * Authentication result returned after successful sign-in
 */
export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

/**
 * Authentication Service
 * Manages Firebase authentication and user session
 */
export class AuthService {
  /**
   * Initialize Google Sign-In configuration
   * Call this once when the app starts
   */
  static initialize(): void {
    GoogleSignin.configure({
      webClientId: process.env.FIREBASE_WEB_CLIENT_ID || '',
      offlineAccess: true,
    });
  }

  /**
   * Sign in with email and password
   *
   * @param email - User email address
   * @param password - User password
   * @returns Authentication result with user data and token
   * @throws Error if sign-in fails
   */
  static async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      return await this.handleAuthResult(userCredential);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign up with email and password
   *
   * @param email - User email address
   * @param password - User password
   * @param displayName - Optional display name
   * @returns Authentication result with user data and token
   * @throws Error if sign-up fails
   */
  static async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthResult> {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);

      // Update display name if provided
      if (displayName && userCredential.user) {
        await userCredential.user.updateProfile({ displayName });
      }

      return await this.handleAuthResult(userCredential, true);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with Google
   *
   * @returns Authentication result with user data and token
   * @throws Error if sign-in fails
   */
  static async signInWithGoogle(): Promise<AuthResult> {
    try {
      // Check if device supports Google Play
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Get Google ID token
      const { idToken } = await GoogleSignin.signIn();

      // Create Firebase credential
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in with Firebase
      const userCredential = await auth().signInWithCredential(googleCredential);

      return await this.handleAuthResult(userCredential);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   *
   * @throws Error if sign-out fails
   */
  static async signOut(): Promise<void> {
    try {
      // Sign out from Google if signed in
      const isGoogleSignedIn = await GoogleSignin.isSignedIn();
      if (isGoogleSignedIn) {
        await GoogleSignin.signOut();
      }

      // Sign out from Firebase
      await auth().signOut();
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current Firebase user
   *
   * @returns Current Firebase user or null
   */
  static getCurrentFirebaseUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  /**
   * Get current user's ID token
   *
   * @returns Firebase ID token
   * @throws Error if no user is signed in
   */
  static async getIdToken(): Promise<string> {
    const user = this.getCurrentFirebaseUser();
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    return await user.getIdToken();
  }

  /**
   * Send password reset email
   *
   * @param email - User email address
   * @throws Error if sending email fails
   */
  static async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Subscribe to authentication state changes
   *
   * @param callback - Function called when auth state changes
   * @returns Unsubscribe function
   */
  static onAuthStateChanged(
    callback: (user: FirebaseAuthTypes.User | null) => void
  ): () => void {
    return auth().onAuthStateChanged(callback);
  }

  /**
   * Handle authentication result and sync with backend
   *
   * @param userCredential - Firebase user credential
   * @param isNewUser - Whether this is a new user registration
   * @returns Authentication result with user data and token
   * @private
   */
  private static async handleAuthResult(
    userCredential: FirebaseAuthTypes.UserCredential,
    isNewUser = false
  ): Promise<AuthResult> {
    const firebaseUser = userCredential.user;

    if (!firebaseUser) {
      throw new Error('Authentication failed: No user returned');
    }

    // Get Firebase ID token
    const token = await firebaseUser.getIdToken();

    // Sync with backend to create/update user profile
    const response = await apiClient.post<ApiResponse<User>>('/api/auth/sync', {
      authUid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      authProvider: this.getAuthProvider(userCredential),
    });

    if (!response.data.success || !response.data.data) {
      throw new Error('Failed to sync user with backend');
    }

    return {
      user: response.data.data,
      token,
      isNewUser: isNewUser || response.data.data.totalAnchorsCreated === 0,
    };
  }

  /**
   * Get authentication provider name from credential
   *
   * @param userCredential - Firebase user credential
   * @returns Provider name ('email', 'google', or 'apple')
   * @private
   */
  private static getAuthProvider(
    userCredential: FirebaseAuthTypes.UserCredential
  ): string {
    if (userCredential.additionalUserInfo?.providerId) {
      const providerId = userCredential.additionalUserInfo.providerId;
      if (providerId.includes('google')) return 'google';
      if (providerId.includes('apple')) return 'apple';
    }
    return 'email';
  }

  /**
   * Handle Firebase auth errors and convert to user-friendly messages
   *
   * @param error - Firebase auth error
   * @returns Error with user-friendly message
   * @private
   */
  private static handleAuthError(error: unknown): Error {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const authError = error as { code: string; message: string };

      switch (authError.code) {
        case 'auth/email-already-in-use':
          return new Error('This email is already registered. Please sign in instead.');
        case 'auth/invalid-email':
          return new Error('Please enter a valid email address.');
        case 'auth/weak-password':
          return new Error('Password must be at least 6 characters long.');
        case 'auth/user-not-found':
          return new Error('No account found with this email. Please sign up.');
        case 'auth/wrong-password':
          return new Error('Incorrect password. Please try again.');
        case 'auth/too-many-requests':
          return new Error('Too many failed attempts. Please try again later.');
        case 'auth/network-request-failed':
          return new Error('Network error. Please check your connection.');
        case 'auth/user-disabled':
          return new Error('This account has been disabled.');
        default:
          return new Error(authError.message || 'Authentication failed. Please try again.');
      }
    }

    return error instanceof Error ? error : new Error('An unexpected error occurred');
  }
}
