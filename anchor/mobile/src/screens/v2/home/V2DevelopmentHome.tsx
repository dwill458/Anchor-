import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { V2DailyShellNavigator, type V2DailyShellIntents } from './dailyShell';

/**
 * Post-first-run destination inside the development-only AnchorV2Navigator.
 * It hosts the real UI-D daily shell (Home / Your Anchors / Anchor Details)
 * and wires external navigation intents to the real V2 screens.
 */
export function V2DevelopmentHome() {
  const navigation = useNavigation<any>();
  const intents = useMemo<V2DailyShellIntents>(
    () => ({
      onOpenPractice: (anchorId) => navigation.navigate('V2Practice', { anchorId }),
      onOpenVision: (anchorId) => navigation.navigate('V2Vision', { anchorId }),
      onCreateVision: (anchorId) => navigation.navigate('V2Vision', { anchorId }),
      onOpenChart: (anchorId) => navigation.navigate('V2Chart', { courseId: anchorId }),
      onCreateChart: (anchorId) => navigation.navigate('V2Chart', { courseId: anchorId }),
      onOpenProgress: (anchorId) => navigation.navigate('V2Progress', { anchorId }),
      onCreateAnchor: () => navigation.navigate('V2Creation'),
      onOpenProfile: () => navigation.navigate('V2SystemGallery'),
      onOpenWeeklyInsight: () => navigation.navigate('V2WeeklyInsight'),
      onReleaseAnchor: (anchorId) => navigation.navigate('V2Release', { anchorId }),
    }),
    [navigation],
  );
  return <V2DailyShellNavigator intents={intents} />;
}
