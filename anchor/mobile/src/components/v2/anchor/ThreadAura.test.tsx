import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, Image, type AppStateStatus } from 'react-native';
import { ThreadAura, type ThreadAuraProps } from './ThreadAura';
import { CircularAnchorRenderer } from './CircularAnchorRenderer';

let mockTier = 'high';
const mockCanvas = jest.fn((_props: unknown) => null);
jest.mock('@/hooks/useAppPerformanceTier', () => ({ useAppPerformanceTier: () => mockTier }));
jest.mock('./ThreadAuraCanvas', () => ({ ThreadAuraCanvas: (props: unknown) => { mockCanvas(props); return null; } }));

const svg = '<svg viewBox="0 0 100 100"><path d="M 12 18 L 78 34 L 20 79" stroke="currentColor" fill="none"/></svg>';
const props: ThreadAuraProps = { svg, threadStrength: 68, categoryColor: '#66856A', size: 200, artworkSize: 144, variant: 'home', active: true, reducedMotion: false };
beforeEach(() => {
  mockTier = 'high'; mockCanvas.mockClear();
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
