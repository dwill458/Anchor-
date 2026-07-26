/**
 * Maps a widget name + WidgetSnapshot to the matching Android widget element.
 * Used by both the widget task handler (system-triggered renders) and the
 * data bridge (app-triggered refreshes).
 *
 * The primed state is recomputed from `lastPrimedDate` at render time so a
 * system re-render after local midnight flips the widget back to
 * "Ready to Prime" without waiting for the app to sync a fresh snapshot.
 */

import React from 'react';
import { localDateString } from '@/utils/primingAnalytics';
import type { WidgetName, WidgetSnapshot } from '../widgetTypes';
import { AnchorSmallWidget } from './AnchorSmallWidget';
import { AnchorMediumWidget } from './AnchorMediumWidget';
import { AnchorLargeWidget } from './AnchorLargeWidget';

export function renderAnchorWidgetByName(
  widgetName: WidgetName | string,
  snapshot: WidgetSnapshot,
  /** Launcher-reported widget size (dp), when known — keeps the 4×4 heatmap cells square. */
  dimensions?: { width: number; height: number }
): React.ReactElement {
  const today = localDateString(new Date());
  const primed = snapshot.lastPrimedDate === today;

  switch (widgetName) {
    case 'AnchorMediumWidget':
      return (
        <AnchorMediumWidget
          primed={primed}
          anchorName={snapshot.anchorName}
          sigilSvg={snapshot.sigilSvg}
          anchorTotalSessions={snapshot.anchorTotalSessions ?? 0}
          anchorDayStreak={snapshot.anchorDayStreak ?? 0}
          anchorDeepPrimeSessions={snapshot.anchorDeepPrimeSessions ?? 0}
        />
      );
    case 'AnchorLargeWidget':
      return (
        <AnchorLargeWidget
          primed={primed}
          anchorName={snapshot.anchorName}
          sigilSvg={snapshot.sigilSvg}
          artworkImageUri={snapshot.artworkImageUri}
          streak={snapshot.streak}
          threadStrength={snapshot.threadStrength ?? 0}
          totalSessions={snapshot.totalSessions ?? 0}
          focusSessions={snapshot.focusSessions ?? 0}
          deepPrimeSessions={snapshot.deepPrimeSessions ?? 0}
          visualizeSessions={snapshot.visualizeSessions ?? 0}
          releaseSessions={snapshot.releaseSessions ?? 0}
          deepPrimePercent={snapshot.deepPrimePercent ?? 0}
          constancyPercent={snapshot.constancyPercent ?? 0}
          longestStreak={snapshot.longestStreak ?? 0}
          sensitivityLabel={snapshot.sensitivityLabel ?? 'Balanced'}
          sensitivityNote={snapshot.sensitivityNote ?? '1 grace day before decay begins.'}
          currentWeek={snapshot.currentWeek ?? []}
          history={snapshot.history}
          today={today}
          widgetWidth={dimensions?.width}
        />
      );
    case 'AnchorSmallWidget':
    default:
      return (
        <AnchorSmallWidget
          primed={primed}
          anchorId={snapshot.anchorId}
          sigilSvg={snapshot.sigilSvg}
          artworkImageUri={null}
        />
      );
  }
}
