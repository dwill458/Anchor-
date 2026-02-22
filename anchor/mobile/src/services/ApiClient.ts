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
import { monitoringConfig } from '@/config/monitoring';
import { ErrorSeverity, ErrorTrackingService } from './ErrorTrackingService';
import { PerformanceMonitoring, type PerformanceTrace } from './PerformanceMonitoring';
import { logger } from '@/utils/logger';

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

interface AnchorRequestMetadata {
  startTime: number;
  requestId: string;
  trace: PerformanceTrace;
}

type AnchorRequestConfig = InternalAxiosRequestConfig & {
  metadata?: AnchorRequestMetadata;
};

// ============================================================================
// Request Interceptor - Add Auth Token
// ============================================================================

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toUpperCase();
    const trace = PerformanceMonitoring.startTrace(`api_${method}_${config.url ?? 'unknown'}`, {
      method,
      url: config.url,
    });

    const requestConfig = config as AnchorRequestConfig;
    requestConfig.metadata = {
      startTime: Date.now(),
      requestId: `${Date.now()}_${Math.round(Math.random() * 10000)}`,
      trace,
    };

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

    ErrorTrackingService.addBreadcrumb('API request', 'network.request', {
      request_id: requestConfig.metadata.requestId,
      method,
      url: config.url,
    });

    return config;
  },
  (error: AxiosError) => {
    const requestConfig = error.config as AnchorRequestConfig | undefined;
    requestConfig?.metadata?.trace.stop({ success: false, stage: 'request_interceptor' });
    return Promise.reject(error);
  }
);

// ============================================================================
// Response Interceptor - Handle Errors
// ============================================================================

apiClient.interceptors.response.use(
  (response) => {
    const requestConfig = response.config as AnchorRequestConfig;
    const metadata = requestConfig.metadata;
    const duration = metadata ? Date.now() - metadata.startTime : 0;

    if (metadata) {
      metadata.trace.stop({
        success: true,
        status_code: response.status,
      });
    }

    PerformanceMonitoring.recordApiCall(requestConfig.url ?? 'unknown', duration, true);
    ErrorTrackingService.addBreadcrumb('API response', 'network.response', {
      request_id: metadata?.requestId,
      status_code: response.status,
      duration_ms: duration,
      url: requestConfig.url,
    });

    if (duration >= monitoringConfig.slowRequestThresholdMs) {
      ErrorTrackingService.captureMessage(
        `Slow API request: ${(requestConfig.method ?? 'get').toUpperCase()} ${requestConfig.url}`,
        ErrorSeverity.Warning
      );
    }

    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const requestConfig = error.config as AnchorRequestConfig | undefined;
    const metadata = requestConfig?.metadata;
    const duration = metadata ? Date.now() - metadata.startTime : 0;

    metadata?.trace.stop({
      success: false,
      status_code: error.response?.status ?? 0,
      error_code: error.code ?? 'unknown',
    });

    if (requestConfig) {
      PerformanceMonitoring.recordApiCall(requestConfig.url ?? 'unknown', duration, false);
      ErrorTrackingService.addBreadcrumb('API error', 'network.error', {
        request_id: metadata?.requestId,
        status_code: error.response?.status ?? 0,
        code: error.code ?? 'unknown',
        duration_ms: duration,
        method: (requestConfig.method ?? 'get').toUpperCase(),
        url: requestConfig.url,
      });
    }

    if (error.response?.status && error.response.status >= 500) {
      ErrorTrackingService.captureException(error, {
        action: 'api_request_failed',
        status: error.response.status,
        method: (requestConfig?.method ?? 'get').toUpperCase(),
        url: requestConfig?.url,
      });
    } else {
      logger.warn('[ApiClient] Request failed', {
        method: (requestConfig?.method ?? 'get').toUpperCase(),
        url: requestConfig?.url,
        status: error.response?.status,
        code: error.code,
      });
    }

    // Handle network errors
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }

    // Handle API errors with standard format
    if (error.response.data?.error) {
      const apiError = error.response.data.error;
      const message = typeof apiError === 'string' ? apiError : apiError.message;
      throw new Error(message || 'An error occurred');
    }

    // Handle HTTP status codes
    switch (error.response.status) {
      case 401:
        // Unauthorized - token expired or invalid
        // Could trigger sign-out here if needed
        throw new Error('Session expired. Please sign in again.');

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
