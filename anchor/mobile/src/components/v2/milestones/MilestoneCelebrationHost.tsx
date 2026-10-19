import React from 'react';
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
  const { presenting, finish } = useMilestonePresenter();
  const reducedMotion = useCelebrationReduceMotion();
  const category = useAnchorStore((state) =>
    presenting ? state.anchors.find((anchor) => anchor.id === presenting.record.anchorId)?.category : undefined,
  );
  if (!presenting) return null;
  return (
    <MilestoneCelebrationScene
      key={presenting.key}
      record={presenting.record}
      mode={presenting.mode}
      categoryColor={getCategoryColor(category)}
      reducedMotion={reducedMotion}
      onContinue={finish}
    />
  );
};
