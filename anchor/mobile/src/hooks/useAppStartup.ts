import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/utils/logger';
import { SPLASH_FAIL_OPEN_TIMEOUT_MS } from '@/components/splash/splashAnimation.constants';

export type StartupDependencyState =
  | 'pending'
  | 'ready'
  | 'failed-but-safe-to-continue'
  | 'fatal';

export type StartupOutcome = 'success' | 'fail_open';

interface UseAppStartupOptions {
  fontsReady: boolean;
  settingsHydrated: boolean;
  authRestorationSettled: boolean;
  primeOnLaunchResolved: boolean;
  safeFailure?: boolean;
  fatalFailure?: boolean;
}

export interface AppStartupState {
  isReady: boolean;
  timedOut: boolean;
  status: StartupDependencyState;
  outcome: StartupOutcome;
}

export const useAppStartup = ({
  fontsReady,
  settingsHydrated,
  authRestorationSettled,
  primeOnLaunchResolved,
  safeFailure = false,
  fatalFailure = false,
}: UseAppStartupOptions): AppStartupState => {
  const [timedOut, setTimedOut] = useState(false);

  const dependenciesSettled =
    fontsReady &&
    settingsHydrated &&
    authRestorationSettled &&
    primeOnLaunchResolved;
  const safeToFailOpen = authRestorationSettled && primeOnLaunchResolved;

  useEffect(() => {
    if (dependenciesSettled || fatalFailure || timedOut) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      logger.warn('[Startup] Fail-open timeout reached; continuing where safe.', {
        timeoutMs: SPLASH_FAIL_OPEN_TIMEOUT_MS,
      });
      setTimedOut(true);
    }, SPLASH_FAIL_OPEN_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [dependenciesSettled, fatalFailure, timedOut]);

  return useMemo(() => {
    if (fatalFailure) {
      return {
        isReady: false,
        timedOut,
        status: 'fatal',
        outcome: 'fail_open',
      };
    }

    if (dependenciesSettled) {
      return {
        isReady: true,
        timedOut,
        status: safeFailure ? 'failed-but-safe-to-continue' : 'ready',
        outcome: safeFailure ? 'fail_open' : 'success',
      };
    }

    if (timedOut && safeToFailOpen) {
      return {
        isReady: true,
        timedOut: true,
        status: 'failed-but-safe-to-continue',
        outcome: 'fail_open',
      };
    }

    return {
      isReady: false,
      timedOut: false,
      status: 'pending',
      outcome: 'success',
    };
  }, [dependenciesSettled, fatalFailure, safeFailure, safeToFailOpen, timedOut]);
};
