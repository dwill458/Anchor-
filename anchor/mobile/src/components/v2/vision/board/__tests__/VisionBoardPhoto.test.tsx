import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { VisionBoardPhoto } from '../VisionBoardPhoto';

const mockGestures: Record<string, any> = {};
jest.mock('react-native-gesture-handler', () => {
  const make = (kind: string) => {
    const callbacks: Record<string, any> = {};
    const gesture: any = new Proxy(callbacks, { get: (target, key: string) => {
      if (key === 'callbacks') return target;
      return (value: any) => { target[key] = value; return gesture; };
    } });
    mockGestures[kind] = gesture;
    return gesture;
  };
  return { GestureDetector: ({ children }: any) => children, Gesture: {
    Pan: () => make('pan'), Tap: () => make('tap'), LongPress: () => make('hold'),
    Race: (...items: any[]) => items, Simultaneous: (...items: any[]) => items,
  } };
});
jest.mock('react-native-reanimated', () => ({
  ...require('@/__tests__/mocks/reactNativeReanimated').default, runOnJS: (fn: any) => fn,
}));
jest.mock('../../VisionPhotograph', () => ({ VisionPhotograph: (props: any) => {
  const { Image } = require('react-native');
  return <Image {...props} testID="board-image" />;
} }));
jest.mock('../../VisionImageEdge', () => ({ VisionImageEdge: () => null }));

function mountPhoto() {
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const onPress = jest.fn();
  const onOrderCommit = jest.fn();
  const shared: any = { order: { value: ['p1', 'p2'] }, slots: { value: [rect, { ...rect, x: 120 }] },
    dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  const onCaptionEdit = jest.fn();
  const view = render(<VisionBoardPhoto sceneId="p1" imageUrl={null} accessibilityLabel="Photo" initialRect={rect}
    entering={false} exiting={false} shared={shared} reduceMotion interactive dragEnabled
    onPress={onPress} onCaptionEdit={onCaptionEdit} onOrderCommit={onOrderCommit} />);
  return { onPress, onCaptionEdit, onOrderCommit, shared, view };
}

it('keeps a held photo draggable and commits its new slot without opening actions', () => {
  const { onPress, onOrderCommit, shared } = mountPhoto();
  act(() => {
    mockGestures.hold.callbacks.onBegin?.();
    mockGestures.pan.callbacks.onStart();
    mockGestures.hold.callbacks.onStart?.();
  });
  expect(onPress).not.toHaveBeenCalled();
  act(() => {
    mockGestures.pan.callbacks.onUpdate({ translationX: 120, translationY: 0 });
    mockGestures.pan.callbacks.onFinalize({}, true);
    mockGestures.hold.callbacks.onEnd?.({}, true);
  });
  expect(shared.order.value).toEqual(['p2', 'p1']);
  expect(onOrderCommit).toHaveBeenCalledWith(['p2', 'p1']);
  expect(onPress).not.toHaveBeenCalled();
});

it('opens actions only when a stationary hold is released successfully', () => {
  const { onPress } = mountPhoto();
  act(() => {
    mockGestures.hold.callbacks.onBegin?.();
    mockGestures.hold.callbacks.onStart?.();
  });
  expect(onPress).not.toHaveBeenCalled();
  act(() => mockGestures.hold.callbacks.onEnd?.({}, true));
  expect(onPress).toHaveBeenCalledWith('p1');
});

it('retries a failed saved photograph without opening board actions', () => {
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const onPress = jest.fn();
  const shared: any = { order: { value: ['p1'] }, slots: { value: [rect] }, dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  const view = render(<VisionBoardPhoto sceneId="p1" imageUrl="https://assets.test/photo.jpg" accessibilityLabel="Photo"
    initialRect={rect} entering={false} exiting={false} shared={shared} reduceMotion interactive dragEnabled={false} onPress={onPress} />);
  fireEvent(view.getByTestId('board-image'), 'error');
  expect(view.getByText('Image unavailable. Tap to retry.')).toBeTruthy();
  act(() => mockGestures.tap.callbacks.onEnd({}, true));
  expect(view.getByTestId('board-image').props.source.uri).toBe('https://assets.test/photo.jpg');
  expect(onPress).not.toHaveBeenCalled();
});

it('opens the caption editor from the under-photo affordance without focusing the photo', () => {
  const { onPress, onCaptionEdit, view } = mountPhoto();

  fireEvent.press(view.getByTestId('vision-board-photo-p1-caption-edit'));

  expect(onCaptionEdit).toHaveBeenCalledWith('p1');
  expect(onPress).not.toHaveBeenCalled();
});

it('keeps an existing caption editable from the under-photo affordance', () => {
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const onCaptionEdit = jest.fn();
  const shared: any = { order: { value: ['p1'] }, slots: { value: [rect] }, dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  const view = render(<VisionBoardPhoto sceneId="p1" imageUrl={null} caption="My scene caption" accessibilityLabel="Photo"
    initialRect={rect} entering={false} exiting={false} shared={shared} reduceMotion interactive dragEnabled onCaptionEdit={onCaptionEdit} />);

  expect(view.getByTestId('vision-board-photo-p1-caption-edit').props.accessibilityLabel).toBe('Edit photo caption');
  expect(view.getByText('My scene caption')).toBeTruthy();
  fireEvent.press(view.getByTestId('vision-board-photo-p1-caption-edit'));
  expect(onCaptionEdit).toHaveBeenCalledWith('p1');
});

it('reports missing photo assets immediately so a static export can finish', () => {
  const onPhotoAssetReady = jest.fn();
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const shared: any = { order: { value: ['p1'] }, slots: { value: [rect] }, dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  render(<VisionBoardPhoto sceneId="p1" imageUrl={null} accessibilityLabel="Photo" initialRect={rect}
    entering={false} exiting={false} shared={shared} reduceMotion interactive={false} dragEnabled={false} onPhotoAssetReady={onPhotoAssetReady} />);
  expect(onPhotoAssetReady).toHaveBeenCalledWith('p1');
});

it('forwards settled photo readiness with its scene id', () => {
  const onPhotoAssetReady = jest.fn();
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const shared: any = { order: { value: ['p1'] }, slots: { value: [rect] }, dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  const view = render(<VisionBoardPhoto sceneId="p1" imageUrl="https://assets.test/photo.jpg" accessibilityLabel="Photo" initialRect={rect}
    entering={false} exiting={false} shared={shared} reduceMotion interactive={false} dragEnabled={false} onPhotoAssetReady={onPhotoAssetReady} />);
  fireEvent(view.getByTestId('board-image'), 'assetReady');
  expect(onPhotoAssetReady).toHaveBeenCalledWith('p1');
});

it('reports a committed unavailable fallback after foreground failure even when the backdrop never settles', async () => {
  const onPhotoAssetReady = jest.fn();
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const shared: any = { order: { value: ['p1'] }, slots: { value: [rect] }, dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  const pendingFrames: FrameRequestCallback[] = [];
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  }) as typeof global.requestAnimationFrame;
  try {
    const view = render(<VisionBoardPhoto sceneId="p1" imageUrl="https://assets.test/photo.jpg" accessibilityLabel="Photo" initialRect={rect}
      entering={false} exiting={false} shared={shared} reduceMotion interactive={false} dragEnabled={false} onPhotoAssetReady={onPhotoAssetReady} />);

    fireEvent(view.getByTestId('board-image'), 'error');
    expect(view.getByText('Image unavailable')).toBeTruthy();
    expect(onPhotoAssetReady).not.toHaveBeenCalled();
    await act(async () => { pendingFrames.shift()?.(0); });
    expect(onPhotoAssetReady).toHaveBeenCalledWith('p1');
  } finally {
    global.requestAnimationFrame = originalRequestAnimationFrame;
  }
});
