export const SPLASH_BACKGROUND_COLOR = '#0F1419';
export const SPLASH_GOLD = '#D4AF37';
export const SPLASH_IVORY = '#F5F5DC';
export const SPLASH_PURPLE = '#3E2C5B';

export const SPLASH_ANIMATION_DURATION_MS = 1450;
export const SPLASH_REDUCED_MOTION_DURATION_MS = 320;
export const SPLASH_STARTUP_WAIT_THRESHOLD_MS = 1450;
export const SPLASH_FAIL_OPEN_TIMEOUT_MS = 4000;

export const SPLASH_PHASES = {
  ambient: { delay: 0, duration: 250 },
  illumination: { delay: 200, duration: 450 },
  pulse: { delay: 600, duration: 250 },
  brand: { delay: 700, duration: 350 },
  subtitle: { delay: 900, duration: 250 },
  exit: { delay: 1150, duration: 300 },
} as const;

/**
 * This is intentionally isolated so the approved transparent production logo
 * can replace the current build-safe fallback without touching animation code.
 * The fallback is the existing bundled Anchor mark; it is not the final
 * head-brain-anchor production artwork from the supplied prototype.
 */
export const SPLASH_LOGO_ASSET = require('../../../assets/anchor-gold.png');

