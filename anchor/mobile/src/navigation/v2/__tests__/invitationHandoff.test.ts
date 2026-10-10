import {
  INVITATION_HANDOFF,
  handOffPracticeToInvitation,
  resetInvitationHandoffForTests,
} from '../invitationHandoff';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import type { ArrivalRect } from '@/stores/v2/homeArrivalStore';
import type { PracticeDeparture } from '@/stores/v2/practiceDeparture';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const FROM: ArrivalRect = { x: 100, y: 180, width: 130, height: 130 };
const anchor = makeAnchor({ id: 'anchor-1', category: 'desire' });

const makeNavigation = () => ({
  navigate: jest.fn(),
});

const makeDeparture = (overrides: Partial<PracticeDeparture> = {}): PracticeDeparture => ({
  sessionId: 'session-1',
  at: Date.now(),
  measure: jest.fn(async () => ({ fromRect: FROM, number: null, glow: null })),
  ...overrides,
});

async function run<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  const tracked = promise.finally(() => { settled = true; });
  for (let i = 0; i < 40 && !settled; i += 1) {
    await Promise.resolve();
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  }
  return tracked;
}

beforeEach(() => {
  jest.useFakeTimers();
  resetInvitationHandoffForTests();
  useReminderInvitationStore.getState().reset();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('handOffPracticeToInvitation', () => {
  it('measures the departure, stages its rect, then opens the invitation with no route animation', async () => {
    const navigation = makeNavigation();
    const departure = makeDeparture();
    await expect(run(handOffPracticeToInvitation(navigation, { anchor, departure }, { reduceMotion: false }))).resolves.toBe('started');

    expect(departure.measure).toHaveBeenCalledTimes(1);
    const staged = useReminderInvitationStore.getState().staged;
    expect(staged).toMatchObject({ anchorId: 'anchor-1', sessionId: 'session-1', fromRect: FROM });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('V2NotificationInvitation', { anchorId: 'anchor-1', anchorTransition: true });
    // The route changed only after the complete screen faded its chrome.
    expect(Date.now() - departure.at).toBeGreaterThanOrEqual(INVITATION_HANDOFF.chromeMs);
  });

  it('under Reduce Motion measures nothing and opens the invitation with a fade', async () => {
    const navigation = makeNavigation();
    const departure = makeDeparture();
    await run(handOffPracticeToInvitation(navigation, { anchor, departure }, { reduceMotion: true }));
    expect(departure.measure).not.toHaveBeenCalled();
    expect(useReminderInvitationStore.getState().staged?.fromRect).toBeNull();
    expect(navigation.navigate).toHaveBeenCalledWith('V2NotificationInvitation', { anchorId: 'anchor-1', anchorTransition: false, reducedMotion: true });
  });

  it('still opens the invitation (crossfade) when measuring throws', async () => {
    const navigation = makeNavigation();
    const departure = makeDeparture({ measure: () => Promise.reject(new Error('no window')) });
    await run(handOffPracticeToInvitation(navigation, { anchor, departure }, { reduceMotion: false }));
    expect(navigation.navigate).toHaveBeenCalledWith('V2NotificationInvitation', { anchorId: 'anchor-1', anchorTransition: false });
  });

  it('is single-flight: a second tap or a remount for the same session navigates nothing more', async () => {
    const navigation = makeNavigation();
    const departure = makeDeparture();
    const first = handOffPracticeToInvitation(navigation, { anchor, departure }, { reduceMotion: false });
    await expect(handOffPracticeToInvitation(navigation, { anchor, departure }, { reduceMotion: false })).resolves.toBe('ignored');
    await expect(run(first)).resolves.toBe('started');
    await expect(handOffPracticeToInvitation(navigation, { anchor, departure }, { reduceMotion: false })).resolves.toBe('ignored');
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(departure.measure).toHaveBeenCalledTimes(1);
  });

  it('marks the invitation as shown for this app session', async () => {
    await run(handOffPracticeToInvitation(makeNavigation(), { anchor, departure: makeDeparture() }, { reduceMotion: false }));
    expect(useReminderInvitationStore.getState().shownThisSession).toBe(true);
  });

  it('never leaves the user stuck: a failing navigate falls back to Home', async () => {
    const navigation = {
      navigate: jest.fn((name: string) => {
        if (name === 'V2NotificationInvitation') throw new Error('no route');
      }),
    };
    await run(handOffPracticeToInvitation(navigation, { anchor, departure: makeDeparture() }, { reduceMotion: false }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('V2DevelopmentHome');
  });
});

it('keeps the chrome beat in step with Complete to Home', () => {
  const { PRACTICE_HANDOFF } = jest.requireActual('../practiceHandoff');
  expect(INVITATION_HANDOFF.chromeMs).toBe(PRACTICE_HANDOFF.chromeMs);
});

describe('reminderInvitationStore', () => {
  it('gives the fromRect once, keeping the session for the way out', () => {
    useReminderInvitationStore.getState().stage({ anchorId: 'a', sessionId: 's', fromRect: FROM });
    expect(useReminderInvitationStore.getState().takeFromRect('a')).toEqual(FROM);
    expect(useReminderInvitationStore.getState().takeFromRect('a')).toBeNull();
    expect(useReminderInvitationStore.getState().staged?.sessionId).toBe('s');
  });

  it('refuses a fromRect staged for another Anchor', () => {
    useReminderInvitationStore.getState().stage({ anchorId: 'a', sessionId: 's', fromRect: FROM });
    expect(useReminderInvitationStore.getState().takeFromRect('b')).toBeNull();
  });
});

describe('leaveInvitationFlowToHome', () => {
  const { leaveInvitationFlowToHome } = require('../invitationHandoff');
  const { useHomeArrivalStore } = require('@/stores/v2/homeArrivalStore');
  const { resetPracticeHandoffForTests } = require('../practiceHandoff');
  const HERO: ArrivalRect = { x: 120, y: 140, width: 160, height: 160 };
  const TARGET: ArrivalRect = { x: 140, y: 200, width: 110, height: 110 };
  const leaveNavigation = () => ({ setOptions: jest.fn(), navigate: jest.fn() });

  beforeEach(() => {
    resetPracticeHandoffForTests();
    useHomeArrivalStore.setState({ arrival: null });
  });

  it('hands the Anchor to Home through the existing practice hand-off, flying from the invitation hero', async () => {
    const unsubscribe = useHomeArrivalStore.subscribe((state: any) => {
      if (state.arrival?.phase === 'staging') state.reportReady(state.arrival.id, TARGET);
    });
    const navigation = leaveNavigation();
    await run(leaveInvitationFlowToHome(
      navigation,
      { anchor, sessionId: 'session-9', measure: async () => ({ fromRect: HERO, number: null, glow: null }) },
      { reduceMotion: false },
    ));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ kind: 'practice', anchorId: 'anchor-1', fromRect: HERO, sessionId: 'session-9' });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('still lands on Home when Home never poses, and when there is no Anchor at all', async () => {
    const first = leaveNavigation();
    await run(leaveInvitationFlowToHome(first, { anchor, sessionId: 's-a', measure: async () => null }, { reduceMotion: false }));
    expect(first.navigate).toHaveBeenCalledWith('V2DevelopmentHome');

    const second = leaveNavigation();
    await run(leaveInvitationFlowToHome(second, { anchor: undefined, sessionId: null, measure: async () => null }, { reduceMotion: false }));
    expect(second.navigate).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('falls back to a plain return when the practice hand-off ignores it (session already handed off)', async () => {
    const nav1 = leaveNavigation();
    await run(leaveInvitationFlowToHome(nav1, { anchor, sessionId: 'dup', measure: async () => null }, { reduceMotion: true }));
    const nav2 = leaveNavigation();
    await run(leaveInvitationFlowToHome(nav2, { anchor, sessionId: 'dup', measure: async () => null }, { reduceMotion: true }));
    expect(nav2.navigate).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('clears the staged invitation on the way out', async () => {
    useReminderInvitationStore.getState().stage({ anchorId: 'anchor-1', sessionId: 's', fromRect: FROM });
    await run(leaveInvitationFlowToHome(leaveNavigation(), { anchor, sessionId: 's', measure: async () => null }, { reduceMotion: true }));
    expect(useReminderInvitationStore.getState().staged).toBeNull();
  });
});
