import React, { useState } from 'react';
import { ENABLE_WEEKLY_RECAP_V2 } from '@/config';
import { V2WeeklyInsightScreen } from './V2WeeklyInsightScreen';
import { V2WeeklyRecapScreen } from './V2WeeklyRecapScreen';

type Props = { navigation?: any; route?: { params?: { anchorId?: string; snapshotId?: string; weekOffset?: number; weekKey?: string } }; onBack?: () => void };

/**
 * The single `V2WeeklyInsight` route. The legacy screen stays the default until the client flag is on AND the server
 * agrees. A legacy snapshot id (history from before 2.0) always opens the legacy screen, so old weeks stay reachable.
 */
export function V2WeeklyInsightEntry(props: Props) {
  const [serverOff, setServerOff] = useState(false);
  const legacyRequested = Boolean(props.route?.params?.snapshotId) || props.route?.params?.weekOffset != null;
  if (!ENABLE_WEEKLY_RECAP_V2 || serverOff || legacyRequested) return <V2WeeklyInsightScreen {...props} />;
  return <V2WeeklyRecapScreen {...props} onDisabled={() => setServerOff(true)} />;
}
