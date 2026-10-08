import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { DevSettings, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { AnchorV2StackParamList } from '@/navigation/v2/types';
import { useV2AnchorCreationGate } from '@/hooks/v2/paywall';
import { isProFeatureLocked } from '@/utils/premiumAccess';
import { V2DailyShellNavigator, type V2DailyShellIntents } from './dailyShell';
import { V2DevFloatingToolbar } from './V2DevFloatingToolbar';
import { VisionHomeReturnProvider } from './visionHomeReturn';
import { seedV2DemoAnchor } from '@/utils/v2DevSeeder';

/**
 * Post-first-run destination inside the development-only AnchorV2Navigator.
 * It hosts the real UI-D daily shell (Home / Your Anchors / Anchor Details)
 * and wires external navigation intents to the real V2 screens.
 */
export function V2DevelopmentHome() {
  const navigation = useNavigation<any>();
  // The first Vision image asks Home to play its return with this param; Home clears it once it has taken it.
  const route = useRoute<RouteProp<AnchorV2StackParamList, 'V2DevelopmentHome'>>();
  const visionReturn = route.params?.visionReturn ?? null;
  const consumeVisionReturn = useCallback(() => navigation.setParams({ visionReturn: undefined }), [navigation]);

  useEffect(() => {
    DevSettings.addMenuItem?.('Seed demo Anchor + Vision + Chart', () => {
      seedV2DemoAnchor();
    });
  }, []);

  // Read through a ref: the intents must keep one identity (Home's sections are memoised on
  // them), while the gate's answer changes whenever Anchors or entitlement do.
  const gate = useV2AnchorCreationGate();
  const creationGate = useRef(gate);
  creationGate.current = gate;
  const intents = useMemo<V2DailyShellIntents>(
    () => ({
      onOpenPractice: (anchorId, recommendedMode, options) => navigation.navigate('V2Practice', {
        anchorId,
        recommendedMode,
        ...(options?.anchorTransition ? { anchorTransition: true } : {}),
        returnRoute: options?.returnRoute ?? (recommendedMode ? 'V2DevelopmentHome' : undefined),
        source: options?.source ?? (recommendedMode ? 'home' : 'practice_hub'),
      }),
      onOpenVision: (anchorId, options) => navigation.navigate('V2Vision', { anchorId, ...(options?.edit ? { edit: true } : {}) }),
      onCreateVision: (anchorId) => navigation.navigate('V2Vision', { anchorId }),
      onOpenChart: (anchorId, courseId) => navigation.navigate('V2Chart', { anchorId, courseId }),
      // Viewing a Chart is free; creating one is Pro (the server refuses it too).
      onCreateChart: (anchorId) => {
        if (isProFeatureLocked()) navigation.navigate('V2Paywall', { context: 'CHART', resumeIntent: { type: 'open_chart', anchorId } });
        else navigation.navigate('V2Chart', { anchorId });
      },
      onOpenProgress: (anchorId) => navigation.navigate('V2Progress', { anchorId }),
      // The first Anchor is always allowed; a second one on the free plan opens the paywall,
      // which resumes creation once entitled. The server enforces the same rule on save.
      onCreateAnchor: () => {
        const decision = creationGate.current.evaluate();
        if (decision.allowed) navigation.navigate('FirstAnchorCreation');
        else navigation.navigate('V2Paywall', { context: decision.paywallContext, resumeIntent: { type: 'create_anchor' } });
      },
      onOpenProfile: () => navigation.navigate('V2Settings'),
      onOpenWeeklyInsight: () => navigation.navigate('V2WeeklyInsight'),
      onOpenMaterialLab: () => navigation.navigate('V2EvolvingAnchor'),
      onReleaseAnchor: (anchorId, options) => navigation.navigate('V2Release', { anchorId, ...(options?.anchorTransition ? { anchorTransition: true } : {}) }),
    }),
    [navigation],
  );
  return (
    <View style={{ flex: 1 }}>
      <VisionHomeReturnProvider request={visionReturn} consume={consumeVisionReturn}>
        <V2DailyShellNavigator intents={intents} />
      </VisionHomeReturnProvider>
      <V2DevFloatingToolbar />
    </View>
  );
}
