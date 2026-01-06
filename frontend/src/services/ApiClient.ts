/**
 * Anchor App - API Client
 *
 * HTTP client for communicating with the backend API.
 * TODO: Implement in Phase 1
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// TODO: Add request interceptors for auth tokens
// TODO: Add response interceptors for error handling
// TODO: Implement API methods for anchors, activations, etc.
