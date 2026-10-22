export const SPLASH_BACKGROUND_COLOR = '#F4EDE0';
/** Sampled from the brand mark's own ink so the vector trace and the texture are one colour. */
export const SPLASH_INK_COLOR = '#0B0E15';
export const SPLASH_GOLD = '#E2BC6B';

export const SPLASH_REDUCED_MOTION_DURATION_MS = 320;
export const SPLASH_STARTUP_WAIT_THRESHOLD_MS = 1450;
export const SPLASH_FAIL_OPEN_TIMEOUT_MS = 4000;

/**
 * Rendered width of the sigil in dp. The native launch image (assets/splash-star.png,
 * app.json `imageWidth`) is the same canvas at the same width, so the gold star sits on the
 * exact point where the native splash left it.
 */
export const SPLASH_MARK_WIDTH = 150;
/** The splash layers share the master artwork's 1127 × 1396 canvas. */
export const SPLASH_MARK_HEIGHT = Math.round(SPLASH_MARK_WIDTH * (1396 / 1127));

/** Persisted once the first-open ceremony has started; every later launch is a return. */
export const SPLASH_FIRST_OPEN_STORAGE_KEY = 'anchor.splash.firstOpenPlayed.v2';

export type SplashVariant = 'first' | 'return';

/**
 * Every splash duration lives here. Device playback reads faster than a prototype, so the
 * first-open timings are deliberately unhurried; the return stays under a second.
 * Values are ms from the moment the splash starts running.
 */
export const SPLASH_TIMINGS = {
  first: {
    glowIn: { delay: 0, duration: 520 },
    draw: { delay: 360, duration: 1380 },
    /** The hand-drawn texture replaces the clean vector trace as the trace completes. */
    texture: { delay: 1480, duration: 460 },
    hapticAt: 1740,
    lift: { delay: 1780, duration: 640 },
    wordmark: { delay: 1880, duration: 620 },
    tagline: { delay: 2080, duration: 560 },
    exit: { delay: 2900, duration: 480 },
  },
  return: {
    reveal: { delay: 0, duration: 240 },
    breath: { delay: 140, duration: 520 },
    exit: { delay: 460, duration: 300 },
  },
  /** One full glow cycle while startup is still working behind the native-matching frame. */
  waitBreathMs: 1600,
} as const;

/** On first open the mark rises this far to make room for the wordmark beneath it. */
export const SPLASH_LIFT_DP = 38;
export const SPLASH_RETURN_EXIT_SCALE = 1.04;

export const SPLASH_STAR_ASSET = require('../../assets/splash/splash-star.png');
export const SPLASH_SIGIL_INK_ASSET = require('../../assets/splash/splash-sigil-ink.png');
