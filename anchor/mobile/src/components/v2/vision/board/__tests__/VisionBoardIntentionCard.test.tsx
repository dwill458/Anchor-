import React from 'react';
import { render } from '@testing-library/react-native';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { VisionBoardIntentionCard, intentionTypeScale } from '../VisionBoardIntentionCard';

const mockMarkProps: Array<Record<string, unknown>> = [];
jest.mock('@/components/v2/anchor/AnchorMark', () => {
  const { View } = require('react-native');
  return {
    AnchorMark: (props: Record<string, unknown>) => {
      mockMarkProps.push(props);
      return <View testID={(props.testID as string) ?? 'anchor-mark'} />;
    },
  };
});

const rect = { x: 100, y: 100, width: 300, height: 380, rotation: -1.5, zIndex: 40 };
const storedAnchor = {
  baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9"/></svg>',
  reinforcedSigilSvg: null,
  enhancedImageUrl: undefined,
  category: 'career',
  classifierMeta: undefined,
} as never;

describe('VisionBoardIntentionCard', () => {
  beforeEach(() => { mockMarkProps.length = 0; });

  it('draws the Anchor\'s own stored structure, never a re-drawn one', () => {
    const art = anchorRenderProps(storedAnchor);
    render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" category="career" art={art} reduceMotion />);
    expect(mockMarkProps).toHaveLength(1);
    // The exact string the rest of the app renders (Home, Details, Practice), passed through untouched.
    expect(mockMarkProps[0].svg).toBe((storedAnchor as { baseSigilSvg: string }).baseSigilSvg);
    expect(mockMarkProps[0].svg).toBe(art.svg);
  });

  it('follows a reinforced Anchor: whatever geometry the Anchor currently has is what is shown', () => {
    const reinforced = { ...(storedAnchor as object), reinforcedSigilSvg: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>' } as never;
    render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" category="career" art={anchorRenderProps(reinforced)} reduceMotion />);
    expect(mockMarkProps[0].svg).toContain('<circle');
  });

  it('shows the enhanced artwork on the paper when the Anchor has one, and the drawn structure when it does not', () => {
    const enhanced = { ...(storedAnchor as object), enhancedImageUrl: 'https://example.com/enhanced.jpg' } as never;
    const view = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" category="career"
      art={anchorRenderProps(enhanced)} reduceMotion />);
    expect(view.UNSAFE_getAllByType(require('react-native').Image).some((node: { props: { source?: { uri?: string } } }) => node.props.source?.uri === 'https://example.com/enhanced.jpg')).toBe(true);
    expect(mockMarkProps).toHaveLength(0);
  });

  it('writes the intention as live text, from the active Anchor', () => {
    const view = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" category="career"
      art={anchorRenderProps(storedAnchor)} reduceMotion />);
    expect(view.getByText('Anchor has ten thousand users')).toBeTruthy();
    expect(view.getByLabelText('Your Anchor, Career. Anchor has ten thousand users')).toBeTruthy();
  });

  it('keeps a long intention on the paper: smaller type, a line limit, and fit-to-width', () => {
    const long = 'I run a calm, profitable company that helps a million people build habits that last, while spending every evening with my family and every summer by the sea.';
    const view = render(<VisionBoardIntentionCard rect={rect} intention={long} category="career" art={anchorRenderProps(storedAnchor)} reduceMotion />);
    const text = view.getByText(long);
    const { fontScale, lines } = intentionTypeScale(long);
    expect(fontScale).toBeLessThan(intentionTypeScale('Short').fontScale);
    expect(text.props.numberOfLines).toBe(lines);
    expect(text.props.adjustsFontSizeToFit).toBe(true);
    const style = Object.assign({}, ...[text.props.style].flat(3).filter(Boolean));
    expect(style.fontSize).toBeCloseTo(rect.width * 0.128 * fontScale, 5);
  });

  it('shrinks in steps as the intention grows', () => {
    const scales = ['x'.repeat(20), 'x'.repeat(50), 'x'.repeat(100), 'x'.repeat(300)].map(text => intentionTypeScale(text).fontScale);
    expect(scales).toEqual([...scales].sort((a, b) => b - a));
    expect(new Set(scales).size).toBe(4);
  });

  it('is tappable to bring the Anchor forward, and a plain image when it is not', () => {
    const onPress = jest.fn();
    const tappable = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" onPress={onPress} reduceMotion />);
    expect(tappable.getByRole('button')).toBeTruthy();
    const still = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" reduceMotion />);
    expect(still.queryByRole('button')).toBeNull();
  });
});
