import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SettingsRevealOverlay } from './SettingsRevealOverlay';

export type SettingsRevealOrigin = {
  cx: number;
  cy: number;
  size: number;
};

type OpenOptions = {
  reduceMotion?: boolean;
};

type SettingsRevealContextValue = {
  open: (origin: SettingsRevealOrigin, options?: OpenOptions) => void;
  beginClose: (options?: OpenOptions) => void;
  markSettingsReady: () => void;
  isArmed: boolean;
  closeSignal: number;
  progress: SharedValue<number>;
};

const SettingsRevealContext = createContext<SettingsRevealContextValue | null>(null);

const OPEN_DURATION_MS = 560;
const CLOSE_DURATION_MS = 740;
const OPEN_FADE_OUT_MS = 90;
const SETTINGS_READY_FAILSAFE_MS = 900;

const getMaxDiameter = (cx: number, cy: number, width: number, height: number): number => {
  const d1 = Math.hypot(cx, cy);
  const d2 = Math.hypot(cx - width, cy);
  const d3 = Math.hypot(cx, cy - height);
  const d4 = Math.hypot(cx - width, cy - height);
  return Math.max(1, Math.max(d1, d2, d3, d4) * 2);
};

export const SettingsRevealProvider: React.FC<{
  navigationRef: NavigationContainerRefWithCurrent<any>;
  children: React.ReactNode;
}> = ({ navigationRef, children }) => {
  const [visible, setVisible] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);
  const phaseRef = useRef<'idle' | 'opening' | 'opened' | 'closing'>('idle');
  const navigationFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsReadyFailsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettingsReadyRef = useRef(false);
  const isOpenAnimationDoneRef = useRef(false);
  const isFadeOutInProgressRef = useRef(false);

  const progress = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const diameter = useSharedValue(1);
  const startScale = useSharedValue(0.01);

  const navigateToSettings = useCallback(() => {
    if (!navigationRef.isReady()) {
      return;
    }

    const rootState = navigationRef.getRootState();
    const activeRoute = rootState.routes[rootState.index];
    if (activeRoute?.name === 'Settings') {
      return;
    }

    navigationRef.navigate('Settings');
  }, [navigationRef]);

  const setPhase = useCallback((phase: 'idle' | 'opening' | 'opened' | 'closing') => {
    phaseRef.current = phase;
  }, []);

  const clearNavigationFallback = useCallback(() => {
    if (navigationFallbackTimeoutRef.current) {
      clearTimeout(navigationFallbackTimeoutRef.current);
      navigationFallbackTimeoutRef.current = null;
    }
  }, []);

  const clearSettingsReadyFailsafe = useCallback(() => {
    if (settingsReadyFailsafeTimeoutRef.current) {
      clearTimeout(settingsReadyFailsafeTimeoutRef.current);
      settingsReadyFailsafeTimeoutRef.current = null;
    }
  }, []);

  const finishFadeOut = useCallback(() => {
    setVisible(false);
    clearNavigationFallback();
    clearSettingsReadyFailsafe();
    setPhase('opened');
    isFadeOutInProgressRef.current = false;
  }, [clearNavigationFallback, clearSettingsReadyFailsafe, setPhase]);

  const finishOpenIfReady = useCallback(() => {
    if (!isOpenAnimationDoneRef.current || !isSettingsReadyRef.current || isFadeOutInProgressRef.current) {
      return;
    }

    isFadeOutInProgressRef.current = true;
    overlayOpacity.value = withTiming(0, { duration: OPEN_FADE_OUT_MS }, (done) => {
      if (!done) {
        return;
      }

      overlayOpacity.value = 1;
      runOnJS(finishFadeOut)();
    });
  }, [finishFadeOut, overlayOpacity]);

  const markSettingsReady = useCallback(() => {
    isSettingsReadyRef.current = true;
    finishOpenIfReady();
  }, [finishOpenIfReady]);

  const markOpenAnimationDone = useCallback(() => {
    isOpenAnimationDoneRef.current = true;
    finishOpenIfReady();
  }, [finishOpenIfReady]);

  const open = useCallback(
    (origin: SettingsRevealOrigin, options?: OpenOptions) => {
      if (options?.reduceMotion) {
        navigateToSettings();
        return;
      }

      if (phaseRef.current === 'opening' || phaseRef.current === 'closing') {
        return;
      }

      clearNavigationFallback();
      clearSettingsReadyFailsafe();
      isSettingsReadyRef.current = false;
      isOpenAnimationDoneRef.current = false;
      isFadeOutInProgressRef.current = false;

      const { width, height } = Dimensions.get('window');
      const maxDiameter = getMaxDiameter(origin.cx, origin.cy, width, height);
      const initialScale = Math.max(0.01, Math.min(1, origin.size / maxDiameter));

      originX.value = origin.cx;
      originY.value = origin.cy;
      diameter.value = maxDiameter;
      startScale.value = initialScale;

      setIsArmed(true);
      setPhase('opening');
      overlayOpacity.value = 1;
      progress.value = 0;
      setVisible(true);
      navigateToSettings();
      navigationFallbackTimeoutRef.current = setTimeout(
        navigateToSettings,
        180
      );
      settingsReadyFailsafeTimeoutRef.current = setTimeout(
        () => {
          isSettingsReadyRef.current = true;
          finishOpenIfReady();
        },
        SETTINGS_READY_FAILSAFE_MS
      );

      progress.value = withTiming(
        1,
        { duration: OPEN_DURATION_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (!finished) {
            return;
          }
          runOnJS(markOpenAnimationDone)();
        }
      );
    },
    [
      clearNavigationFallback,
      clearSettingsReadyFailsafe,
      diameter,
      finishOpenIfReady,
      markOpenAnimationDone,
      navigateToSettings,
      originX,
      originY,
      overlayOpacity,
      progress,
      setPhase,
      startScale,
    ]
  );

  const beginClose = useCallback(
    (options?: OpenOptions) => {
      if (options?.reduceMotion || !isArmed || phaseRef.current === 'closing') {
        return;
      }

      clearNavigationFallback();
      clearSettingsReadyFailsafe();
      isSettingsReadyRef.current = false;
      isOpenAnimationDoneRef.current = false;
      isFadeOutInProgressRef.current = false;
      setPhase('closing');
      setCloseSignal((previousValue) => previousValue + 1);
      setVisible(true);
      overlayOpacity.value = 1;
      progress.value = 1;

      progress.value = withTiming(
        0,
        { duration: CLOSE_DURATION_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (!finished) {
            return;
          }

          runOnJS(setVisible)(false);
          runOnJS(setIsArmed)(false);
          runOnJS(setPhase)('idle');
        }
      );
    },
    [clearNavigationFallback, clearSettingsReadyFailsafe, isArmed, overlayOpacity, progress, setPhase]
  );

  const value = useMemo(
    () => ({ open, beginClose, markSettingsReady, isArmed, closeSignal, progress }),
    [beginClose, closeSignal, isArmed, markSettingsReady, open, progress]
  );

  return (
    <SettingsRevealContext.Provider value={value}>
      {children}
      <SettingsRevealOverlay
        visible={visible}
        progress={progress}
        overlayOpacity={overlayOpacity}
        originX={originX}
        originY={originY}
        diameter={diameter}
        startScale={startScale}
      />
    </SettingsRevealContext.Provider>
  );
};

export const useSettingsReveal = (): SettingsRevealContextValue => {
  const context = useContext(SettingsRevealContext);
  if (!context) {
    throw new Error('useSettingsReveal must be used within SettingsRevealProvider');
  }
  return context;
};
