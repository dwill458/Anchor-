import React, { useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useV2AnchorCreationGate } from '@/hooks/v2/paywall';
import { V2DailyShellNavigator, type V2DailyShellIntents } from './dailyShell';

/**
 * Post-first-run destination inside the development-only AnchorV2Navigator.
 * It hosts the real UI-D daily shell (Home / Your Anchors / Anchor Details)
 * and wires external navigation intents to the real V2 screens.
 */
export function V2DevelopmentHome() {
  const navigation = useNavigation<any>();
  // Read through a ref: the intents must keep one identity (Home's sections are memoised on
  // them), while the gate's answer changes whenever Anchors or entitlement do.
  const gate = useV2AnchorCreationGate();
  const creationGate = useRef(gate);
  creationGate.current = gate;
  const intents = useMemo<V2DailyShellIntents>(
    () => ({
      onOpenPractice: (anchorId, recommendedMode) => navigation.navigate('V2Practice', { anchorId, recommendedMode }),
      onOpenVision: (anchorId) => navigation.navigate('V2Vision', { anchorId }),
      onCreateVision: (anchorId) => navigation.navigate('V2Vision', { anchorId }),
      onOpenChart: (anchorId, courseId) => navigation.navigate('V2Chart', { anchorId, courseId }),
      onCreateChart: (anchorId) => navigation.navigate('V2Chart', { anchorId }),
      onOpenProgress: (anchorId) => navigation.navigate('V2Progress', { anchorId }),
      // The first Anchor is always allowed; a second one on the free plan opens the paywall,
      // which resumes creation once entitled. The server enforces the same rule on save.
      onCreateAnchor: () => {
        const decision = creationGate.current.evaluate();
        if (decision.allowed) navigation.navigate('V2Creation');
        else navigation.navigate('V2Paywall', { context: decision.paywallContext, resumeIntent: { type: 'create_anchor' } });
      },
      onOpenProfile: () => navigation.navigate('V2Settings'),
      onOpenWeeklyInsight: () => navigation.navigate('V2WeeklyInsight'),
      onOpenMaterialLab: () => navigation.navigate('V2EvolvingAnchor'),
      onReleaseAnchor: (anchorId) => navigation.navigate('V2Release', { anchorId }),
    }),
    [navigation],
  );
  return <V2DailyShellNavigator intents={intents} />;
}
