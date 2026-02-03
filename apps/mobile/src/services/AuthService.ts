/**
 * Anchor App - Authentication Service
 *
 * JWT-based auth against the backend API.
 */

import { API_URL } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import type { User, FirebaseUser } from '@/types';

export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

interface AuthApiResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  error?: {
    message?: string;
  };
}

const parseUser = (user: User): User => ({
  ...user,
  createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
});

async function postJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string } | string;
  };

  if (!response.ok) {
    const message =
      typeof (json as any)?.error === 'string'
        ? (json as any).error
        : (json as any)?.error?.message;
    throw new Error(message || 'Authentication failed');
  }

  return json as T;
}

export class AuthService {
  static initialize(): void {
    // No-op for now (token is persisted by zustand)
  }

  static async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const response = await postJson<AuthApiResponse>('/api/auth/login', {
      email,
      password,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Login failed');
    }

    const user = parseUser(response.data.user);
    return {
      user,
      token: response.data.token,
      isNewUser: false,
    };
  }

  static async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthResult> {
    const response = await postJson<AuthApiResponse>('/api/auth/register', {
      email,
      password,
      displayName,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Sign up failed');
    }

    const user = parseUser(response.data.user);
    return {
      user,
      token: response.data.token,
      isNewUser: true,
    };
  }

  static async signInWithGoogle(): Promise<AuthResult> {
    throw new Error('Google sign-in is not configured');
  }

  static async signInWithApple(): Promise<AuthResult> {
    throw new Error('Apple sign-in is not configured');
  }

  static async signOut(): Promise<void> {
    // Token clearing happens in store
  }

  static getCurrentFirebaseUser(): FirebaseUser | null {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    return {
      uid: user.id,
      email: user.email,
      displayName: user.displayName || null,
    };
  }

  static async getIdToken(): Promise<string> {
    return useAuthStore.getState().token || '';
  }

  static async sendPasswordResetEmail(): Promise<void> {
    throw new Error('Password reset is not configured');
  }

  static onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    const current = AuthService.getCurrentFirebaseUser();
    setTimeout(() => callback(current), 0);
    return () => {};
  }
}
