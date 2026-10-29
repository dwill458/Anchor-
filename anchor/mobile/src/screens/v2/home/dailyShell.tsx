import React, { createContext, useContext, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AnchorV2StackParamList } from '@/navigation/v2/types';
import { useV2ReduceMotion } from '@/hooks/v2';
import { v2ScreenBackground, v2StackScreenOptions } from '@/navigation/v2/transitions';
import { ProgressiveFocusTransitionProvider } from '@/navigation/v2/ProgressiveFocusTransition';
import { V2HomeScreen } from './V2HomeScreen';
import { VisualProfiler } from '@/utils/visualProfiler'; // TEMP-PROFILER
import { V2AnchorLibraryScreen } from '@/screens/v2/anchors/V2AnchorLibraryScreen';
import { V2AnchorDetailsScreen } from '@/screens/v2/anchors/V2AnchorDetailsScreen';
import type { V2PracticeMode } from '@/constants/v2/practice';
import { isProFeatureLocked } from '@/utils/premiumAccess';
import { discoverGuidance } from '@/hooks/v2/guidance/guidanceRuntime';
import { useAuthStore } from '@/stores/authStore';

/**
 * External navigation intents UI-D exposes but does not own. Production
 * integration wires these to the real V2 routes (Agent 1 / UI-C / UI-G). See
 * REQUIRED_INTEGRATION_CHANGES.md.
 */
export type V2DailyShellIntents = {
  /** `anchorTransition`: the Anchor is travelling into Practice, so the route must not animate itself. */
  onOpenPractice?: (
    anchorId: string,
    recommendedMode?: V2PracticeMode,
    options?: { anchorTransition?: boolean; returnRoute?: string; source?: string }
  ) => void;
  onOpenVision?: (anchorId: string, options?: { edit?: boolean }) => void;
  onCreateVision?: (anchorId: string) => void;
  onOpenChart?: (anchorId?: string, courseId?: string) => void;
  onCreateChart?: (anchorId: string) => void;
  /** `anchorTransition`: the Anchor is travelling into Progress, so the route only cross-fades beneath it. */
  onOpenProgress?: (anchorId?: string, options?: { anchorTransition?: boolean }) => void;
  onCreateAnchor?: () => void;
  onOpenProfile?: () => void;
  onReleaseAnchor?: (anchorId: string, options?: { anchorTransition?: boolean }) => void;
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
  return (
    <ProgressiveFocusTransitionProvider>
      <IntentsContext.Provider value={intents}>{children}</IntentsContext.Provider>
    </ProgressiveFocusTransitionProvider>
  );
}

export function useV2DailyShellIntents(): Required<
  Pick<V2DailyShellIntents, 'onOpenPractice' | 'onOpenVision' | 'onCreateVision' | 'onOpenChart' | 'onCreateChart' | 'onOpenProgress' | 'onCreateAnchor' | 'onOpenProfile' | 'onReleaseAnchor' | 'onOpenWeeklyInsight'>
> {
  const value = useContext(IntentsContext);
  const navigation = useNavigation<NativeStackNavigationProp<AnchorV2StackParamList>>();
  /**
   * Memoised on the context value. Home's sections are memoised and every one
   * of its handlers closes over these intents, so re-deriving this object each
   * render re-rendered the entire page on any state change - including on the
   * frames where the Anchor carousel is settling.
   */
  return useMemo(() => ({
    onOpenPractice: value.onOpenPractice ?? ((anchorId, recommendedMode, options) => {
      if (recommendedMode && (recommendedMode === 'deep_prime' || recommendedMode === 'visualize') && isProFeatureLocked()) {
        navigation.navigate('V2Paywall', {
          context: recommendedMode === 'visualize' ? 'VISUALIZE' : 'DEEP_PRIME',
          resumeIntent: {
            type: 'open_practice',
            anchorId,
            mode: recommendedMode === 'deep_prime' ? 'deep' : 'focus',
            practiceMode: recommendedMode,
            source: options?.source === 'practice_hub' ? 'practice_hub' : 'recommended_today',
            returnRoute: options?.returnRoute ?? (recommendedMode ? 'V2DevelopmentHome' : undefined),
          },
        });
        return;
      }
      navigation.navigate('V2Practice', {
        anchorId,
        recommendedMode,
        resumeMode: undefined,
        resumeDuration: undefined,
        resumeSource: undefined,
        visionEntry: undefined,
        ...(options?.anchorTransition ? { anchorTransition: true } : { anchorTransition: undefined }),
        returnRoute: options?.returnRoute ?? (recommendedMode ? 'V2DevelopmentHome' : undefined),
        source: options?.source ?? (recommendedMode ? 'home' : 'practice_hub'),
      });
    }),
    onOpenVision: value.onOpenVision ?? ((anchorId, options) => {
      if (isProFeatureLocked()) {
        navigation.navigate('V2Paywall', {
          context: 'VISUALIZE',
          resumeIntent: { type: 'vision_premium_action', anchorId, action: 'create' },
        });
        return;
      }
      navigation.navigate('V2Vision', { anchorId, ...(options?.edit ? { edit: true } : {}) });
    }),
    onCreateVision: value.onCreateVision ?? ((anchorId) => {
      if (isProFeatureLocked()) {
        navigation.navigate('V2Paywall', {
          context: 'VISUALIZE',
          resumeIntent: { type: 'vision_premium_action', anchorId, action: 'create' },
        });
        return;
      }
      navigation.navigate('V2Vision', { anchorId });
    }),
    onOpenChart: value.onOpenChart ?? ((anchorId, courseId) => {
      if (isProFeatureLocked()) {
        navigation.navigate('V2Paywall', {
          context: 'CHART',
          resumeIntent: anchorId ? { type: 'open_chart', anchorId } : undefined,
        });
        return;
      }
      navigation.navigate('V2Chart', { anchorId, courseId });
    }),
    onCreateChart: value.onCreateChart ?? ((anchorId) => {
      if (isProFeatureLocked()) {
        navigation.navigate('V2Paywall', {
          context: 'CHART',
          resumeIntent: { type: 'open_chart', anchorId },
        });
        return;
      }
      navigation.navigate('V2Chart', { anchorId });
    }),
    onOpenProgress: value.onOpenProgress ?? ((anchorId, options) => navigation.navigate('V2Progress', { anchorId, ...(options?.anchorTransition ? { anchorTransition: true } : {}) })),
    onCreateAnchor: value.onCreateAnchor ?? (() => {
      discoverGuidance(useAuthStore.getState().user?.id ?? 'guest', 'creation.opened');
      if (isProFeatureLocked()) {
        navigation.navigate('V2Paywall', {
          context: 'SECOND_ANCHOR',
          resumeIntent: { type: 'create_anchor' },
        });
        return;
      }
      navigation.navigate('FirstAnchorCreation');
    }),
    onOpenProfile: value.onOpenProfile ?? (() => navigation.navigate('V2Settings')),
    onReleaseAnchor: value.onReleaseAnchor ?? ((anchorId, options) => navigation.navigate('V2Release', { anchorId, ...(options?.anchorTransition ? { anchorTransition: true } : {}) })),
    onOpenWeeklyInsight: value.onOpenWeeklyInsight ?? (() => navigation.navigate('V2WeeklyInsight')),
  }), [value, navigation]);
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
  // Keep the shared default for other routes; Details uses the Anchor hero
  // layer and disables its native stack animation below.
  const screenOptions = useMemo(() => v2StackScreenOptions(reduceMotion), [reduceMotion]);
  return (
    <ProgressiveFocusTransitionProvider>
      <IntentsContext.Provider value={value}>
        {/* TEMP-PROFILER */}<React.Profiler id="dailyShell" onRender={(_id, phase, actual) => { if (__DEV__ && actual > 4) VisualProfiler.record('commit', { phase, ms: Math.round(actual) }); }}>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="V2Home" component={V2HomeScreen} />
          <Stack.Screen name="V2AnchorLibrary" component={V2AnchorLibraryScreen} />
          <Stack.Screen name="V2AnchorDetails" component={V2AnchorDetailsScreen} options={DETAILS_OPTIONS} />
        </Stack.Navigator>
        </React.Profiler>
      </IntentsContext.Provider>
    </ProgressiveFocusTransitionProvider>
  );
}

const DETAILS_OPTIONS = { ...v2ScreenBackground('paper'), animation: 'none' as const };
