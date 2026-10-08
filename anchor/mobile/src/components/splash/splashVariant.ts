import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { SPLASH_FIRST_OPEN_STORAGE_KEY, type SplashVariant } from './splashAnimation.constants';

/**
 * App.tsx mounts one SplashController before startup is ready and another after, so the read
 * is shared at module level: the second instance resolves instantly and agrees with the first.
 */
let pending: Promise<SplashVariant> | null = null;

export function resolveSplashVariant(): Promise<SplashVariant> {
  if (!pending) {
    pending = AsyncStorage.getItem(SPLASH_FIRST_OPEN_STORAGE_KEY)
      .then((played): SplashVariant => (played ? 'return' : 'first'))
      // Unknown means quick: a failed read must never cost a returning user three seconds.
      .catch((error): SplashVariant => {
        logger.warn('[SplashScreen] Failed to read first-open flag', error);
        return 'return';
      });
  }
  return pending;
}

/** Recorded as the ceremony starts, so an interrupted first open is not replayed. */
export function markFirstOpenPlayed(): void {
  AsyncStorage.setItem(SPLASH_FIRST_OPEN_STORAGE_KEY, '1').catch((error) => {
    logger.warn('[SplashScreen] Failed to persist first-open flag', error);
  });
}

/** Test seam. */
export function resetSplashVariantForTests(): void {
  pending = null;
}
