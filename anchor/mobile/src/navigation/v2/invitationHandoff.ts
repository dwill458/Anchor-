import type { Anchor } from '@/types';
import type { PracticeDeparture } from '@/stores/v2/practiceDeparture';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import type { PracticeDepartureMeasure } from '@/stores/v2/practiceDeparture';
import { handOffPracticeToHome } from './practiceHandoff';
import { trace } from '@/utils/dev/creationTrace';

/** The slice of a stack navigation object the hand-off needs. */
type InvitationNavigation = {
  navigate: (...args: any[]) => void;
};

export const INVITATION_ROUTE = 'V2NotificationInvitation' as const;

export const INVITATION_HANDOFF = {
  /**
   * The complete screen fades its own chrome for this long after the tap: the same beat as
   * PRACTICE_HANDOFF.chromeMs (kept as a literal so this module never evaluates another at load;
   * invitationHandoff.test asserts they match).
   */
  chromeMs: 300,
} as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const handedOff = new Set<string>();
let inFlight = false;

export function resetInvitationHandoffForTests(): void {
  handedOff.clear();
  inFlight = false;
}

/**
 * Carry the Anchor of the first completed practice into the reminder invitation, instead of Home.
 *
 * Mirrors `handOffPracticeToHome`: the complete screen's mark is measured (its window rect becomes
 * the flight's `fromRect`), staged in the session-only invitation slot, and the route changes once
 * the complete screen has faded its chrome. The invitation then flies the same mark from that rect
 * into its hero. Under Reduce Motion, or without a measurement, nothing flies: the route fades.
 *
 * The route always changes. If the invitation cannot be opened at all, the user goes Home.
 * Nothing here requests permission or schedules anything.
 *
 * Resolves 'started' when this call ran the hand-off, 'ignored' for a repeat (double tap, remount).
 */
export async function handOffPracticeToInvitation(
  navigation: InvitationNavigation,
  input: { anchor: Anchor; departure: PracticeDeparture },
  options: { reduceMotion: boolean },
): Promise<'started' | 'ignored'> {
  const { anchor, departure } = input;
  const sessionId = departure.sessionId;
  if (inFlight || (sessionId !== null && handedOff.has(sessionId))) return 'ignored';
  inFlight = true;
  if (sessionId !== null) handedOff.add(sessionId);

  const store = useReminderInvitationStore.getState;
  try {
    const measured = options.reduceMotion ? null : await departure.measure().catch(() => null);
    const fromRect = measured?.fromRect ?? null;
    store().stage({ anchorId: anchor.id, sessionId, fromRect });
    store().markShown();
    const flies = !options.reduceMotion && Boolean(fromRect);
    trace('handOffPracticeToInvitation staged', { fromRect, reduceMotion: options.reduceMotion });

    if (flies) {
      // Change the route after the complete screen's chrome has faded, so only the mark remains.
      const wait = INVITATION_HANDOFF.chromeMs - (Date.now() - departure.at);
      if (wait > 0) await sleep(wait);
    }

    try {
      navigation.navigate(INVITATION_ROUTE, {
        anchorId: anchor.id,
        anchorTransition: flies,
        // Reduce Motion: the push does not animate; the screen runs its own short crossfade.
        ...(options.reduceMotion ? { reducedMotion: true } : {}),
      });
    } catch (error) {
      console.warn('[invitation-handoff] could not open the invitation; returning Home', error);
      store().reset();
      navigation.navigate('V2DevelopmentHome');
    }
    return 'started';
  } catch (error) {
    console.warn('[invitation-handoff] failed; returning Home', error);
    try {
      navigation.navigate('V2DevelopmentHome');
    } catch {
      // Nothing more can be done from here.
    }
    return 'started';
  } finally {
    inFlight = false;
  }
}

type LeaveNavigation = {
  setOptions: (options: { animation?: 'none' | 'fade'; gestureEnabled?: boolean }) => void;
  navigate: (name: 'V2DevelopmentHome') => void;
};

/**
 * Leave the invitation / reminder-time flow for Home, handing the Anchor over through the existing
 * Complete-to-Home hand-off with a synthetic departure: `measure` resolves where the mark stands on
 * the leaving screen (or null, and Home crossfades). Whatever happens, the user lands on Home: a
 * missing Anchor, an ignored hand-off or a failure all fall back to a plain navigation.
 */
export async function leaveInvitationFlowToHome(
  navigation: LeaveNavigation,
  input: {
    anchor: Anchor | undefined;
    sessionId: string | null;
    measure: () => Promise<PracticeDepartureMeasure | null>;
  },
  options: { reduceMotion: boolean },
): Promise<void> {
  const fallback = () => {
    try {
      navigation.navigate('V2DevelopmentHome');
    } catch (error) {
      console.warn('[invitation-handoff] could not return Home', error);
    }
  };
  const { anchor } = input;
  useReminderInvitationStore.setState({ staged: null });
  if (!anchor) {
    fallback();
    return;
  }
  try {
    const departure: PracticeDeparture = {
      sessionId: input.sessionId,
      at: Date.now(),
      measure: () => input.measure().catch(() => null),
    };
    const result = await handOffPracticeToHome(navigation, { anchor, departure }, options);
    if (result === 'ignored') fallback();
  } catch (error) {
    console.warn('[invitation-handoff] hand-off to Home failed; returning plainly', error);
    fallback();
  }
}
