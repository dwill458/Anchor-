import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaywallChartPreviewTile, PaywallPracticeTile, PaywallVisionTile } from '../PaywallPreviewTiles';

const HIDDEN = { includeHiddenElements: true } as const;
const frame = { width: 160, height: 75, W: 375 };

function tileTexts(root: ReturnType<typeof render>) {
  return root.UNSAFE_getAllByType(Text);
}

function expectDecorativeText(root: ReturnType<typeof render>, T: number) {
  const texts = tileTexts(root);
  expect(texts.length).toBeGreaterThan(0);
  for (const node of texts) {
    expect(node.props.allowFontScaling).toBe(false);
    expect(node.props.numberOfLines).toBe(1);
    // Sized from the tile, never the screen: no text larger than 8% of T.
    const style = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(style.fontSize).toBeLessThanOrEqual(0.08 * T);
  }
}

describe('paywall step-1 preview tiles', () => {
  it('Vision fallback: plus glyph and "Add your Vision", no eyebrow, hidden from assistive tech', () => {
    const view = render(<PaywallVisionTile {...frame} vision={null} />);
    const tile = screen.getByTestId('v2-paywall-vision-fallback', HIDDEN);
    expect(tile.props.accessibilityElementsHidden).toBe(true);
    expect(tile.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.getByText('Add your Vision', HIDDEN)).toBeTruthy();
    expect(screen.queryByText('MY VISION', HIDDEN)).toBeNull();
    expectDecorativeText(view, frame.width);
  });

  it('Vision with an image: eyebrow above the title, shrink-to-fit before ellipsis', () => {
    const view = render(<PaywallVisionTile {...frame} vision={{ imageUri: 'https://img/v.jpg', title: 'A calmer, freer me' }} />);
    expect(screen.getByText('MY VISION', HIDDEN)).toBeTruthy();
    const title = screen.getByText('A calmer, freer me', HIDDEN);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBe(0.8);
    expectDecorativeText(view, frame.width);
  });

  it('Practice: no eyebrow, both lines one-line, and sizes follow the measured tile width', () => {
    const view = render(<PaywallPracticeTile {...frame} art={null} reduceMotion />);
    expect(screen.queryByText('PRACTICE', HIDDEN)).toBeNull();
    expect(screen.getByText('Anchor Session', HIDDEN).props.adjustsFontSizeToFit).toBe(true);
    expect(screen.getByText('5 min · Audio', HIDDEN)).toBeTruthy();
    expectDecorativeText(view, frame.width);

    // A narrower tile (e.g. 360dp Android) re-derives every size from the new width.
    const tile = view.UNSAFE_root.findAll((node: { props?: { onLayout?: unknown } }) => typeof node.props?.onLayout === 'function')[0];
    fireEvent(tile, 'layout', { nativeEvent: { layout: { width: 120, height: 75, x: 0, y: 0 } } });
    const line1 = screen.getByText('Anchor Session', HIDDEN);
    const style = Array.isArray(line1.props.style) ? Object.assign({}, ...line1.props.style) : line1.props.style;
    expect(style.fontSize).toBeCloseTo(0.07 * 120);
  });

  it('Chart: "MY PATH" eyebrow is tile-sized, one line and non-scaling', () => {
    const view = render(<PaywallChartPreviewTile {...frame} reduceMotion />);
    expect(screen.getByText('MY PATH', HIDDEN)).toBeTruthy();
    expectDecorativeText(view, frame.width);
  });
});
