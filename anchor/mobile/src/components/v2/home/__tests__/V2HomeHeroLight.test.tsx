import React from 'react';
import { act, render } from '@testing-library/react-native';
import { HALO_COOL, HALO_WARM, HeroHalo, HOME_GLOW_EASE_MS } from '../V2HomeHeroLight';
import { heroWarmth } from '../homeHeroPresence';
import { mixHex } from '@/components/v2/anchor/anchorExpressions';
import { useHomeGlowSeenStore } from '@/stores/v2/homeGlowSeenStore';

// Shared values keep their identity across renders, as they do on device. withTiming records its
// call and, when a test asks, lands at once so the ease can be observed settling.
let mockFinishImmediately = false;
const mockWithTiming = jest.fn();
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    useSharedValue: (initial: unknown) => require('react').useRef({ value: initial }).current,
    withTiming: (target: unknown, config: unknown, callback?: (finished: boolean) => void) => {
      mockWithTiming(target, config);
      if (mockFinishImmediately) callback?.(true);
      return target;
    },
  };
});

const ANCHOR = 'anchor-1';
const FROM_LAYER = '-from-glow';

function halo(props: { strength: number | null; anchorId?: string | null; reduceMotion?: boolean }) {
  return <HeroHalo size={120} boxHeight={240} {...props} />;
}

function hasFromLayer(tree: unknown): boolean {
  return JSON.stringify(tree).includes(FROM_LAYER);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFinishImmediately = false;
  useHomeGlowSeenStore.setState({ seen: {}, hydrated: true });
});

describe('HeroHalo glow', () => {
  it('settles on first sight with no ease and records the value', () => {
    render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(60);
  });

  it('eases from the value last seen over HOME_GLOW_EASE_MS, and records the new value at the start', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 } });

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(HOME_GLOW_EASE_MS).toBe(1200);
    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 1200 }));
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(60);
    expect(hasFromLayer(result.toJSON())).toBe(true);
  });

  it('drops the old light once the ease has landed', () => {
    mockFinishImmediately = true;
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 } });

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(hasFromLayer(result.toJSON())).toBe(false);
  });

  it('eases when Thread Strength changes while Home is mounted', () => {
    const result = render(halo({ strength: 20, anchorId: ANCHOR }));
    expect(mockWithTiming).not.toHaveBeenCalled();

    result.rerender(halo({ strength: 80, anchorId: ANCHOR }));

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(80);
  });

  it('does not replay the ease after a remount', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 } });

    render(halo({ strength: 60, anchorId: ANCHOR })).unmount();
    const remounted = render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(hasFromLayer(remounted.toJSON())).toBe(false);
  });

  it('does not ease when the value equals the one last seen', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 60 } });

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
  });

  it('never eases an unmeasured thread and records nothing for it', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 } });

    const result = render(halo({ strength: null, anchorId: ANCHOR }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(20);
  });

  it('under Reduce Motion snaps to the new value and still records it', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 } });

    const result = render(halo({ strength: 60, anchorId: ANCHOR, reduceMotion: true }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(60);
  });

  it('before the store is hydrated settles on the current value and records nothing', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 }, hydrated: false });

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(20);
  });

  it('before hydration with no stored value records nothing either', () => {
    useHomeGlowSeenStore.setState({ seen: {}, hydrated: false });

    render(halo({ strength: 60, anchorId: ANCHOR }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(useHomeGlowSeenStore.getState().seen).toEqual({});
  });

  it('a late hydration eases from the stored value to the current one and records it at the start', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 }, hydrated: false });
    const seenColour = mixHex(HALO_COOL, HALO_WARM, heroWarmth(20));
    const currentColour = mixHex(HALO_COOL, HALO_WARM, heroWarmth(60));

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));
    expect(JSON.stringify(result.toJSON())).not.toContain(seenColour);

    act(() => {
      useHomeGlowSeenStore.setState({ hydrated: true });
    });

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: HOME_GLOW_EASE_MS }));
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(60);
    // The crossfade starts from the seen warmth, so that layer is mounted at full strength.
    expect(hasFromLayer(result.toJSON())).toBe(true);
    expect(JSON.stringify(result.toJSON())).toContain(seenColour);
    expect(JSON.stringify(result.toJSON())).toContain(currentColour);
  });

  it('after hydration with a stored value equal to the current one does nothing', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 60 }, hydrated: false });
    const seenBefore = useHomeGlowSeenStore.getState().seen;

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));
    act(() => {
      useHomeGlowSeenStore.setState({ hydrated: true });
    });

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
    expect(useHomeGlowSeenStore.getState().seen).toBe(seenBefore);
  });

  it('after hydration with no stored value settles and records, with no ease', () => {
    useHomeGlowSeenStore.setState({ seen: {}, hydrated: false });

    const result = render(halo({ strength: 60, anchorId: ANCHOR }));
    act(() => {
      useHomeGlowSeenStore.setState({ hydrated: true });
    });

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(60);
  });

  it('after hydration under Reduce Motion snaps to the current value and records it', () => {
    useHomeGlowSeenStore.setState({ seen: { [ANCHOR]: 20 }, hydrated: false });

    const result = render(halo({ strength: 60, anchorId: ANCHOR, reduceMotion: true }));
    act(() => {
      useHomeGlowSeenStore.setState({ hydrated: true });
    });

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(hasFromLayer(result.toJSON())).toBe(false);
    expect(useHomeGlowSeenStore.getState().getSeen(ANCHOR)).toBe(60);
  });

  it('an Anchor unmounted before hydration records nothing once the store hydrates', () => {
    useHomeGlowSeenStore.setState({ seen: {}, hydrated: false });

    render(halo({ strength: 60, anchorId: ANCHOR })).unmount();
    act(() => {
      useHomeGlowSeenStore.setState({ hydrated: true });
    });

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(useHomeGlowSeenStore.getState().seen).toEqual({});
  });

  it('without an Anchor id settles and records nothing', () => {
    render(halo({ strength: 60 }));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(useHomeGlowSeenStore.getState().seen).toEqual({});
  });
});
