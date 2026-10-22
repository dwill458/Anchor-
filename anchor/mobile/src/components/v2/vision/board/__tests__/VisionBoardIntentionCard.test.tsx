
import { fireEvent, render } from '@testing-library/react-native';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { VisionBoardIntentionCard } from '../VisionBoardIntentionCard';

const mockMarkProps: Array<Record<string, unknown>> = [];
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => {
  const { View } = require('react-native');
  return {
    CircularAnchorRenderer: (props: Record<string, unknown>) => {
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

  it('enlarges the paper-backed Anchor by 30% while keeping its actual enhanced artwork', () => {
    const art = { ...anchorRenderProps(storedAnchor), imageUrl: 'https://example.com/my-anchor.png' };
    const view = render(<VisionBoardIntentionCard rect={rect} intention="My future" art={art} markAppearance="paper" reduceMotion />);
    expect(view.getByTestId('vision-board-card-mark-slot').props.style.width).toBeCloseTo(rect.width * .94 * 1.3);
    expect(mockMarkProps[0]).toEqual(expect.objectContaining({ svg: art.svg, imageUrl: art.imageUrl }));
    expect(mockMarkProps[0].size).toBeCloseTo(rect.width * .94 * 1.3);
  });

  it('lets the compositor own the actual seal without duplicate text or art', () => {
    const view = render(<VisionBoardIntentionCard rect={rect} intention="My saved intention" art={anchorRenderProps(storedAnchor)} hideMark reduceMotion />);
    expect(mockMarkProps).toHaveLength(0);
    expect(view.queryByText('My saved intention')).toBeNull();
    expect(view.getByTestId('vision-board-card-mark-slot').props.style.width).toBe(258);
  });

  it.each([true, false])('reports the measured mark in paper coordinates regardless of layout event order: %s', contentFirst => {
    const onMarkLayout = jest.fn();
    const view = render(<VisionBoardIntentionCard rect={rect} intention="Real intention" onMarkLayout={onMarkLayout} hideMark reduceMotion />);
    const content = () => fireEvent(view.getByTestId('vision-board-card-content'), 'layout', { nativeEvent: { layout: { x: 33, y: 49.4, width: 234, height: 292.6 } } });
    const mark = () => fireEvent(view.getByTestId('vision-board-card-mark-slot'), 'layout', { nativeEvent: { layout: { x: 39, y: 17, width: 156, height: 156 } } });
    if (contentFirst) { content(); mark(); } else { mark(); content(); }
    expect(onMarkLayout).toHaveBeenLastCalledWith({ x: 72, y: 66.4, width: 156, height: 156 });
  });

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

  it('uses the saved enhancement with the persisted SVG as fallback', () => {
    const enhanced = { ...(storedAnchor as object), enhancedImageUrl: 'https://example.com/enhanced.jpg' } as never;
    const view = render(<VisionBoardIntentionCard rect={rect} intention="My future" category="career" art={anchorRenderProps(enhanced)} reduceMotion />);
    expect(mockMarkProps).toHaveLength(1);
    expect(mockMarkProps[0].svg).toBe(anchorRenderProps(enhanced).svg);
    expect(mockMarkProps[0].imageUrl).toBe('https://example.com/enhanced.jpg');
    expect(mockMarkProps[0].appearance).toBe('bare');
    expect(view.UNSAFE_queryAllByType(require('react-native').Image)).toHaveLength(0);
  });

  it('keeps intention accessible without duplicating the overview heading', () => {
    const view = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" category="career" art={anchorRenderProps(storedAnchor)} reduceMotion />);
    expect(view.queryByText('Anchor has ten thousand users')).toBeNull();
    expect(view.getByLabelText('Your Anchor, Career. Anchor has ten thousand users')).toBeTruthy();
  });

  it('is tappable to bring the Anchor forward, and a plain image when it is not', () => {
    const onPress = jest.fn();
    const tappable = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" onPress={onPress} reduceMotion />);
    expect(tappable.getByRole('button')).toBeTruthy();
    const still = render(<VisionBoardIntentionCard rect={rect} intention="Anchor has ten thousand users" reduceMotion />);
    expect(still.queryByRole('button')).toBeNull();
  });
});
