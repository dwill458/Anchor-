/**
 * Anchor App - API Client
 *
 * HTTP client for communicating with the backend API.
 * Handles authentication tokens, request/response interceptors, and error handling.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AuthService } from './AuthService';
import type { ApiResponse } from '@/types';

// Use 10.0.2.2 for Android emulator to access host localhost
const API_BASE_URL = process.env.API_BASE_URL || 'http://10.0.2.2:3000';

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
