import { useAnchorStore } from '@/stores/anchorStore';
import { useHomeArrivalStore, whenHomeReady } from '@/stores/v2/homeArrivalStore';
import { CREATION_TIMING } from '@/components/v2/creation/creationMotion';
import type { CreationHandoff } from '@/screens/v2/creation';

/** The slice of a stack navigation object the hand-off needs. */
type HandoffNavigation = {
  setOptions: (options: { animation?: 'none' | 'fade'; gestureEnabled?: boolean }) => void;
  popToTop: () => void;
  canGoBack: () => boolean;
  reset: (state: { index: number; routes: Array<{ name: string }> }) => void;
};

/** How long an arrival may stay staged if Home never plays it (unmounted, errored). */
const ARRIVAL_EXPIRY_MS = 5000;

/**
 * Carry a just-created Anchor into the real Home.
 *
 * Home is the root of the V2 stack, mounted underneath creation the whole time. It is told
 * which Anchor is arriving and from where, poses itself for it, and says where the mark will
 * rest. Creation then leaves without a transition of its own: the first frame of Home is the
 * frame the user was already looking at, and Home assembles around the mark from there.
 *
 * If Home cannot pose in time the route still changes — with a soft fade instead — so a
 * hand-off can never strand the user on a finished creation screen.
 */
export async function handOffToHome(
  navigation: HandoffNavigation,
  handoff: CreationHandoff,
  options: { reduceMotion: boolean },
): Promise<void> {
  // Home orients around the selected Anchor; the new one becomes it before Home poses.
  useAnchorStore.getState().setCurrentAnchor(handoff.anchorId);

  const arrivals = useHomeArrivalStore.getState();
  const id = arrivals.stage({
    anchorId: handoff.anchorId,
    svg: handoff.svg,
    category: handoff.category,
    expression: handoff.expression,
    fromRect: options.reduceMotion ? null : handoff.markRect,
  });

  const ready = await whenHomeReady(id, CREATION_TIMING.handoffWait);
  const seamless = ready && !options.reduceMotion && Boolean(useHomeArrivalStore.getState().arrival?.targetRect);

  navigation.setOptions({ animation: seamless ? 'none' : 'fade', gestureEnabled: false });
  // One frame for the new animation option to reach the native stack before the pop.
  await new Promise((resolve) => setTimeout(resolve, 16));

  if (navigation.canGoBack()) navigation.popToTop();
  else navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
  useHomeArrivalStore.getState().release(id);

  setTimeout(() => useHomeArrivalStore.getState().clear(id), ARRIVAL_EXPIRY_MS);
}
