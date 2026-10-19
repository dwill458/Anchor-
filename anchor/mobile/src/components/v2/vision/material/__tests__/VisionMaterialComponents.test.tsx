import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { VisionPaperSurface } from '../VisionPaperSurface';
import { VisionTapeOverlay } from '../VisionTapeOverlay';
import { VisionPhotoArtifact } from '../VisionPhotoArtifact';

function transformOf(style: unknown): Array<Record<string, unknown>> {
  const flat = StyleSheet.flatten(style as never) as { transform?: Array<Record<string, unknown>> };
  return flat.transform ?? [];
}

describe('VisionPaperSurface', () => {
  it('renders its children over the paper base', () => {
    render(<VisionPaperSurface testID="paper" seed={3}><Text>Inside</Text></VisionPaperSurface>);
    expect(screen.getByTestId('paper')).toBeTruthy();
    expect(screen.getByText('Inside')).toBeTruthy();
  });

  it('renders with the default seed and with a custom seed without crashing', () => {
    const { rerender } = render(<VisionPaperSurface testID="paper" />);
    expect(screen.getByTestId('paper')).toBeTruthy();
    rerender(<VisionPaperSurface testID="paper" seed={99} />);
    expect(screen.getByTestId('paper')).toBeTruthy();
  });
});

describe('VisionTapeOverlay', () => {
  it('renders at the requested width and clamps an extreme rotation', () => {
    render(<VisionTapeOverlay testID="tape" width={120} rotation={45} tone="kraft" />);
    const style = StyleSheet.flatten(screen.getByTestId('tape').props.style);
    expect(style.width).toBe(120);
    expect(transformOf(screen.getByTestId('tape').props.style)).toEqual([{ rotate: '12deg' }]);
  });

  it('falls back to a zero width for invalid input', () => {
    render(<VisionTapeOverlay testID="tape" width={Number.NaN} />);
    expect(StyleSheet.flatten(screen.getByTestId('tape').props.style).width).toBe(0);
  });
});

describe('VisionPhotoArtifact', () => {
  const base = { width: 220, accessibilityLabel: 'Sunlit kitchen print' };

  it('renders an accessible image with its label and the photograph', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri="https://assets.test/kitchen.jpg" />);
    expect(screen.getByLabelText('Sunlit kitchen print')).toBeTruthy();
    expect(screen.getByTestId('photo-image').props.source).toEqual({ uri: 'https://assets.test/kitchen.jpg' });
  });

  it('renders a neutral paper placeholder with no image when the uri is missing', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri={null} />);
    expect(screen.getByTestId('photo-placeholder')).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('treats a blank uri as missing', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri="   " />);
    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('removes the image and keeps the placeholder when the image fails to load', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri="https://assets.test/broken.jpg" />);
    act(() => view.UNSAFE_getByType(Image).props.onError({ nativeEvent: { error: 'unavailable' } }));
    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.getByTestId('photo-placeholder')).toBeTruthy();
  });

  it('shows the image after it loads and keeps the decoded aspect ratio', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri="https://assets.test/wide.jpg" />);
    act(() => view.UNSAFE_getByType(Image).props.onLoad({ nativeEvent: { source: { width: 2000, height: 1000 } } }));
    const image = screen.getByTestId('photo-image');
    expect(image.props.resizeMode).toBe('contain');
    expect(StyleSheet.flatten(image.props.style).opacity).toBeUndefined();
  });

  it('ignores a zero-sized decode and stays on the fallback aspect', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri="https://assets.test/empty.jpg" />);
    act(() => view.UNSAFE_getByType(Image).props.onLoad({ nativeEvent: { source: { width: 0, height: 0 } } }));
    expect(screen.getByTestId('photo-image')).toBeTruthy();
  });

  it('clamps an out-of-range rotation to 6 degrees', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri={null} rotation={-20} />);
    expect(transformOf(screen.getByLabelText('Sunlit kitchen print').props.style)).toContainEqual({ rotate: '-6deg' });
  });

  it('renders the handwritten caption and tape when asked', () => {
    const view = render(<VisionPhotoArtifact {...base} testID="photo" uri={null} caption="Morning light" tape seed={4} />);
    expect(screen.getByText('Morning light')).toBeTruthy();
    expect(screen.getByTestId('photo-tape')).toBeTruthy();
  });

  it('renders a zero-width print without crashing', () => {
    const view = render(<VisionPhotoArtifact accessibilityLabel="Collapsed" width={0} uri="https://assets.test/x.jpg" testID="photo" />);
    expect(screen.getByLabelText('Collapsed')).toBeTruthy();
  });
});
