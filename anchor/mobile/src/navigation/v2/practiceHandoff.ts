import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import type { Anchor } from '@/types';
import { useHomeArrivalStore, whenHomeReady } from '@/stores/v2/homeArrivalStore';
import type { PracticeDeparture } from '@/stores/v2/practiceDeparture';
import { trace } from '@/utils/dev/creationTrace';

/** The slice of a stack navigation object the hand-off needs. */
type HandoffNavigation = {
  setOptions: (options: { animation?: 'none' | 'fade'; gestureEnabled?: boolean }) => void;
  navigate: (name: 'V2DevelopmentHome') => void;
};

export const PRACTICE_HANDOFF = {
  /** The complete screen fades its own chrome for this long after the tap, before the route changes. */
  chromeMs: 300,
  /** Longest Home is given to pose and measure its hero before the user simply returns without a flight. */
  readyWaitMs: 600,
  /** How long an arrival may stay staged if Home never plays it. */
  expiryMs: 5000,
} as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The sessions already carried to Home, and whether a hand-off is running: a second tap or a remount starts nothing. */
const handedOff = new Set<string>();
let inFlight = false;

export function resetPracticeHandoffForTests(): void {
  handedOff.clear();
  inFlight = false;
}

/**
 * Carry the Anchor of a just-completed practice back to the real Home ("Complete to Home").
 *
 * This reuses the creation hand-off's machinery: a `practice` arrival is staged with the mark's
 * window rect on the complete screen as its `fromRect`, Home (mounted underneath the practice
 * route) poses and reports where the hero will hold the mark, and once it is ready the arrival is
 * released so Home plays it. The route changes 300ms after the tap, once the complete screen has
 * faded its chrome, with no transition of its own, so the first frame of Home is the frame the
 * user was already looking at.
 *
 * The route always changes. If Home cannot pose in time, or the Anchor on Home is not this one, the
 * arrival is dropped and the user returns the way they always did. Reduce Motion stages no flight:
 * Home plays its short crossfade behind a soft fade. No sound and no haptic are played here.
 *
 * Resolves 'started' when this call ran the hand-off, 'ignored' for a repeat of one already
 * running or done (a double tap, a remount).
 */
export async function handOffPracticeToHome(
  navigation: HandoffNavigation,
  input: { anchor: Anchor; departure: PracticeDeparture },
  options: { reduceMotion: boolean },
): Promise<'started' | 'ignored'> {
  const { anchor, departure } = input;
  const sessionId = departure.sessionId;
  if (inFlight || (sessionId !== null && handedOff.has(sessionId))) return 'ignored';
  inFlight = true;
  if (sessionId !== null) handedOff.add(sessionId);

  const store = useHomeArrivalStore.getState;
  let navigated = false;
  const leave = () => {
    navigated = true;
    navigation.navigate('V2DevelopmentHome');
  };
  try {
    const measured = options.reduceMotion ? null : await departure.measure().catch(() => null);
    const render = anchorRenderProps(anchor);
    const id = store().stage({
      anchorId: anchor.id,
      kind: 'practice',
      svg: render.svg,
      category: render.category,
      expression: render.expression,
      imageUrl: render.imageUrl,
      sessionId,
      fromRect: measured?.fromRect ?? null,
      number: measured?.number ?? null,
      glow: measured?.glow ?? null,
    });
    trace('handOffPracticeToHome staged', { fromRect: measured?.fromRect ?? null, reduceMotion: options.reduceMotion });

    const ready = await whenHomeReady(id, PRACTICE_HANDOFF.readyWaitMs);
    const arrival = store().arrival;
    if (!ready || !arrival || arrival.id !== id) {
      // Home could not take it: nothing is left staged, and the return is the ordinary one.
      store().clear(id);
      leave();
      return 'started';
    }

    const flies = !options.reduceMotion && Boolean(arrival.fromRect && arrival.targetRect);
    // A mark that cannot land has no flight to play: Home crossfades instead.
    if (!flies && arrival.fromRect) store().setFromRect(id, null);

    if (flies) {
      // The clock starts now, hidden under this screen; the flight begins after the chrome has faded,
      // by which time the route has changed. Release first, then wait out the rest of the fade.
      store().release(id);
      const wait = PRACTICE_HANDOFF.chromeMs - (Date.now() - departure.at);
      if (wait > 0) await sleep(wait);
    }

    navigation.setOptions({ animation: flies ? 'none' : 'fade', gestureEnabled: false });
    // One frame for the new animation option to reach the native stack before the route changes.
    await sleep(16);
    trace('handOffPracticeToHome navigate');
    leave();
    if (!flies) store().release(id);

    setTimeout(() => store().clear(id), PRACTICE_HANDOFF.expiryMs);
    return 'started';
  } catch (error) {
    // Whatever went wrong, the user still leaves the complete screen, the ordinary way.
    console.warn('[practice-handoff] failed, returning without an arrival', error);
    store().clear();
    if (!navigated) leave();
    return 'started';
  } finally {
    inFlight = false;
  }
}
