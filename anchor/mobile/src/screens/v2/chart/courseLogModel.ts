import type { V2PracticeMode } from '@/constants/v2/practice';

/** One helper for every duration on the Course log: rows, day totals and the list total. */
export function formatCourseDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} sec`;
  if (total % 60 === 0) return `${total / 60} min`;
  return `${(total / 60).toFixed(1)} min`;
}

/** Maps any stored practice-mode spelling ('deep_prime', 'Deep Prime', 'DeepPrime'...) to the app's mode id. */
export function practiceModeKey(mode?: string | null): V2PracticeMode {
  const normalized = (mode ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (normalized.includes('prime')) return 'deep_prime';
  if (normalized.includes('visual')) return 'visualize';
  if (normalized.includes('release')) return 'release';
  return 'focus';
}

export type CourseLogRow = {
  id: string;
  timestamp: string;
  /** 'session' rows are practice sessions and are the only rows counted and totalled. */
  kind: 'session' | 'event';
  title: string;
  mode?: V2PracticeMode;
  seconds?: number;
  /** The person's own reflection on the session, when one is attached to the record. */
  note?: string | null;
  eventType?: 'MOVE_COMPLETED' | 'PROGRESS_UPDATED' | 'WAYPOINT_REACHED' | 'OTHER';
  detail?: string | null;
};

export type CourseLogDay = { key: string; label: string; meta: string; sessions: number; seconds: number; rows: CourseLogRow[] };

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function courseLogDayKey(timestamp: string): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Newest day first; newest row first inside a day. */
export function buildCourseLogDays(rows: CourseLogRow[], now: Date): CourseLogDay[] {
  const sorted = [...rows].filter(row => courseLogDayKey(row.timestamp)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const days: CourseLogDay[] = [];
  for (const row of sorted) {
    const key = courseLogDayKey(row.timestamp);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: '', meta: '', sessions: 0, seconds: 0, rows: [] };
      days.push(day);
    }
    day.rows.push(row);
    if (row.kind === 'session') {
      day.sessions += 1;
      day.seconds += row.seconds ?? 0;
    }
  }
  for (const day of days) {
    const d = new Date(day.rows[0].timestamp);
    const near = sameDay(d, now) ? 'Today' : sameDay(d, yesterday) ? 'Yesterday' : null;
    day.label = near ?? shortDate(d);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const when = near ? `${weekday}, ${shortDate(d)}` : weekday;
    const count = day.sessions ? (day.sessions === 1 ? '1 session' : `${day.sessions} sessions`) : null;
    day.meta = [when, count, day.sessions ? formatCourseDuration(day.seconds) : null].filter(Boolean).join(' · ');
  }
  return days;
}

export function courseLogTotals(rows: CourseLogRow[]): { sessions: number; seconds: number } {
  return rows.reduce((acc, row) => (row.kind === 'session' ? { sessions: acc.sessions + 1, seconds: acc.seconds + (row.seconds ?? 0) } : acc), { sessions: 0, seconds: 0 });
}

/** Geometry for the etched route strip: one node per waypoint (any count), the current one flagged, an X at the end. */
export type StripNode = { index: number; x: number; y: number; state: 'reached' | 'current' | 'upcoming' };
export function courseStripLayout(total: number, reachedCount: number): { nodes: StripNode[]; endX: number; complete: boolean } {
  const count = Math.max(0, Math.floor(total));
  const complete = count > 0 && reachedCount >= count;
  const left = 22;
  const right = 308;
  const nodes: StripNode[] = Array.from({ length: count }, (_, index) => ({
    index,
    x: count === 1 ? left : left + (index * (right - left)) / (count - 1),
    y: 28 + Math.round(Math.sin(index * 1.7) * 2),
    state: index < reachedCount ? 'reached' : index === reachedCount && !complete ? 'current' : 'upcoming',
  }));
  return { nodes, endX: 344, complete };
}
