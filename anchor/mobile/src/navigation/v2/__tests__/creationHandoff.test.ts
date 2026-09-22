const mockSetCurrentAnchor = jest.fn();
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ setCurrentAnchor: mockSetCurrentAnchor }) },
}));

import { handOffToHome } from '../creationHandoff';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';

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
  useHomeArrivalStore.setState({ arrival: null });
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

  it('resets onto Home when there is nothing beneath creation', async () => {
    const unsubscribe = homeAnswers(null);
    const navigation = makeNavigation(false);
    await handOffToHome(navigation, handoff, { reduceMotion: false });
    unsubscribe();
    expect(navigation.popToTop).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
  });
});
