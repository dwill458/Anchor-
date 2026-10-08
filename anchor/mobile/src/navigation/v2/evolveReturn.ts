import { useEvolveSessionStore, type EvolveSessionSuccessor } from '@/stores/v2/evolveSessionStore';
import { V2_RELEASE_ROUTE } from '@/constants/v2/release';

/** The slice of stack navigation the return needs. */
type ReleaseReturnNavigation = {
  navigate: (action: { name: string; params: object; merge: boolean }) => void;
};

/**
 * A creation started from a Release screen was sealed: attach the new Anchor and go back to that
 * Release with it, instead of handing off to Home.
 *
 * `navigate` to a route that is already in the stack pops back to it (creation's own screens are
 * removed) rather than pushing a second Release. With `merge`, the Release route keeps its other
 * params and takes the new `reason` and `successor`, which the Release screen re-reads. The old
 * Anchor is untouched here: it is only released, and linked, when the Release hold completes.
 */
export function returnToReleaseWithSuccessor(
  navigation: ReleaseReturnNavigation,
  fromAnchorId: string,
  successor: EvolveSessionSuccessor,
): void {
  useEvolveSessionStore.getState().attach(successor);
  navigation.navigate({
    name: V2_RELEASE_ROUTE,
    params: { anchorId: fromAnchorId, reason: 'evolve', successor },
    merge: true,
  });
}
