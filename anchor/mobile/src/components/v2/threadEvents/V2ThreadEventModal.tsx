import React from 'react';
import type { V2ThreadEventBundle } from '@/adapters/v2/threadEvents';
import { V2ThreadEventCelebration } from './V2ThreadEventCelebration';

type Props = { bundle: V2ThreadEventBundle | null; visible: boolean; anchorSvg?: string | null; category?: string | null; reducedMotion?: boolean; onPresented?: () => void; onAcknowledge: () => void; onDismiss: () => void; testID?: string };
/** Public queue presentation modal. Detail inspection is exported separately for Progress/Archive wiring. */
export function V2ThreadEventModal(props: Props) {
  return <V2ThreadEventCelebration {...props} />;
}
