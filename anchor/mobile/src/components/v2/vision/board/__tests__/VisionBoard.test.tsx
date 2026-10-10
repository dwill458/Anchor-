import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { VisionBoard, type VisionBoardProps } from '../VisionBoard';

// Native shared values retain identity across React renders; the package's
// default Node mock recreates them and cannot model a camera handoff.
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return { ...mock, useSharedValue: (initial: any) => require('react').useRef({ value: initial }).current,
    withTiming: (target: any, _config: any, callback?: (finished: boolean) => void) => { callback?.(true); return target; },
    withDelay: (_delay: number, value: any) => value,
  };
});

jest.mock('../VisionBoardScene', () => ({
  VisionBoardScene: ({ onPhotoPress, onCardPress, onOrderCommit }: any) => {
    const { Pressable: Button } = require('react-native');
    return <><Button accessibilityLabel="Focus photo" onPress={() => onPhotoPress('p1')} />
      <Button accessibilityLabel="Focus supporting photo" onPress={() => onPhotoPress("p2")} /><Button accessibilityLabel="Focus card" onPress={onCardPress} /><Button accessibilityLabel="Reorder visible photos" onPress={() => onOrderCommit(["p3", "p1", "p2"])} /></>;
  },
}));

const props: VisionBoardProps = {
  tiles: [{ id: 'p1', sceneId: 'p1', imageUrl: 'https://example.com/photo.jpg', prompt: null, sortOrder: 0, isHero: true, sourceType: 'AI_GENERATED' }],
  intention: 'My real intention', width: 296, reduceMotion: true, canRegenerate: false,
  onReplace: jest.fn(), onRegenerate: jest.fn(), onRemove: jest.fn(), onEditVision: jest.fn(), onReorder: jest.fn(),
};

describe('VisionBoard focused controls', () => {
  it('keeps the Add action available at the image limit and preserves its callback', () => {
    const onAddImage = jest.fn();
    const tiles = Array.from({ length: 8 }, (_, index) => ({ ...props.tiles[0], id: `p${index}`, sceneId: `p${index}`, sortOrder: index }));
    const view = render(<VisionBoard {...props} tiles={tiles} onAddImage={onAddImage} />);
    expect(view.getByText('Add')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(onAddImage).toHaveBeenCalledTimes(1);
  });
  it('leaves the caption empty unless the user supplied one', () => {
    const view = render(<VisionBoard {...props} />);
    expect(view.queryByTestId('vision-board-annotation')).toBeNull();
    view.rerender(<VisionBoard {...props} annotation="Time with my family" />);
    expect(view.getByTestId('vision-board-annotation').props.children).toBe('Time with my family');
    fireEvent.press(view.getByLabelText('Focus photo'));
    expect(view.queryByTestId('vision-board-annotation')).toBeNull();
  });
  it('grows to keep a long caption fully visible', () => {
    const view = render(<VisionBoard {...props} annotation={'A meaningful future with my family '.repeat(2)} />);
    const before = require('react-native').StyleSheet.flatten(view.getByTestId('vision-board').props.style).height;
    fireEvent(view.getByTestId('vision-board-annotation'), 'layout', { nativeEvent: { layout: { height: 200 } } });
    const after = require('react-native').StyleSheet.flatten(view.getByTestId('vision-board').props.style).height;
    expect(after).toBeGreaterThan(before);
  });
  it('shows the image-set limit and prevents regeneration when none remain', () => {
    const view = render(<VisionBoard {...props} />);
    fireEvent.press(view.getByLabelText('Focus photo'));
    expect(view.getByText('No image sets left for this Vision.')).toBeTruthy();
    expect(view.getByLabelText('Regenerate').props.accessibilityState.disabled).toBe(true);
    expect(view.getByLabelText('Regenerate').props.accessibilityHint).toBe('No image sets left for this Vision.');
    fireEvent.press(view.getByLabelText('Regenerate'));
    expect(props.onRegenerate).not.toHaveBeenCalled();
    view.rerender(<VisionBoard {...props} canRegenerate />);
    expect(view.queryByText('No image sets left for this Vision.')).toBeNull();
    expect(view.getByLabelText('Regenerate').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(view.getByLabelText('Regenerate'));
    expect(props.onRegenerate).toHaveBeenCalledWith('p1');
  });

  it('captures the displayed camera for both the whole canvas and a focused photo', () => {
    const captureFrame = { current: null as (() => { x: number; y: number; width: number; height: number }) | null };
    const tiles = Array.from({ length: 3 }, (_, i) => ({ ...props.tiles[0], id: `p${i + 1}`, sceneId: `p${i + 1}`, sortOrder: i }));
    const view = render(<VisionBoard {...props} tiles={tiles} reduceMotion={false} captureFrame={captureFrame} />);
    const rest = captureFrame.current!();
    expect(rest.x).toBeCloseTo(0); expect(rest.y).toBeCloseTo(0);
    expect(rest.width).toBeCloseTo(props.width);
    fireEvent.press(view.getByLabelText('Focus supporting photo'));
    expect(captureFrame.current!().width).toBeGreaterThan(rest.width);
    fireEvent.press(view.getByLabelText('Back to the whole board'));
    expect(captureFrame.current!().width).toBeCloseTo(rest.width);
  });

  it('retains all collection IDs when only the three visible photographs are reordered', () => {
    const onReorder = jest.fn();
    const tiles = Array.from({ length: 6 }, (_, i) => ({ ...props.tiles[0], id: `p${i + 1}`, sceneId: `p${i + 1}`, sortOrder: i }));
    const view = render(<VisionBoard {...props} tiles={tiles} onReorder={onReorder} />);
    fireEvent.press(view.getByLabelText('Reorder visible photos'));
    expect(onReorder).toHaveBeenCalledWith(['p3', 'p1', 'p2', 'p4', 'p5', 'p6']);
  });

  it('keeps the limit note out of busy and card controls', () => {
    const view = render(<VisionBoard {...props} busy />);
    fireEvent.press(view.getByLabelText('Focus photo'));
    expect(view.queryByText('No image sets left for this Vision.')).toBeNull();
    view.rerender(<VisionBoard {...props} />);
    fireEvent.press(view.getByLabelText('Focus card'));
    expect(view.queryByText('No image sets left for this Vision.')).toBeNull();
  });
});
