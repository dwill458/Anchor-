import React, { useCallback, useState } from 'react';
import { V2WeeklyInsightScreen } from '@/screens/v2/weeklyInsight';
import { useAnchorStore } from '@/stores/anchorStore';
import { V2WeeklyRecapScreen } from './V2WeeklyRecapScreen';
import { isWeeklyInsightV2Enabled } from '@/constants/v2/weeklyInsightFlags';
import type { V2WeeklyInsightRouteParams } from '@/constants/v2/weeklyInsightRoutes';

/**
 * Route entry for `V2WeeklyInsight`. Existing entry points (Home, Progress) keep navigating to
 * this same route. The global recap opens when the flag is on; a request for a specific classic
 * snapshot or week offset (historic deep links) always opens the classic screen, and the classic
 * screen stays the fallback if the server flag is off.
 */
export function WeeklyInsightEntry({ params, navigation }: { params?: V2WeeklyInsightRouteParams; navigation: any }) {
  const [classic, setClassic] = useState(false);
  const anchors = useAnchorStore((st) => st.anchors || []);
  // Deep links are only offered for active Anchors. Archived or released Anchors have no verified
  // Chart/Practice destination, so those actions fall back to a global target instead.
  const navigableAnchor = useCallback((id?: string) => {
    const a: any = id ? anchors.find((x: any) => x.id === id) : undefined;
    return a && a.isArchived !== true && !a.archivedAt && !a.releasedAt ? id : undefined;
  }, [anchors]);
  const useClassic = useCallback(() => setClassic(true), []);
  const route = { params };
  const legacyRequested = Boolean(params?.snapshotId) || (params?.weekOffset ?? 0) > 0;
  if (!isWeeklyInsightV2Enabled() || classic || legacyRequested) {
    return <V2WeeklyInsightScreen route={route} navigation={navigation} onBack={() => navigation.goBack()} />;
  }
  return (
    <V2WeeklyRecapScreen
      anchorId={params?.anchorId}
      onBack={() => navigation.goBack()}
      onUseClassic={useClassic}
      onNavigateToChart={(anchorId) => {
        const id = navigableAnchor(anchorId);
        navigation.navigate('V2Chart', id ? { anchorId: id } : undefined);
      }}
      onStartPractice={(anchorId) => {
        const id = navigableAnchor(anchorId);
        if (id) navigation.navigate('V2PracticePrepare', { anchorId: id });
        else navigation.popToTop();
      }}
    />
  );
}
