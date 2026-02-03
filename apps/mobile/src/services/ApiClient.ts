/**
 * Anchor App - API Client
 *
 * HTTP client for communicating with the backend API.
 * Handles authentication tokens, request/response interceptors, and error handling.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AuthService } from './AuthService';
import type { ApiResponse } from '@/types';
import { API_URL } from '@/config';

// Use the centralized API_URL from config (handles emulator vs physical device)
const API_BASE_URL = API_URL;

/**
 * Configured Axios instance for API calls
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Request Interceptor - Add Auth Token
// ============================================================================

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Get current user's ID token
      const token = await AuthService.getIdToken();

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // User not signed in - continue without token
      // This is expected for public endpoints like /auth/sync
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// ============================================================================
// Response Interceptor - Handle Errors
// ============================================================================

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    // Handle network errors
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }

    // Handle auth errors first to ensure consistent messaging
    if (error.response.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }

    // Handle API errors with standard format
    if (error.response.data?.error) {
      const apiError = error.response.data.error;
      const message = typeof apiError === 'string' ? apiError : apiError.message;
      throw new Error(message || 'An error occurred');
    }

    // Handle HTTP status codes
    switch (error.response.status) {
      case 403:
        throw new Error('Access denied.');

      case 404:
        throw new Error('Resource not found.');

      case 429:
        throw new Error('Too many requests. Please try again later.');

      case 500:
      case 502:
      case 503:
        throw new Error('Server error. Please try again later.');

      default:
        throw new Error('An unexpected error occurred.');
    }
  }
);

// ============================================================================
// API Helper Functions
// ============================================================================

/**
 * Type-safe GET request
 */
export async function get<T = unknown>(url: string): Promise<T> {
  const response = await apiClient.get<T>(url);
  return response.data;
}

/**
 * Type-safe POST request
 */
export async function post<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.post<T>(url, data);
  return response.data;
}

/**
 * Type-safe PUT request
 */
export async function put<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.put<T>(url, data);
  return response.data;
}

/**
 * Type-safe DELETE request
 */
export async function del<T = unknown>(url: string): Promise<T> {
  const response = await apiClient.delete<T>(url);
  return response.data;
}

// ============================================================================
// Profile API Functions (Phase 1: Private Profile)
// ============================================================================

import { Anchor, ProfileData, User, UserStats } from '@/types';
import { redactAnchors } from '@/utils/privacyHelpers';

/**
 * Fetch current user profile and stats.
 * Uses existing GET /api/auth/me endpoint.
 *
 * @returns User profile with stats fields
 */
export async function fetchUserProfile(): Promise<User> {
  const response = await apiClient.get<ApiResponse<User>>('/api/auth/me');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to fetch profile');
  }
  return response.data.data;
}

/**
 * Fetch active (charged) anchors for profile display.
 * Uses existing GET /api/anchors endpoint with query parameters.
 *
 * @param limit - Maximum number of anchors to return (default: 20)
 * @returns Array of charged anchors ordered by recent first
 */
export async function fetchActiveAnchors(limit: number = 20): Promise<Anchor[]> {
  const response = await apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
    params: {
      isCharged: 'true',
      limit,
      orderBy: 'updatedAt',
      order: 'desc',
    },
  });

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'Failed to fetch anchors');
  }
  return response.data.data;
}

/**
 * Fetch complete profile data (user + stats + active anchors).
 * Combines multiple API calls in parallel and applies privacy redaction.
 *
 * @returns ProfileData with user, computed stats, and redacted active anchors
 */
export async function fetchCompleteProfile(): Promise<ProfileData> {
  // Fetch both user and anchors in parallel
  const [user, anchors] = await Promise.all([
    fetchUserProfile(),
    fetchActiveAnchors(20),
  ]);

  // Compute stats from raw data
  const stats: UserStats = {
    totalAnchorsCreated: user.totalAnchorsCreated,
    totalCharged: anchors.filter((a) => a.isCharged).length,
    totalActivations: user.totalActivations,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
  };

  // Redact anchors for privacy
  const redactedAnchors = redactAnchors(anchors);

  return {
    user,
    stats,
    activeAnchors: redactedAnchors,
  };
}
