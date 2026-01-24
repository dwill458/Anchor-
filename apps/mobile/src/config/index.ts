/**
 * Anchor App - Configuration
 *
 * Central configuration for the app.
 * For production, these values should be set via environment variables or build config.
 */

import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host machine's localhost
// Hardcoded LAN IP for Physical Device testing
export const API_URL = __DEV__
  ? 'http://192.168.0.4:8000'
  : 'https://api.anchor.app';

export const Config = {
  API_URL,
};
