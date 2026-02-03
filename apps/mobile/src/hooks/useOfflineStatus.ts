/**
 * Anchor App - Offline Status Hook
 *
 * Lightweight derived offline status with optional pending action queue.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAnchorStore } from '@/stores/anchorStore';

export interface PendingAction {
  id: string;
  type: string;
  timestamp: string;
  anchorId?: string;
  anchorLabel?: string;
}

const PENDING_ACTIONS_KEY = 'anchor:pending-actions';

const parsePendingActions = (raw: string | null): PendingAction[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingAction[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string');
  } catch {
    return [];
  }
};

export const useOfflineStatus = () => {
  const netInfo = useNetInfo();
  const lastSyncedAt = useAnchorStore((state) => state.lastSyncedAt);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPendingActions = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
      setPendingActions(parsePendingActions(raw));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPendingActions();
  }, [refreshPendingActions]);

  const isOnline = netInfo.isConnected === true && netInfo.isInternetReachable !== false;

  return {
    isOnline,
    lastSyncedAt,
    pendingActions,
    isLoading,
    refreshPendingActions,
  };
};
