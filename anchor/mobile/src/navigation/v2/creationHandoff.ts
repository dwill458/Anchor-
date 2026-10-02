import { Image } from 'react-native';

import { useAnchorStore } from '@/stores/anchorStore';
import { useHomeArrivalStore, whenHomeReady } from '@/stores/v2/homeArrivalStore';
import { CREATION_TIMING } from '@/components/v2/creation/creationMotion';
import type { CreationHandoff } from '@/screens/v2/creation';
import { trace } from '@/utils/dev/creationTrace';

/** The slice of a stack navigation object the hand-off needs. */
type HandoffNavigation = {
  setOptions: (options: { animation?: 'none' | 'fade'; gestureEnabled?: boolean }) => void;
  popToTop: () => void;
  canGoBack: () => boolean;
  reset: (state: { index: number; routes: Array<{ name: string }> }) => void;
};

/** Longest the chosen image is given to be cached before Home paints its hero. */
const IMAGE_PREFETCH_CAP_MS = 400;

/**
 * Warm the chosen image so Home's hero never paints without it. Capped: a slow network must not
 * hold the hand-off, and a failure is simply a hero that loads as it always did.
 */
function prefetchChosenImage(url: string | undefined): Promise<void> {
  if (!url || !/^https?:/i.test(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, IMAGE_PREFETCH_CAP_MS);
    Image.prefetch(url).then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

/** How long an arrival may stay staged if Home never plays it (unmounted, errored). */
const ARRIVAL_EXPIRY_MS = 5000;

/**
 * Tell Home an Anchor is arriving as soon as it exists — while creation is still resolving it
 * into its circle — so Home has that whole beat to select it, pose, and measure where it will
 * rest. Waiting until creation was ready to leave left Home too little time on a busy JS
 * thread, and a Home that missed its staging window cut in instead of receiving the flight.
 */
export function prepareHomeArrival(handoff: Omit<CreationHandoff, 'markRect'>): number {
  trace('prepareHomeArrival', { imageUrlLength: handoff.imageUrl?.length ?? 0 });
  useAnchorStore.getState().setCurrentAnchor(handoff.anchorId);
  return useHomeArrivalStore.getState().stage({
    anchorId: handoff.anchorId,
    svg: handoff.svg,
    category: handoff.category,
    expression: handoff.expression,
    imageUrl: handoff.imageUrl,
    fromRect: null,
  });
}

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
  trace('handOffToHome start', { fromRect: handoff.markRect, reduceMotion: options.reduceMotion });
  // Reuse the arrival staged when the Anchor was saved; stage one now if there is none.
  const staged = useHomeArrivalStore.getState().arrival;
  const fromRect = options.reduceMotion ? null : handoff.markRect;
  let id: number;
  if (staged && staged.anchorId === handoff.anchorId && staged.phase !== 'arriving') {
    id = staged.id;
    useHomeArrivalStore.getState().setFromRect(id, fromRect);
  } else {
    id = prepareHomeArrival(handoff);
    useHomeArrivalStore.getState().setFromRect(id, fromRect);
  }

  // The image warms while Home poses and measures; neither waits for the other.
  const [ready] = await Promise.all([
    whenHomeReady(id, CREATION_TIMING.handoffWait),
    prefetchChosenImage(handoff.imageUrl),
  ]);
  trace('whenHomeReady resolve', {
    ready,
    targetRect: useHomeArrivalStore.getState().arrival?.targetRect ?? null,
    fromRect,
  });
  const seamless = ready && !options.reduceMotion && Boolean(useHomeArrivalStore.getState().arrival?.targetRect);

  navigation.setOptions({ animation: seamless ? 'none' : 'fade', gestureEnabled: false });
  // One frame for the new animation option to reach the native stack before the pop.
  await new Promise((resolve) => setTimeout(resolve, 16));

  trace('pop');
  if (navigation.canGoBack()) navigation.popToTop();
  else navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
  useHomeArrivalStore.getState().release(id);

  setTimeout(() => useHomeArrivalStore.getState().clear(id), ARRIVAL_EXPIRY_MS);
}
