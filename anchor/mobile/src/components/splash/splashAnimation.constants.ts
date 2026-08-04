export const SPLASH_BACKGROUND_COLOR = '#0F1419';

export const SPLASH_REDUCED_MOTION_DURATION_MS = 320;
export const SPLASH_STARTUP_WAIT_THRESHOLD_MS = 1450;
export const SPLASH_FAIL_OPEN_TIMEOUT_MS = 4000;
export const SPLASH_EXIT_DURATION_MS = 280;

/**
 * The launch artwork is intentionally one visual system from native launch
 * through the in-app handoff. Do not substitute the standalone anchor asset
 * here: it produces a conspicuous poster-to-icon identity jump.
 */
export const SPLASH_ARTWORK_ASSET = require('../../../assets/anchor-splash-artwork.jpg');
