import { RELEASE_FIRE_KILL_SWITCH } from '@/constants/v2/release';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

/** Why the burn shader is not running. Reported as a Sentry breadcrumb, never with user data. */
export type ReleaseFireFallback = 'effect_unavailable' | 'capture_blank' | 'reduced_motion';

/** `pending` means the Skia texture has not been built yet; it is neither usable nor a failure. */
export type ReleaseFireTexture = 'pending' | 'valid' | 'blank';

export interface ReleaseFireInput {
  reduceMotion: boolean;
  /** The runtime effect compiled on this device. */
  effectAvailable: boolean;
  texture: ReleaseFireTexture;
  killSwitch?: boolean;
}

export type ReleaseFireDecision =
  | { enabled: true; fallback: null }
  | { enabled: false; fallback: ReleaseFireFallback | null };

/**
 * Fire is a runtime capability: the effect must compile AND the artwork texture must
 * validate. Anything else keeps the native artwork and the fixed fade, never an empty canvas.
 */
export function resolveReleaseFire({ reduceMotion, effectAvailable, texture, killSwitch = RELEASE_FIRE_KILL_SWITCH }: ReleaseFireInput): ReleaseFireDecision {
  if (reduceMotion) return { enabled: false, fallback: 'reduced_motion' };
  if (killSwitch || !effectAvailable) return { enabled: false, fallback: 'effect_unavailable' };
  if (texture === 'blank') return { enabled: false, fallback: 'capture_blank' };
  if (texture === 'pending') return { enabled: false, fallback: null };
  return { enabled: true, fallback: null };
}

export function reportReleaseFireFallback(reason: ReleaseFireFallback): void {
  try {
    ErrorTrackingService.addBreadcrumb('Release fire fallback', 'release.fire', { reason });
  } catch {
    // Telemetry must never affect the ceremony.
  }
}
