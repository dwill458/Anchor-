import React, { createContext, useCallback, useContext, useState } from 'react';
import { PracticeStackNavigator } from '@/navigation/PracticeStackNavigator';
import { AnchorV2Navigator } from './AnchorV2Navigator';
import type { PracticeEntrySource } from '@/types/practice';

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
  return (
    <PracticeLaunchContext.Provider value={launch}>
      {request ? (
        <PracticeStackNavigator
          launchRequest={request}
          onReturnToV2={() => setRequest(null)}
        />
      ) : <AnchorV2Navigator />}
    </PracticeLaunchContext.Provider>
  );
}
