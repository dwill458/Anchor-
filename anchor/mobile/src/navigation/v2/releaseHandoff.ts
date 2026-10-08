import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { useHomeArrivalStore, whenHomeReady, type ArrivalGhost } from '@/stores/v2/homeArrivalStore';
import { filterHomeAnchors } from '@/hooks/v2/home/useV2SelectedAnchor';
import { RELEASE_EXIT_TIMELINE_MS } from '@/constants/v2/release';
import { trace } from '@/utils/dev/creationTrace';

/**
 * The slice of a stack navigation object the hand-off needs. Every member is optional so a host that
 * lacks one (a test double, a navigator without a stack beneath) is simply not handed off: the user
 * returns the ordinary way instead.
 */
type HandoffNavigation = {
  setOptions?: (options: { animation?: 'none' | 'fade'; gestureEnabled?: boolean }) => void;
  popToTop?: () => void;
  canGoBack?: () => boolean;
};

export const RELEASE_HANDOFF = {
  /** The ending fades its own chrome for this long after the tap, over its cream paper, before the route changes. */
  chromeMs: RELEASE_EXIT_TIMELINE_MS.routeChange,
  /** Longest Home is given to pose before the user simply returns the ordinary way. */
  readyWaitMs: 600,
  /** How long an arrival may stay staged if Home never plays it. */
  expiryMs: 5000,
} as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The releases already carried to Home, and whether a hand-off is running: a second tap or a remount starts nothing. */
const handedOff = new Set<string>();
let inFlight = false;

export function resetReleaseHandoffForTests(): void {
  handedOff.clear();
  inFlight = false;
}

/** How many Anchors Home lists right now, by the filter Home itself uses. */
function homeAnchorCount(): number {
  const userId = useAuthStore.getState().user?.id ?? null;
  return filterHomeAnchors(useAnchorStore.getState().anchors, userId).length;
}

/** How many Anchors Home listed before `anchorId` was released: one more now, if that release is already in the store. */
function homeAnchorCountBefore(anchorId: string, after: number): number {
  const released = useAnchorStore.getState().anchors.find((anchor) => anchor.id === anchorId || anchor.localId === anchorId);
  return released?.isReleased ? after + 1 : after;
}

/**
 * Return Home after a Release ending (RL1, about 2.2s, level 2, no sound, no haptic).
 *
 * This reuses the Home arrival machinery as a `release` arrival. Nothing flies (the released Anchor is
 * gone), so there is nothing to measure: a `release` arrival is staged, Home (mounted underneath the
 * Release route) poses and reports ready, and the arrival is released so its 2.2s clock starts at the
 * tap. The ending fades its own chrome over its cream paper while the clock runs; at the end of that
 * fade the route changes to Home with no transition of its own, so the cream ending becomes the cream
 * Home without a frame of anything else. Home arrives on whichever Anchor it now selects.
 *
 * `fallback` is the existing Return Home (a replacement with the iOS fade). It runs, and nothing else
 * does, when the hand-off cannot stage: the navigation cannot pop to a Home beneath, no Anchor is left
 * for Home to arrive on, or Home never poses in time. Reduce Motion stages the same arrival, which
 * then plays Home's short crossfade behind a soft fade.
 *
 * Resolves 'started' when this call ran the hand-off (or the fallback), 'ignored' for a repeat of one
 * already running or done (a double tap, a remount).
 */
export async function handOffReleaseToHome(
  navigation: HandoffNavigation,
  input: { anchorId: string; fallback: () => void },
  options: { reduceMotion: boolean },
): Promise<'started' | 'ignored'> {
  const { anchorId, fallback } = input;
  const store = useHomeArrivalStore.getState;

  const canPop = typeof navigation.setOptions === 'function'
    && typeof navigation.popToTop === 'function'
    && navigation.canGoBack?.() === true;
  const after = canPop ? homeAnchorCount() : 0;
  // Home has no Anchor to arrive on (or nothing beneath to arrive on it): the ordinary return.
  if (!canPop || after === 0) {
    fallback();
    return 'started';
  }

  if (inFlight || handedOff.has(anchorId)) return 'ignored';
  inFlight = true;
  handedOff.add(anchorId);

  const startedAt = Date.now();
  let left = false;
  try {
    const before = homeAnchorCountBefore(anchorId, after);
    const id = store().stage({
      // A release names no Anchor: Home arrives on whichever one it selects.
      anchorId: '',
      kind: 'release',
      svg: '',
      fromRect: null,
      countBefore: before > after ? before : null,
    });
    trace('handOffReleaseToHome staged', { before, after, reduceMotion: options.reduceMotion });

    const ready = await whenHomeReady(id, RELEASE_HANDOFF.readyWaitMs);
    const arrival = store().arrival;
    if (!ready || !arrival || arrival.id !== id) {
      // Home could not take it: nothing is left staged, and the return is the ordinary one.
      store().clear(id);
      left = true;
      fallback();
      return 'started';
    }

    if (options.reduceMotion) {
      // The short crossfade behind a soft fade: no staggered exit, no waiting out the ending's chrome.
      navigation.setOptions?.({ animation: 'fade', gestureEnabled: false });
      await sleep(16);
      left = true;
      navigation.popToTop?.();
      store().release(id);
    } else {
      // The clock starts now, with Home still hidden under the ending; the route changes once the
      // ending has faded its chrome. Release first, then wait out the rest of the fade.
      store().release(id);
      const wait = RELEASE_HANDOFF.chromeMs - (Date.now() - startedAt);
      if (wait > 0) await sleep(wait);
      navigation.setOptions?.({ animation: 'none', gestureEnabled: false });
      // One frame for the new animation option to reach the native stack before the route changes.
      await sleep(16);
      trace('handOffReleaseToHome pop');
      left = true;
      navigation.popToTop?.();
    }

    setTimeout(() => store().clear(id), RELEASE_HANDOFF.expiryMs);
    return 'started';
  } catch (error) {
    // Whatever went wrong, the user still leaves the ending, the ordinary way.
    console.warn('[release-handoff] failed, returning without an arrival', error);
    store().clear();
    if (!left) fallback();
    return 'started';
  } finally {
    inFlight = false;
  }
}

/**
 * Continue with the new Anchor after an Evolved ending (EV1, about 3.4s, level 3, skippable): Home,
 * mounted underneath the Release route, receives the successor as an `evolved` arrival.
 *
 * There is no creation mark to fly from (the ending shows only the successor's intention), so nothing
 * is measured: Home selects the successor, poses, and reports ready at once. The ending fades its own
 * chrome over its cream paper, the route then changes to Home with no transition of its own, and the
 * arrival's clock starts there. `released` is the released Anchor's artwork from the release snapshot:
 * it lingers faintly behind the new one and dissolves. Without it (or without a successor to land on)
 * the ghost is skipped, and without a successor, or a Home to pop to, `fallback` (the existing
 * replacement with the successor's Details) runs and nothing else does.
 *
 * Reduce Motion stages the same arrival, which then plays Home's short crossfade behind a soft fade.
 * Resolves 'started' when this call ran the hand-off (or the fallback), 'ignored' for a repeat of one
 * already running or done (a double tap, a remount).
 */
export async function handOffEvolvedToHome(
  navigation: HandoffNavigation,
  input: { successorAnchorId: string; released?: ArrivalGhost | null; fallback: () => void },
  options: { reduceMotion: boolean },
): Promise<'started' | 'ignored'> {
  const { successorAnchorId, released, fallback } = input;
  const store = useHomeArrivalStore.getState;

  const canPop = typeof navigation.setOptions === 'function'
    && typeof navigation.popToTop === 'function'
    && navigation.canGoBack?.() === true;
  const successor = canPop
    ? useAnchorStore.getState().anchors.find((anchor) => anchor.id === successorAnchorId || anchor.localId === successorAnchorId)
    : undefined;
  // Home cannot be popped to, or the successor is not there to land on: the ordinary continuation.
  if (!canPop || !successor || successor.isReleased || successor.archivedAt) {
    fallback();
    return 'started';
  }

  const key = `evolved:${successor.id}`;
  if (inFlight || handedOff.has(key)) return 'ignored';
  inFlight = true;
  handedOff.add(key);

  const startedAt = Date.now();
  let left = false;
  try {
    // Home shows the Anchor it is told to select; the successor is the one the user is continuing with.
    useAnchorStore.getState().setCurrentAnchor(successor.id);
    const render = anchorRenderProps(successor);
    const id = store().stage({
      anchorId: successor.id,
      kind: 'evolved',
      svg: render.svg,
      category: render.category,
      expression: render.expression,
      imageUrl: render.imageUrl,
      fromRect: null,
      ghost: released?.svg ? released : null,
    });
    trace('handOffEvolvedToHome staged', { ghost: Boolean(released?.svg), reduceMotion: options.reduceMotion });

    const ready = await whenHomeReady(id, RELEASE_HANDOFF.readyWaitMs);
    const arrival = store().arrival;
    if (!ready || !arrival || arrival.id !== id) {
      store().clear(id);
      left = true;
      fallback();
      return 'started';
    }

    if (options.reduceMotion) {
      navigation.setOptions?.({ animation: 'fade', gestureEnabled: false });
    } else {
      // Wait out the ending's chrome fade over its paper; the route changes once it is clear.
      const wait = RELEASE_HANDOFF.chromeMs - (Date.now() - startedAt);
      if (wait > 0) await sleep(wait);
      navigation.setOptions?.({ animation: 'none', gestureEnabled: false });
    }
    // One frame for the new animation option to reach the native stack before the route changes.
    await sleep(16);
    trace('handOffEvolvedToHome pop');
    left = true;
    navigation.popToTop?.();
    // The clock starts as Home appears, so the whole 3.4s is seen.
    store().release(id);

    setTimeout(() => store().clear(id), RELEASE_HANDOFF.expiryMs);
    return 'started';
  } catch (error) {
    console.warn('[release-handoff] evolved failed, continuing without an arrival', error);
    store().clear();
    if (!left) fallback();
    return 'started';
  } finally {
    inFlight = false;
  }
}
