/**
 * Anchor App - Configuration
 *
 * Central configuration for the app.
 * For production, these values should be set via environment variables or build config.
 */

export const Config = {
  API_URL: __DEV__ ? 'http://localhost:3000' : 'https://api.anchor.app',
};
