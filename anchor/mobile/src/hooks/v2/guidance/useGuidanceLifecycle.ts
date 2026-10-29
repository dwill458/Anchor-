import { useEffect, useLayoutEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSessionStore } from '@/stores/sessionStore';
import { setGuidancePracticeSnapshotProvider } from '@/stores/v2/guidanceRecords';
import { bindGuidanceAccount, discoverGuidance, mountGuidanceRuntime } from './guidanceRuntime';

setGuidancePracticeSnapshotProvider(() => {
  const state = useSessionStore.getState();
  return Boolean((state?.sessionLog?.length ?? 0) > 0 || (state?.practiceHistory?.length ?? 0) > 0 || (state?.totalSessionsCount ?? 0) > 0);
});

/** Shell lifetime covers account changes even when no teaching screen is mounted. */
export function useGuidanceLifecycle() {
  const account = useAuthStore(state => state.user?.id ?? 'guest');
  useLayoutEffect(() => { void bindGuidanceAccount(account); }, [account]);
  useEffect(mountGuidanceRuntime, []);
  useEffect(() => {
    const readHistory = () => {
      const state = useCourseStore.getState();
      if ((state.accountId ?? 'guest') !== account || state.initializationStatus !== 'ready') return;
      if (state.activeCourse?.moves?.some(move => move.status === 'COMPLETED')) discoverGuidance(account, 'chart.next_move');
    };
    readHistory();
    return useCourseStore.subscribe(readHistory);
  }, [account]);
}
