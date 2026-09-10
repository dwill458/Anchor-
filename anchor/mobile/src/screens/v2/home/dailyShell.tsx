import React, { createContext, useContext, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme/v2';
import { V2HomeScreen } from './V2HomeScreen';
import { V2AnchorLibraryScreen } from '@/screens/v2/anchors/V2AnchorLibraryScreen';
import { V2AnchorDetailsScreen } from '@/screens/v2/anchors/V2AnchorDetailsScreen';

/**
 * External navigation intents UI-D exposes but does not own. Production
 * integration wires these to the real V2 routes (Agent 1 / UI-C / UI-G). See
 * REQUIRED_INTEGRATION_CHANGES.md.
 */
export type V2DailyShellIntents = {
  onOpenPractice?: (anchorId: string) => void;
  onOpenVision?: (anchorId: string) => void;
  onCreateVision?: (anchorId: string) => void;
  onOpenChart?: (anchorId?: string) => void;
  onCreateChart?: (anchorId: string) => void;
  onOpenProgress?: (anchorId?: string) => void;
  onCreateAnchor?: () => void;
  onOpenProfile?: () => void;
  onReleaseAnchor?: (anchorId: string) => void;
  onOpenWeeklyInsight?: () => void;
};

const noopWarn = (name: string) => () => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[V2DailyShell] intent "${name}" is not wired. See REQUIRED_INTEGRATION_CHANGES.md`);
  }
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
  return {
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
  };
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
  return (
    <IntentsContext.Provider value={value}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="V2Home" component={V2HomeScreen} />
        <Stack.Screen name="V2AnchorLibrary" component={V2AnchorLibraryScreen} />
        <Stack.Screen name="V2AnchorDetails" component={V2AnchorDetailsScreen} />
      </Stack.Navigator>
    </IntentsContext.Provider>
  );
}
