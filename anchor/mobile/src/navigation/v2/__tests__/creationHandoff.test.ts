const mockSetCurrentAnchor = jest.fn();
const mockAnchors: Array<{ id: string; localId?: string; archivedAt?: Date; isReleased?: boolean }> = [];
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ setCurrentAnchor: mockSetCurrentAnchor, anchors: mockAnchors }) },
}));

import { handOffToHome, prepareHomeArrival, resolveArrivalKind } from '../creationHandoff';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';
import { useTeachingStore } from '@/stores/teachingStore';

const handoff = {
  anchorId: 'anchor-1',
  markRect: { x: 40, y: 200, width: 280, height: 280 },
  svg: '<svg/>',
  category: 'career',
  expression: 'foil' as const,
};

const makeNavigation = (canGoBack = true) => ({
  setOptions: jest.fn(),
  popToTop: jest.fn(),
  canGoBack: jest.fn(() => canGoBack),
  reset: jest.fn(),
});

/** Plays Home's part: report ready as soon as the arrival is staged. */
const homeAnswers = (target: { x: number; y: number; width: number; height: number } | null) =>
  useHomeArrivalStore.subscribe((state) => {
    if (state.arrival?.phase === 'staging') state.reportReady(state.arrival.id, target);
  });

beforeEach(() => {
  mockSetCurrentAnchor.mockClear();
  mockAnchors.length = 0;
  useHomeArrivalStore.setState({ arrival: null });
  useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', false);
});

describe('handOffToHome', () => {
  it('selects the new Anchor, waits for Home, and leaves without a transition of its own', async () => {
    const unsubscribe = homeAnswers({ x: 140, y: 180, width: 110, height: 110 });
    const navigation = makeNavigation();
    await handOffToHome(navigation, handoff, { reduceMotion: false });
    unsubscribe();

    expect(mockSetCurrentAnchor).toHaveBeenCalledWith('anchor-1');
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'none', gestureEnabled: false });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival.phase).toBe('arriving');
    expect(arrival.fromRect).toEqual(handoff.markRect);
    expect(arrival.expression).toBe('foil');
  });

  it('still leaves — softly — when Home cannot pose in time', async () => {
    const navigation = makeNavigation();
    await handOffToHome(navigation, handoff, { reduceMotion: false });
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'fade', gestureEnabled: false });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  }, 5000);

  it('uses a fade and no flight under Reduce Motion', async () => {
    const unsubscribe = homeAnswers(null);
    const navigation = makeNavigation();
    await handOffToHome(navigation, handoff, { reduceMotion: true });
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival?.fromRect).toBeNull();
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'fade', gestureEnabled: false });
  });

  it('lets Home prepare while creation is still resolving, then reuses that arrival', async () => {
    const { markRect: _unused, ...saved } = handoff;
    const id = prepareHomeArrival({ ...saved, imageUrl: 'https://assets.test/chosen.png' });
    expect(mockSetCurrentAnchor).toHaveBeenCalledWith('anchor-1');
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ id, phase: 'staging', fromRect: null, imageUrl: 'https://assets.test/chosen.png' });

    // Home answers during the resolve, long before creation is ready to leave.
    useHomeArrivalStore.getState().reportReady(id, { x: 140, y: 180, width: 110, height: 110 });
    const navigation = makeNavigation();
    await handOffToHome(navigation, handoff, { reduceMotion: false });

    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival.id).toBe(id);
    expect(arrival.fromRect).toEqual(handoff.markRect);
    expect(arrival.phase).toBe('arriving');
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'none', gestureEnabled: false });
  });

  it('accepts a Home measurement that lands after Home stopped waiting', () => {
    const { markRect: _unused, ...saved } = handoff;
    const id = prepareHomeArrival(saved);
    useHomeArrivalStore.getState().reportReady(id, null);
    useHomeArrivalStore.getState().reportReady(id, { x: 1, y: 2, width: 3, height: 3 });
    expect(useHomeArrivalStore.getState().arrival?.targetRect).toEqual({ x: 1, y: 2, width: 3, height: 3 });
    useHomeArrivalStore.getState().release(id);
    useHomeArrivalStore.getState().reportReady(id, { x: 9, y: 9, width: 9, height: 9 });
    expect(useHomeArrivalStore.getState().arrival?.targetRect).toEqual({ x: 1, y: 2, width: 3, height: 3 });
  });

  it('resets onto Home when there is nothing beneath creation', async () => {
    const unsubscribe = homeAnswers(null);
    const navigation = makeNavigation(false);
    await handOffToHome(navigation, handoff, { reduceMotion: false });
    unsubscribe();
    expect(navigation.popToTop).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
  });
});

describe('arrival kind', () => {
  const { markRect: _unused, ...saved } = handoff;

  it('is first when the saved Anchor is the only Anchor in the store', () => {
    mockAnchors.push({ id: 'anchor-1' });
    const id = prepareHomeArrival(saved);
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ id, kind: 'first' });
  });

  it('is first when the store does not yet hold the saved Anchor and holds none other', () => {
    expect(prepareHomeArrival(saved)).toBeGreaterThan(0);
    expect(useHomeArrivalStore.getState().arrival?.kind).toBe('first');
  });

  it('is repeat when another Anchor exists, counting released and archived ones', () => {
    mockAnchors.push({ id: 'anchor-1' }, { id: 'older', archivedAt: new Date(0) }, { id: 'released', isReleased: true });
    prepareHomeArrival(saved);
    expect(useHomeArrivalStore.getState().arrival?.kind).toBe('repeat');
  });

  it('matches the saved Anchor by its local id as well', () => {
    mockAnchors.push({ id: 'server-9', localId: 'anchor-1' });
    expect(resolveArrivalKind(mockAnchors as never, 'anchor-1', false)).toBe('first');
  });

  it('is first only while the once-ever flag is unset', () => {
    expect(resolveArrivalKind([], 'anchor-1', false)).toBe('first');
    expect(resolveArrivalKind([{ id: 'anchor-1' }] as never, 'anchor-1', false)).toBe('first');
    expect(resolveArrivalKind([{ id: 'older' }] as never, 'anchor-1', false)).toBe('repeat');
  });

  it('is repeat once the flag is set, even when the saved Anchor is the only one', () => {
    useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', true);
    mockAnchors.push({ id: 'anchor-1' });
    prepareHomeArrival(saved);
    expect(useHomeArrivalStore.getState().arrival?.kind).toBe('repeat');
    expect(resolveArrivalKind([{ id: 'anchor-1' }] as never, 'anchor-1', true)).toBe('repeat');
  });

  it('is repeat for a user who deleted their only Anchor after the first arrival', () => {
    useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', true);
    prepareHomeArrival(saved);
    expect(useHomeArrivalStore.getState().arrival?.kind).toBe('repeat');
  });

  it('treats a persisted profile that predates the flag as unset', () => {
    useTeachingStore.setState({ userFlags: { ...useTeachingStore.getState().userFlags, hasSeenFirstAnchorArrival: undefined } as never });
    mockAnchors.push({ id: 'anchor-1' });
    prepareHomeArrival(saved);
    expect(useHomeArrivalStore.getState().arrival?.kind).toBe('first');
  });

  it('uses an explicit kind when given', () => {
    prepareHomeArrival({ ...saved, kind: 'repeat' });
    expect(useHomeArrivalStore.getState().arrival?.kind).toBe('repeat');
  });

  it('keeps the kind decided at staging when the hand-off reuses that arrival', async () => {
    mockAnchors.push({ id: 'anchor-1' }, { id: 'older' });
    const id = prepareHomeArrival(saved);
    useHomeArrivalStore.getState().reportReady(id, { x: 140, y: 180, width: 110, height: 110 });
    await handOffToHome(makeNavigation(), handoff, { reduceMotion: false });
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ id, kind: 'repeat' });
  });
});
