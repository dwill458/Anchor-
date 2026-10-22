import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, Image, type AppStateStatus } from 'react-native';
import { ThreadAura, type ThreadAuraProps } from './ThreadAura';
import { CircularAnchorRenderer } from './CircularAnchorRenderer';
import {
  detailsAuraOpacity,
  homeAuraRestingOpacity,
  HOME_AURA_SETTLE_MS,
} from './threadAuraModel';

const mockTiming = jest.fn();
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

it('uses the static fallback for reduced motion, with a gradient halo and no blur filter', () => {
  const screen = render(<ThreadAura {...props} reducedMotion />);
  expect(mockCanvas).not.toHaveBeenCalled();
  expect(screen.UNSAFE_queryAllByType('FeGaussianBlur' as never)).toHaveLength(0);
  expect(screen.UNSAFE_getByType('RadialGradient' as never)).toBeTruthy();
});

it('low tier renders the same filter-free gradient fallback (battery saver baseline)', () => {
  mockTier = 'low';
  const screen = render(<ThreadAura {...props} />);
  expect(mockCanvas).not.toHaveBeenCalled();
  expect(screen.UNSAFE_queryAllByType('FeGaussianBlur' as never)).toHaveLength(0);
  expect(screen.UNSAFE_getByType('RadialGradient' as never)).toBeTruthy();
});

it('static rim stays thin: at most a few pixels, never a thick bead', () => {
  mockTier = 'low';
  const screen = render(<ThreadAura {...props} threadStrength={100} />);
  const rim = screen.UNSAFE_getAllByType('Circle' as never).find(node => node.props.fill === 'none');
  expect(rim).toBeTruthy();
  expect(rim!.props.strokeWidth).toBeLessThanOrEqual(200 * 0.021);
});

it('keeps enhanced artwork URL, dimensions and cover treatment unchanged', () => {
  const screen = render(<CircularAnchorRenderer svg={svg} imageUrl="https://example.test/kept-art.png" size={200} appearance="paper"
    aura={{ threadStrength: 95, active: true, reducedMotion: true, variant: 'details' }} />);
  const image = screen.UNSAFE_getByType(Image);
  expect(image.props.source).toEqual({ uri: 'https://example.test/kept-art.png' });
  expect(image.props.resizeMode).toBe('cover');
  expect(image.props.style.width).toBe(192);
});

it('does not bloom when the hero changes: a re-render or a new Anchor never restarts the glow', () => {
  const screen = render(<ThreadAura {...props} anchorId="anchor-1" threadStrength={50} />);
  mockTiming.mockClear();

  screen.rerender(<ThreadAura {...props} anchorId="anchor-2" threadStrength={50} heroActive />);
  screen.rerender(<ThreadAura {...props} anchorId="anchor-1" threadStrength={50} active={false} heroActive={false} />);
  screen.rerender(<ThreadAura {...props} anchorId="anchor-1" threadStrength={50} active heroActive />);
  expect(mockTiming).not.toHaveBeenCalled();
});

it('eases resting intensity on a Thread Strength refresh, and only then', () => {
  const screen = render(<ThreadAura {...props} threadStrength={50} />);
  mockTiming.mockClear();

  screen.rerender(<ThreadAura {...props} threadStrength={50} />);
  expect(mockTiming).not.toHaveBeenCalled();

  screen.rerender(<ThreadAura {...props} threadStrength={65} />);
  expect(mockTiming).toHaveBeenCalledWith(
    homeAuraRestingOpacity(65),
    expect.objectContaining({ duration: HOME_AURA_SETTLE_MS }),
  );
});

it('renders the carousel-driven glow for neighbours that are not the centred hero', () => {
  const offset = { value: 0 } as never;
  render(<ThreadAura {...props} carouselSlot={1} carouselOffset={offset} carouselSpacing={120} heroActive={false} active={false} />);
  expect(mockCanvas).toHaveBeenCalledWith(expect.objectContaining({ animate: false }));
});

it('cancels the strength tween on unmount', () => {
  const screen = render(<ThreadAura {...props} />);
  mockCancelAnimation.mockClear();
  screen.unmount();
  expect(mockCancelAnimation).toHaveBeenCalled();
});

it('never glows at zero or unknown strength: no renderer, and it lights once real data arrives', () => {
  const screen = render(<ThreadAura {...props} anchorId="zero" threadStrength={null} />);
  expect(mockCanvas).not.toHaveBeenCalled();
  expect(homeAuraRestingOpacity(null)).toBe(0);

  screen.rerender(<ThreadAura {...props} anchorId="zero" threadStrength={40} />);
  expect(mockCanvas).toHaveBeenCalled();
});

it('Details shows no glow at zero or unknown strength and a 5% stronger glow than Home otherwise', () => {
  const zero = render(<ThreadAura {...props} variant="details" threadStrength={0} />);
  expect(mockCanvas).not.toHaveBeenCalled();
  expect(detailsAuraOpacity(0)).toBe(0);
  expect(detailsAuraOpacity(null)).toBe(0);
  zero.unmount();
  render(<ThreadAura {...props} variant="details" threadStrength={60} />);
  expect(mockCanvas).toHaveBeenCalled();
  expect(detailsAuraOpacity(60)).toBeGreaterThan(homeAuraRestingOpacity(60));
});
