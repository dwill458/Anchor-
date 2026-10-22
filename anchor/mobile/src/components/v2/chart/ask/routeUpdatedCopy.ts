/** What changed, in the person's own terms. Built only from the change the server actually saved. */
export type RouteUpdatedChange =
  | { kind: 'MOVES_ADDED'; count: number; waypointTitle: string | null }
  | { kind: 'ROUTE_REVISED'; aheadCount: number; firstTitle: string | null };

export const ROUTE_UPDATED = {
  heading: 'Route updated.',
  primary: 'View updated Chart',
  secondary: 'Keep chatting',
} as const;

export function routeUpdatedSupport(change: RouteUpdatedChange): string {
  if (change.kind === 'MOVES_ADDED') {
    const moves = change.count === 1 ? 'a move' : `${change.count} moves`;
    return change.waypointTitle ? `Added ${moves} to “${change.waypointTitle}”.` : `Added ${moves} to your Chart.`;
  }
  const waypoints = change.aheadCount === 1 ? 'one waypoint' : `${change.aheadCount} waypoints`;
  return change.firstTitle ? `Your route now has ${waypoints} ahead, starting with “${change.firstTitle}”.` : `Your route now has ${waypoints} ahead.`;
}
