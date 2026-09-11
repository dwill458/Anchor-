import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PracticeStackNavigator } from '@/navigation/PracticeStackNavigator';
import { AnchorV2Navigator } from './AnchorV2Navigator';
import type { PracticeLaunchRequest } from '@/types/practice';
import { registerPracticeCompletionReturn, type PracticeCompletionReturn } from '@/navigation/practiceCompletionReturn';
import { createPracticeEventId } from '@/utils/primingAnalytics';

export type { PracticeLaunchRequest } from '@/types/practice';

const PracticeLaunchContext = createContext<((request: PracticeLaunchRequest) => void) | null>(null);
const PracticeCompletionContext = createContext<PracticeCompletionReturn | null>(null);

export function usePracticeLaunch(): (request: PracticeLaunchRequest) => void {
  const launch = useContext(PracticeLaunchContext);
  if (!launch) throw new Error('Practice launch host is unavailable.');
  return launch;
}

export function usePracticeCompletionReturn(): PracticeCompletionReturn | null {
  return useContext(PracticeCompletionContext);
}

/** Development-only common host. It mounts exactly one existing PracticeStack. */
export function AnchorV2PracticeHost() {
  const [request, setRequest] = useState<PracticeLaunchRequest | null>(null);
  const [completion, setCompletion] = useState<PracticeCompletionReturn | null>(null);
  const launch = useCallback((next: PracticeLaunchRequest) => {
    setCompletion(null);
    setRequest({ ...next, sessionId: next.sessionId ?? createPracticeEventId() });
  }, []);
  React.useEffect(() => registerPracticeCompletionReturn((result) => {
    if (result.returnTarget === 'v2_practice') {
      setCompletion(result);
      setRequest(null);
    }
  }), []);
  return (
    <PracticeLaunchContext.Provider value={launch}>
      <PracticeCompletionContext.Provider value={completion}>
      <View style={styles.host}>
        <View style={[styles.host, request ? styles.hidden : undefined]}><AnchorV2Navigator /></View>
      {request ? (
        <PracticeStackNavigator
          launchRequest={request}
          onReturnToV2={() => setRequest(null)}
        />
      ) : null}
      </View>
      </PracticeCompletionContext.Provider>
    </PracticeLaunchContext.Provider>
  );
}
const styles = StyleSheet.create({ host: { flex: 1 }, hidden: { display: 'none' } });
