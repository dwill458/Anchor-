export type ChartDeepLinkTarget =
  | { kind: 'chart_home' }
  | { kind: 'course'; courseId: string }
  | { kind: 'waypoint'; courseId: string; waypointId: string }
  | { kind: 'log'; courseId: string };

let initialDeepLinkClaimed = false;

/** Claim the cold-start URL once across the authenticated and auth flows. */
export function claimInitialDeepLink(): boolean {
  if (initialDeepLinkClaimed) return false;
  initialDeepLinkClaimed = true;
  return true;
}

export function resetInitialDeepLinkClaimForTests(): void {
  initialDeepLinkClaimed = false;
}

function decodeSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

export function parseChartDeepLink(url: string | null | undefined): ChartDeepLinkTarget | null {
  if (!url) return null;
  const match = url.trim().match(/^anchor:\/\/+chart(?:\/([^/?#]+)(?:\/(waypoint|log)(?:\/([^/?#]+))?)?)?\/?$/i);
  if (!match) return null;
  if (!match[1]) return { kind: 'chart_home' };
  const courseId = decodeSegment(match[1]);
  if (!courseId) return null;
  if (!match[2]) return { kind: 'course', courseId };
  if (match[2].toLowerCase() === 'log') return { kind: 'log', courseId };
  const waypointId = match[3] ? decodeSegment(match[3]) : null;
  return waypointId ? { kind: 'waypoint', courseId, waypointId } : null;
}
