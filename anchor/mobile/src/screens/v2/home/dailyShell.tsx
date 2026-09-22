import React, { createContext, useContext, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useV2ReduceMotion } from '@/hooks/v2';
import { v2ScreenBackground, v2StackScreenOptions } from '@/navigation/v2/transitions';
import { V2HomeScreen } from './V2HomeScreen';
import { V2AnchorLibraryScreen } from '@/screens/v2/anchors/V2AnchorLibraryScreen';
import { V2AnchorDetailsScreen } from '@/screens/v2/anchors/V2AnchorDetailsScreen';
import type { V2PracticeMode } from '@/constants/v2/practice';

/**
 * External navigation intents UI-D exposes but does not own. Production
 * integration wires these to the real V2 routes (Agent 1 / UI-C / UI-G). See
 * REQUIRED_INTEGRATION_CHANGES.md.
 */
export type V2DailyShellIntents = {
  onOpenPractice?: (anchorId: string, recommendedMode?: V2PracticeMode) => void;
  onOpenVision?: (anchorId: string) => void;
  onCreateVision?: (anchorId: string) => void;
  onOpenChart?: (anchorId?: string, courseId?: string) => void;
  onCreateChart?: (anchorId: string) => void;
  onOpenProgress?: (anchorId?: string) => void;
  onCreateAnchor?: () => void;
  onOpenProfile?: () => void;
  onReleaseAnchor?: (anchorId: string) => void;
  onOpenWeeklyInsight?: () => void;
};

/**
 * One stable no-op per intent name. Building these on demand returned a fresh
 * function on every render, which changed the identity of every intent on the
 * shell and defeated memoisation in the screens that consume them.
 */
const noopWarnCache = new Map<string, () => void>();
const noopWarn = (name: string) => {
  const existing = noopWarnCache.get(name);
  if (existing) return existing;
  const fn = () => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[V2DailyShell] intent "${name}" is not wired. See REQUIRED_INTEGRATION_CHANGES.md`);
    }
  };
  noopWarnCache.set(name, fn);
  return fn;
};

const IntentsContext = createContext<V2DailyShellIntents>({});

/** Provides external navigation intents to the daily-shell screens (also used in tests). */
export function V2DailyShellIntentsProvider({
  intents,
  children,
}: {
  intents: V2DailyShellIntents;
  children: React.ReactNode;
}) {
  return <IntentsContext.Provider value={intents}>{children}</IntentsContext.Provider>;
}

export function useV2DailyShellIntents(): Required<
  Pick<V2DailyShellIntents, 'onOpenPractice' | 'onOpenVision' | 'onCreateVision' | 'onOpenChart' | 'onCreateChart' | 'onOpenProgress' | 'onCreateAnchor' | 'onOpenProfile' | 'onReleaseAnchor' | 'onOpenWeeklyInsight'>
> {
  const value = useContext(IntentsContext);
  /**
   * Memoised on the context value. Home's sections are memoised and every one
   * of its handlers closes over these intents, so re-deriving this object each
   * render re-rendered the entire page on any state change - including on the
   * frames where the Anchor carousel is settling.
   */
  return useMemo(() => ({
    onOpenPractice: value.onOpenPractice ?? noopWarn('onOpenPractice'),
    onOpenVision: value.onOpenVision ?? noopWarn('onOpenVision'),
    onCreateVision: value.onCreateVision ?? noopWarn('onCreateVision'),
    onOpenChart: value.onOpenChart ?? noopWarn('onOpenChart'),
    onCreateChart: value.onCreateChart ?? noopWarn('onCreateChart'),
    onOpenProgress: value.onOpenProgress ?? noopWarn('onOpenProgress'),
    onCreateAnchor: value.onCreateAnchor ?? noopWarn('onCreateAnchor'),
    onOpenProfile: value.onOpenProfile ?? noopWarn('onOpenProfile'),
    onReleaseAnchor: value.onReleaseAnchor ?? noopWarn('onReleaseAnchor'),
    onOpenWeeklyInsight: value.onOpenWeeklyInsight ?? noopWarn('onOpenWeeklyInsight'),
  }), [value]);
}

export type V2DailyShellParamList = {
  V2Home: undefined;
  V2AnchorLibrary: undefined;
  V2AnchorDetails: { anchorId: string };
};

const Stack = createNativeStackNavigator<V2DailyShellParamList>();

/**
 * Self-contained Home / Your Anchors / Anchor Details stack. It is owned by
 * UI-D and does NOT modify the central AnchorV2Navigator. Production
 * integration should flatten these three screens into the central V2 stack.
 */
export function V2DailyShellNavigator({ intents = {} }: { intents?: V2DailyShellIntents }) {
  const value = useMemo(() => intents, [intents]);
  const reduceMotion = useV2ReduceMotion();
  // Same transition system as the central V2 stack, so Home -> Details moves
  // exactly like Home -> Practice. (This stack used to run Android's 400ms
  // full-width slide while every other V2 push used the platform default.)
  const screenOptions = useMemo(() => v2StackScreenOptions(reduceMotion), [reduceMotion]);
  return (
    <IntentsContext.Provider value={value}>
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="V2Home" component={V2HomeScreen} />
        <Stack.Screen name="V2AnchorLibrary" component={V2AnchorLibraryScreen} />
        <Stack.Screen name="V2AnchorDetails" component={V2AnchorDetailsScreen} options={DETAILS_OPTIONS} />
      </Stack.Navigator>
    </IntentsContext.Provider>
  );
}

const DETAILS_OPTIONS = v2ScreenBackground('paper');
