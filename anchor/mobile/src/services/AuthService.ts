/**
 * Anchor App - Authentication Service
 *
 * Firebase Authentication integration using @react-native-firebase/auth.
 * Requires google-services.json (Android) and GoogleService-Info.plist (iOS)
 * to be placed in the appropriate native directories before building.
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { User, FirebaseUser } from '@/types';

export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

function mapFirebaseUser(fbUser: FirebaseAuthTypes.User, isNewUser: boolean = false): User {
  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    displayName: fbUser.displayName ?? undefined,
    hasCompletedOnboarding: false,
    subscriptionStatus: 'free',
    totalAnchorsCreated: 0,
    totalActivations: 0,
    currentStreak: 0,
    longestStreak: 0,
    stabilizesTotal: 0,
    stabilizeStreakDays: 0,
    createdAt: new Date(fbUser.metadata.creationTime ?? Date.now()),
  };
}

export class AuthService {
  static initialize(): void {
    // Firebase initializes automatically via google-services.json / GoogleService-Info.plist
  }

  static async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const credential = await auth().signInWithEmailAndPassword(email, password);
    const token = await credential.user.getIdToken();
    return {
      user: mapFirebaseUser(credential.user),
      token,
      isNewUser: credential.additionalUserInfo?.isNewUser ?? false,
    };
  }

  static async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthResult> {
    const credential = await auth().createUserWithEmailAndPassword(email, password);

    if (displayName) {
      await credential.user.updateProfile({ displayName });
    }

    const token = await credential.user.getIdToken();
    return {
      user: mapFirebaseUser(credential.user, true),
      token,
      isNewUser: true,
    };
  }

  static async signInWithGoogle(): Promise<AuthResult> {
    // Google Sign-In requires @react-native-google-signin/google-signin.
    // Add that package and configure it when wiring up social auth.
    throw new Error('Google Sign-In not yet configured. Install @react-native-google-signin/google-signin and add OAuth client IDs to app.json.');
  }

  static async signOut(): Promise<void> {
    await auth().signOut();
  }

  static getCurrentFirebaseUser(): FirebaseUser | null {
    const user = auth().currentUser;
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    };
  }

  static async getIdToken(): Promise<string> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.getIdToken();
  }

  static async sendPasswordResetEmail(email: string): Promise<void> {
    await auth().sendPasswordResetEmail(email);
  }

  static onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    return auth().onAuthStateChanged((fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      callback({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
      });
    });
  }
}
