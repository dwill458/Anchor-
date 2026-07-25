import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { logger } from '@/utils/logger';
import { useSystemReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnimatedSplashScreen } from './AnimatedSplashScreen';
import {
  SPLASH_STARTUP_WAIT_THRESHOLD_MS,
} from './splashAnimation.constants';

interface SplashControllerProps {
  startupReady: boolean;
  startupOutcome: 'success' | 'fail_open';
  startupStartedAt: number;
  authState: 'signed_in' | 'signed_out' | 'unknown';
}

export const SplashController: React.FC<SplashControllerProps> = ({
  startupReady,
  startupOutcome,
  startupStartedAt,
  authState,
}) => {
  const [visible, setVisible] = useState(true);
  const [nativeHidden, setNativeHidden] = useState(Platform.OS === 'web');
  const [active, setActive] = useState(false);
  const [rootReady, setRootReady] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const reduceMotionEnabled = useSystemReduceMotionEnabled();
  const visibleRef = useRef(true);
  const hasStartedAnalytics = useRef(false);
  const hasWaitedAnalytics = useRef(false);
  const hasCompletedAnalytics = useRef(false);

  const requestSplashRemoval = useCallback(() => {
    if (!visibleRef.current) {
      return;
    }

    visibleRef.current = false;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!startupReady || !rootReady || !logoReady || !nativeHidden || active) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(frame);
  }, [active, logoReady, nativeHidden, rootReady, startupReady]);

  useEffect(() => {
    if (!startupReady || !rootReady || !logoReady || nativeHidden) {
      return undefined;
    }

    let cancelled = false;

    const releaseNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        logger.warn('[SplashScreen] Failed to hide native splash screen', error);
      }

      if (cancelled) {
        return;
      }

      setNativeHidden(true);
      requestAnimationFrame(() => {
        if (!cancelled) {
          setActive(true);
        }
      });
    };

    void releaseNativeSplash();

    return () => {
      cancelled = true;
    };
  }, [logoReady, nativeHidden, requestSplashRemoval, rootReady, startupReady]);

  useEffect(() => {
    if (!active || hasStartedAnalytics.current) {
      return;
    }

    hasStartedAnalytics.current = true;
    const startupWaitMs = Math.max(0, Date.now() - startupStartedAt);

    if (reduceMotionEnabled) {
      AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_SKIPPED_REDUCE_MOTION, {
        durationMs: 0,
        startupWaitMs,
        reduceMotion: true,
        authState,
        startupOutcome,
      });
    }

    if (startupWaitMs > SPLASH_STARTUP_WAIT_THRESHOLD_MS && !hasWaitedAnalytics.current) {
      hasWaitedAnalytics.current = true;
      AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_STARTUP_WAITED, {
        durationMs: startupWaitMs,
        startupWaitMs,
        reduceMotion: reduceMotionEnabled,
        authState,
        startupOutcome,
      });
    }

    AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_STARTED, {
      durationMs: 0,
      startupWaitMs,
      reduceMotion: reduceMotionEnabled,
      authState,
      startupOutcome,
    });
  }, [active, authState, reduceMotionEnabled, startupOutcome, startupStartedAt]);

  useEffect(() => {
    if (!visible && !hasCompletedAnalytics.current) {
      hasCompletedAnalytics.current = true;
      AnalyticsService.trackAnonymous(AnalyticsEvents.SPLASH_COMPLETED, {
        durationMs: Math.max(0, Date.now() - startupStartedAt),
        startupWaitMs: Math.max(0, Date.now() - startupStartedAt),
        reduceMotion: reduceMotionEnabled,
        authState,
        startupOutcome,
      });
    }
  }, [authState, reduceMotionEnabled, startupOutcome, startupStartedAt, visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    let wasBackgrounded = false;
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        wasBackgrounded = true;
        return;
      }

      if (wasBackgrounded) {
        requestSplashRemoval();
      }
    });

    return () => {
      backSubscription.remove();
      appStateSubscription.remove();
    };
  }, [requestSplashRemoval, visible]);

  if (!visible) {
    return null;
  }

  return (
    <AnimatedSplashScreen
      active={active}
      reduceMotionEnabled={reduceMotionEnabled}
      onComplete={requestSplashRemoval}
      onRootLayout={() => setRootReady(true)}
      onLogoReady={() => setLogoReady(true)}
    />
  );
};
