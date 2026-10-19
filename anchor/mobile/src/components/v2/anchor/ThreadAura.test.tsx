import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, Image, type AppStateStatus } from 'react-native';
import { ThreadAura, type ThreadAuraProps } from './ThreadAura';
import { CircularAnchorRenderer } from './CircularAnchorRenderer';
import {
  homeAuraEntranceTargets,
  detailsAuraOpacity,
  HOME_AURA_BLOOM_IN_MS,
  HOME_AURA_SETTLE_MS,
  HOME_AURA_FADE_OUT_MS,
  HOME_AURA_PEAK_SCALE,
  HOME_AURA_REST_SCALE,
} from './threadAuraModel';

const mockTiming = jest.fn();
const mockSequence = jest.fn();
const mockCancelAnimation = jest.fn();

jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return {
    __esModule: true,
    ...actual,
    default: actual.default ?? actual,
    withTiming: (toValue: number, config?: unknown, callback?: unknown) => {
      mockTiming(toValue, config);
      return actual.withTiming(toValue, config, callback);
    },
    withSequence: (...animations: number[]) => {
      mockSequence(animations);
      return animations[animations.length - 1];
    },
    cancelAnimation: (sharedValue: unknown) => {
      mockCancelAnimation(sharedValue);
      return actual.cancelAnimation?.(sharedValue);
    },
  };
});

let mockTier = 'high';
const mockCanvas = jest.fn((_props: unknown) => null);
jest.mock('@/hooks/useAppPerformanceTier', () => ({ useAppPerformanceTier: () => mockTier }));
jest.mock('./ThreadAuraCanvas', () => ({ ThreadAuraCanvas: (props: unknown) => { mockCanvas(props); return null; } }));

const svg = '<svg viewBox="0 0 100 100"><path d="M 12 18 L 78 34 L 20 79" stroke="currentColor" fill="none"/></svg>';
const props: ThreadAuraProps = {
  anchorId: 'anchor-1',
  svg,
  threadStrength: 68,
  categoryColor: '#66856A',
  size: 200,
  artworkSize: 144,
  variant: 'home',
  active: true,
  heroActive: true,
  reducedMotion: false,
};

beforeEach(() => {
  mockTier = 'high';
  mockCanvas.mockClear();
  mockTiming.mockClear();
  mockSequence.mockClear();
  mockCancelAnimation.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

it('gates animation with foreground and visibility, removes AppState listener', () => {
  let update: (state: AppStateStatus) => void = () => {};
  const remove = jest.fn();
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => { update = fn; return { remove }; });
  const screen = render(<ThreadAura {...props} />);
  act(() => update('active'));
  expect(mockCanvas.mock.calls[mockCanvas.mock.calls.length - 1]?.[0]).toMatchObject({ animate: true, particlesEnabled: true, threadStrength: 68 });
  screen.rerender(<ThreadAura {...props} active={false} />);
  expect(mockCanvas.mock.calls[mockCanvas.mock.calls.length - 1]?.[0]).toMatchObject({ animate: false });
  screen.rerender(<ThreadAura {...props} />);
  act(() => update('background'));
  expect(mockCanvas.mock.calls[mockCanvas.mock.calls.length - 1]?.[0]).toMatchObject({ animate: false });
  screen.unmount(); expect(remove).toHaveBeenCalled(); spy.mockRestore();
});

it.each(['low', 'reduced'])('uses strength-correct native SVG fallback for %s', mode => {
  mockTier = mode === 'low' ? 'low' : 'high';
  const screen = render(<ThreadAura {...props} reducedMotion={mode === 'reduced'} />);
  expect(mockCanvas).not.toHaveBeenCalled();
  const before = screen.UNSAFE_getByType('FeGaussianBlur' as never).props.stdDeviation;
  screen.rerender(<ThreadAura {...props} threadStrength={95} reducedMotion={mode === 'reduced'} />);
  expect(screen.UNSAFE_getByType('FeGaussianBlur' as never).props.stdDeviation).toBeGreaterThan(before);
});

it('keeps enhanced artwork URL, dimensions and cover treatment unchanged', () => {
  const screen = render(<CircularAnchorRenderer svg={svg} imageUrl="https://example.test/kept-art.png" size={200} appearance="paper"
    aura={{ threadStrength: 95, active: true, reducedMotion: true, variant: 'details' }} />);
  const image = screen.UNSAFE_getByType(Image);
  expect(image.props.source).toEqual({ uri: 'https://example.test/kept-art.png' });
  expect(image.props.resizeMode).toBe('cover');
  expect(image.props.style.width).toBe(192);
});

it('runs Phase A (0–220ms bloom to 1.25x) then Phase B (220–850ms settle) for 26% and 80% Thread Strength', () => {
  const lowTargets = homeAuraEntranceTargets(26);
  const highTargets = homeAuraEntranceTargets(80);
  const lastActivatedRef = { current: null as string | null };

  const screen = render(
    <ThreadAura {...props} anchorId="low-anchor" threadStrength={26} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );

  // Phase A (220ms) and Phase B (630ms) run for opacity and scale.
  expect(mockSequence).toHaveBeenCalledTimes(2);
  expect(mockTiming).toHaveBeenCalledWith(lowTargets.peakOpacity, expect.objectContaining({ duration: HOME_AURA_BLOOM_IN_MS }));
  expect(mockTiming).toHaveBeenCalledWith(lowTargets.restingOpacity, expect.objectContaining({ duration: HOME_AURA_SETTLE_MS }));
  expect(mockTiming).toHaveBeenCalledWith(HOME_AURA_PEAK_SCALE, expect.objectContaining({ duration: HOME_AURA_BLOOM_IN_MS }));
  expect(mockTiming).toHaveBeenCalledWith(HOME_AURA_REST_SCALE, expect.objectContaining({ duration: HOME_AURA_SETTLE_MS }));
  expect(lastActivatedRef.current).toBe('low-anchor');

  mockTiming.mockClear();
  mockSequence.mockClear();

  // Switching to an 80% hero triggers a new bloom that settles into a stronger resting glow.
  screen.rerender(
    <ThreadAura {...props} anchorId="high-anchor" threadStrength={80} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).toHaveBeenCalledTimes(2);
  expect(mockTiming).toHaveBeenCalledWith(highTargets.peakOpacity, expect.objectContaining({ duration: HOME_AURA_BLOOM_IN_MS }));
  expect(mockTiming).toHaveBeenCalledWith(highTargets.restingOpacity, expect.objectContaining({ duration: HOME_AURA_SETTLE_MS }));
  expect(highTargets.restingOpacity).toBeGreaterThan(lowTargets.restingOpacity);
  expect(lastActivatedRef.current).toBe('high-anchor');
});

it('does not re-trigger the bloom on unrelated rerenders, Thread Strength refreshes, or navigating away and back', () => {
  const lastActivatedRef = { current: null as string | null };
  const screen = render(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={50} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).toHaveBeenCalledTimes(2);
  mockSequence.mockClear();
  mockTiming.mockClear();

  // Unrelated rerender with identical hero props: no bloom.
  screen.rerender(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={50} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).not.toHaveBeenCalled();

  // Navigating away (`active: false` while `heroActive: true`) and back (`active: true`): no duplicate bloom.
  screen.rerender(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={50} active={false} heroActive lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  screen.rerender(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={50} active heroActive lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).not.toHaveBeenCalled();

  // Background Thread Strength refresh on the same active hero updates resting intensity smoothly without a bloom flash.
  screen.rerender(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={65} active heroActive lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).not.toHaveBeenCalled();
  expect(mockTiming).toHaveBeenCalledWith(
    homeAuraEntranceTargets(65).restingOpacity,
    expect.objectContaining({ duration: HOME_AURA_SETTLE_MS }),
  );
});

it('fades out quickly when a carousel swipe starts and cancels pending animations on rapid hero changes', () => {
  const lastActivatedRef = { current: null as string | null };
  const screen = render(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={70} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  mockTiming.mockClear();
  mockSequence.mockClear();
  mockCancelAnimation.mockClear();

  // Swipe begins: heroActive becomes false -> quick 140ms fade-out to 0 opacity.
  screen.rerender(
    <ThreadAura {...props} anchorId="anchor-1" threadStrength={70} heroActive={false} active={false} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockCancelAnimation).toHaveBeenCalled();
  expect(mockTiming).toHaveBeenCalledWith(0, expect.objectContaining({ duration: HOME_AURA_FADE_OUT_MS }));

  // Next hero commits (`anchor-2` with `heroActive: true`) -> cancels fade and blooms new hero.
  mockTiming.mockClear();
  mockSequence.mockClear();
  screen.rerender(
    <ThreadAura {...props} anchorId="anchor-2" threadStrength={80} heroActive active lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).toHaveBeenCalledTimes(2);
  expect(lastActivatedRef.current).toBe('anchor-2');
});

it('respects reduced-motion by bypassing the bloom and transitioning immediately to resting state', () => {
  const lastActivatedRef = { current: null as string | null };
  render(
    <ThreadAura {...props} anchorId="anchor-rm" threadStrength={26} reducedMotion lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).not.toHaveBeenCalled();
  expect(mockTiming).not.toHaveBeenCalled();
  expect(lastActivatedRef.current).toBe('anchor-rm');
});

it('preserves existing Anchor Details glow behavior without running Home hero bloom', () => {
  render(<ThreadAura {...props} variant="details" threadStrength={80} />);
  expect(mockSequence).not.toHaveBeenCalled();
});

it.each([0, null])('never glows at %s strength: no bloom, no renderer, then blooms once real data arrives', value => {
  const lastActivatedRef = { current: null as string | null };
  const screen = render(
    <ThreadAura {...props} anchorId="zero" threadStrength={value} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  expect(mockSequence).not.toHaveBeenCalled();
  expect(mockCanvas).not.toHaveBeenCalled();
  expect(homeAuraEntranceTargets(value).restingOpacity).toBe(0);

  screen.rerender(
    <ThreadAura {...props} anchorId="zero" threadStrength={40} lastActivatedAnchorIdRef={lastActivatedRef} />,
  );
  if (value === null) {
    // Unknown data was not consumed as an activation, so the full bloom plays on arrival.
    expect(mockSequence).toHaveBeenCalledTimes(2);
  } else {
    expect(mockSequence).not.toHaveBeenCalled();
  }
});

it('Details shows no glow at zero or unknown strength and a 5% stronger glow than Home otherwise', () => {
  const zero = render(<ThreadAura {...props} variant="details" threadStrength={0} />);
  expect(mockCanvas).not.toHaveBeenCalled();
  expect(detailsAuraOpacity(0)).toBe(0);
  expect(detailsAuraOpacity(null)).toBe(0);
  zero.unmount();
  render(<ThreadAura {...props} variant="details" threadStrength={60} />);
  expect(mockCanvas).toHaveBeenCalled();
  expect(detailsAuraOpacity(60)).toBeGreaterThan(homeAuraEntranceTargets(60).restingOpacity);
});
