import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePrimeSessionAccess } from '@/hooks/usePrimeSessionAccess';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnalyticsService } from '@/services/AnalyticsService';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  resolveSessionAudioConfiguration,
} from '@/types/sessionAudio';
import {
  startPractice as startPracticeRequest,
  type PracticeEntryTarget,
  type StartPracticeRequest,
} from '@/navigation/practiceEntry';

const NAVIGATION_LOCK_FALLBACK_MS = 2500;

export interface PracticeEntryController {
  startPractice: (request: StartPracticeRequest) => boolean;
  isNavigationLocked: boolean;
  releaseNavigationLock: () => void;
}

/**
 * Screen-facing adapter for the canonical practice entry function.
 * The ref is intentionally synchronous: React state alone cannot stop five
 * same-frame taps from creating five stack actions.
 */
export function usePracticeEntry(): PracticeEntryController {
  const { navigateToPractice, navigateToPaywall, activeTabIndex } = useTabNavigation();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const sessionAudioDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults ?? DEFAULT_SESSION_AUDIO_DEFAULTS
  );
  const primeSessionAccess = usePrimeSessionAccess();
  const visualizeAccess = useTrialStatus();
  const navigationLockRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);

  const releaseNavigationLock = useCallback(() => {
    navigationLockRef.current = false;
    setIsNavigationLocked(false);
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (activeTabIndex !== 1) {
      releaseNavigationLock();
    }
  }, [activeTabIndex, releaseNavigationLock]);

  useEffect(
    () => () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    },
    []
  );

  const navigateToPracticeTarget = useCallback(
    (target: PracticeEntryTarget) => {
      switch (target.route) {
        case 'ChargeSetup':
          navigateToPractice(target.route, target.params);
          break;
        case 'Ritual':
          navigateToPractice(target.route, target.params);
          break;
        case 'ActivationRitual':
          navigateToPractice(target.route, target.params);
          break;
        case 'VisualizePreparation':
          navigateToPractice(target.route, target.params);
          break;
        case 'ConfirmBurn':
          navigateToPractice(target.route, target.params);
          break;
      }
    },
    [navigateToPractice]
  );

  const startPractice = useCallback(
    (request: StartPracticeRequest): boolean => {
      if (navigationLockRef.current) {
        return false;
      }

      navigationLockRef.current = true;
      setIsNavigationLocked(true);
      let redirectRequested = false;

      const started = startPracticeRequest(request, {
        getAnchorById,
        primeSessionAccess,
        visualizeAvailable: visualizeAccess.hasActiveEntitlement,
        defaultFocusDurationSeconds: focusSessionDuration,
        defaultAudioConfiguration: {
          focus: resolveSessionAudioConfiguration(sessionAudioDefaults.focus),
          deepPrime: resolveSessionAudioConfiguration(sessionAudioDefaults.deep_prime),
        },
        navigateToPractice: navigateToPracticeTarget,
        navigateToPaywall: (params) => {
          redirectRequested = true;
          navigateToPaywall(params);
        },
        onEntitlementDenied: ({ mode, anchorId, remaining, tier }) => {
          AnalyticsService.track('free_weekly_sessions_used', {
            source: request.source,
            practice_mode: mode,
            anchor_id: anchorId,
            remaining_weekly_free_sessions: remaining,
            tier,
          });
        },
      });

      if (!started) {
        // A rejected request normally has no navigation side effect. A
        // paywall rejection does, however, and must retain the lock so rapid
        // taps cannot stack multiple modal presentations.
        if (!redirectRequested) {
          releaseNavigationLock();
        } else {
          fallbackTimerRef.current = setTimeout(() => {
            releaseNavigationLock();
          }, NAVIGATION_LOCK_FALLBACK_MS);
        }
        return false;
      }

      fallbackTimerRef.current = setTimeout(() => {
        releaseNavigationLock();
      }, NAVIGATION_LOCK_FALLBACK_MS);
      return true;
    },
    [
      focusSessionDuration,
      getAnchorById,
      navigateToPaywall,
      navigateToPracticeTarget,
      primeSessionAccess,
      releaseNavigationLock,
      sessionAudioDefaults,
      visualizeAccess.hasActiveEntitlement,
    ]
  );

  return {
    startPractice,
    isNavigationLocked,
    releaseNavigationLock,
  };
}
