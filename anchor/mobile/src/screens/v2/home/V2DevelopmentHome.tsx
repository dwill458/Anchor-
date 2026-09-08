import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { V2DailyShellNavigator, type V2DailyShellIntents } from './dailyShell';

/**
 * Post-first-run destination inside the development-only AnchorV2Navigator.
 * It now hosts the real UI-D daily shell (Home / Your Anchors / Anchor
 * Details).
 *
 * External navigation intents (Practice, Vision, Chart, Progress, Create
 * Anchor, Release) belong to other workstreams and are intentionally left to
 * dev warnings here. Production integration supplies the real routes — see
 * REQUIRED_INTEGRATION_CHANGES.md. The Profile utility is repurposed in this
 * dev host only to keep the V2 System Gallery reachable.
 */
export function V2DevelopmentHome() {
  const navigation = useNavigation<any>();
  const intents = useMemo<V2DailyShellIntents>(
    () => ({
      onOpenProfile: () => navigation.navigate('V2SystemGallery'),
    }),
    [navigation],
  );
  return <V2DailyShellNavigator intents={intents} />;
}
