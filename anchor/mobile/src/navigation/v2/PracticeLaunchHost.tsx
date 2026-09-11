import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PracticeStackNavigator } from '@/navigation/PracticeStackNavigator';
import { AnchorV2Navigator } from './AnchorV2Navigator';
import type { PracticeEntrySource } from '@/types/practice';
import { registerPracticeCompletionReturn } from '@/navigation/practiceCompletionReturn';

export type PracticeLaunchRequest = {
  anchorId: string;
  mode: 'focus' | 'deep_prime' | 'visualize';
  durationSeconds: number;
  source: PracticeEntrySource;
  visionId?: string;
  assetId?: string;
  courseId?: string;
  waypointId?: string;
  returnTarget: 'v2_practice';
};

const PracticeLaunchContext = createContext<((request: PracticeLaunchRequest) => void) | null>(null);

export function usePracticeLaunch(): (request: PracticeLaunchRequest) => void {
  const launch = useContext(PracticeLaunchContext);
  if (!launch) throw new Error('Practice launch host is unavailable.');
  return launch;
}

/** Development-only common host. It mounts exactly one existing PracticeStack. */
export function AnchorV2PracticeHost() {
  const [request, setRequest] = useState<PracticeLaunchRequest | null>(null);
  const launch = useCallback((next: PracticeLaunchRequest) => setRequest(next), []);
  React.useEffect(() => registerPracticeCompletionReturn(() => setRequest(null)), []);
  return (
    <PracticeLaunchContext.Provider value={launch}>
      <View style={styles.host}>
        <View style={[styles.host, request ? styles.hidden : undefined]}><AnchorV2Navigator /></View>
      {request ? (
        <PracticeStackNavigator
          launchRequest={request}
          onReturnToV2={() => setRequest(null)}
        />
      ) : null}
      </View>
    </PracticeLaunchContext.Provider>
  );
}
const styles = StyleSheet.create({ host: { flex: 1 }, hidden: { display: 'none' } });
