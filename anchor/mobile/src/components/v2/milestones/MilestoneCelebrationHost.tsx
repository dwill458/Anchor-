import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useMilestonePresentationHold } from '@/hooks/v2/milestones/useMilestonePresentationHold';
import { getCategoryColor } from '@/theme/v2';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { useMilestonePresenter } from '@/hooks/v2/milestones/useMilestonePresenter';
import { MilestoneCelebrationScene } from './MilestoneCelebrationScene';

/**
 * Mounted once at the navigator. Plays queued milestone celebrations after any practice
 * completion scene has settled, one at a time, over whatever screen the user is on.
 */
export const MilestoneCelebrationHost: React.FC = () => {
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const lastAccount = useRef(accountId);
  useLayoutEffect(() => {
    if (lastAccount.current !== accountId) {
      lastAccount.current = accountId;
      useMilestoneCelebrationStore.getState().reset();
    }
  }, [accountId]);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  useMilestonePresentationHold(!active);
  const { presenting, finish } = useMilestonePresenter();
  const reducedMotion = useCelebrationReduceMotion();
  const category = useAnchorStore((state) =>
    presenting ? state.anchors.find((anchor) => anchor.id === presenting.record.anchorId)?.category : undefined,
  );
  if (!presenting || !active || (presenting.accountId && presenting.accountId !== accountId)) return null;
  return (
    <MilestoneCelebrationScene
      key={presenting.key}
      record={presenting.record}
      mode={presenting.mode}
      transition={presenting.transition ?? false}
      origin={presenting.origin}
      categoryColor={getCategoryColor(category)}
      reducedMotion={reducedMotion}
      onContinue={finish}
      onBackToMilestones={presenting.onReturn}
    />
  );
};
