import React from 'react';
import { act, render } from '@testing-library/react-native';
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
  ...require('react-native-reanimated/mock'), runOnJS: (fn: any) => fn,
}));
jest.mock('../../VisionPhotograph', () => ({ VisionPhotograph: () => null }));
jest.mock('../../VisionImageEdge', () => ({ VisionImageEdge: () => null }));

function mountPhoto() {
  const rect = { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 1, frame: 0 };
  const onPress = jest.fn();
  const onOrderCommit = jest.fn();
  const shared: any = { order: { value: ['p1', 'p2'] }, slots: { value: [rect, { ...rect, x: 120 }] },
    dragging: { value: '' }, cameraScale: { value: 1 }, layoutVersion: { value: 0 } };
  render(<VisionBoardPhoto sceneId="p1" imageUrl={null} accessibilityLabel="Photo" initialRect={rect}
    entering={false} exiting={false} shared={shared} reduceMotion interactive dragEnabled
    onPress={onPress} onOrderCommit={onOrderCommit} />);
  return { onPress, onOrderCommit, shared };
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
