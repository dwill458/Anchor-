import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { localDateString } from '@/utils/primingAnalytics';
import type { ChartLogRow } from './ChartPanelCards';

const MAX_ROWS = 4;

function trim(text: string): string {
  return text.length > 46 ? `${text.slice(0, 44).trim()}…` : text;
}

function whenLabel(at: Date, now: Date): string {
  if (localDateString(at) === localDateString(now)) return 'Today';
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * The newest few facts of the course, from server data only: completed Moves
 * and reached waypoints. The full, immutable log lives on its own screen.
 */
export function buildChartLogRows(view: ChartViewModel, now: Date): ChartLogRow[] {
  const entries: Array<{ at: Date; key: string; text: string }> = [];
  for (const waypoint of view.waypoints) {
    for (const move of waypoint.moves) {
      if (move.status !== 'COMPLETED' || !move.completedAt) continue;
      const at = new Date(move.completedAt);
      if (!Number.isNaN(at.getTime())) entries.push({ at, key: `m:${move.id}`, text: `Move completed — ${trim(move.title)}` });
    }
    if (waypoint.reachedAt) {
      const at = new Date(waypoint.reachedAt);
      if (!Number.isNaN(at.getTime())) entries.push({ at, key: `w:${waypoint.id}`, text: `Waypoint reached — ${trim(waypoint.title)}` });
    }
  }
  return entries
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_ROWS)
    .map((entry) => ({ key: entry.key, when: whenLabel(entry.at, now), text: entry.text }));
}
