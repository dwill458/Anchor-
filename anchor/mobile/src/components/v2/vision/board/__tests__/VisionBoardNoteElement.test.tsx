import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { VisionBoardNoteElement } from '../VisionBoardNoteElement';
import type { VisionNote } from '@/adapters/v2/vision';

const gestures: Record<string, any> = {};
let simultaneous: any[] = [];
jest.mock('react-native-gesture-handler', () => {
  const make = (kind: string) => {
    const callbacks: Record<string, any> = {};
    const gesture: any = new Proxy(callbacks, { get: (target, key: string) => {
      if (key === 'callbacks') return target;
      return (value?: any) => { target[key] = value; return gesture; };
    } });
    gestures[kind] = gesture;
    return gesture;
  };
  return { GestureDetector: ({ children }: any) => children, Gesture: {
    Pan: () => make('pan'), Pinch: () => make('pinch'), Rotation: () => make('rotation'), Tap: () => make('tap'),
    Simultaneous: (...items: any[]) => { simultaneous = items; return items; },
  } };
});
jest.mock('react-native-reanimated', () => ({
  ...require('@/__tests__/mocks/reactNativeReanimated').default,
  runOnJS: (fn: any) => fn,
  withSpring: (to: number) => to,
}));
jest.mock('@/components/v2/vision/notes/VisionNoteRenderer', () => ({ VisionNoteRenderer: ({ text }: any) => {
  const { Text } = require('react-native'); return <Text>{text}</Text>;
} }));

const note: VisionNote = {
  id: 'n1', visionId: 'v1', content: { text: 'The note text' },
  presentation: { styleId: 'sticky_blush_pink', x: .5, y: .5, width: .3, height: .15, rotation: 0, scale: 1, layerOrder: 0 },
  createdAt: '', updatedAt: '',
};

describe('VisionBoardNoteElement gestures', () => {
  it('requires a long press before dragging, selects the note and saves normalized geometry once', () => {
    const onSelect = jest.fn(); const onDragActive = jest.fn(); const onPresentationChange = jest.fn().mockResolvedValue(true);
    render(<VisionBoardNoteElement note={note} sceneWidth={300} sceneHeight={600} cameraScale={{ value: .5 } as never}
      selected={false} reduceMotion onSelect={onSelect} onDragActive={onDragActive} onPresentationChange={onPresentationChange} />);
    expect(screen.getByText('The note text')).toBeTruthy();
    expect(gestures.pan.callbacks.activateAfterLongPress).toBe(250);
    act(() => {
      gestures.pan.callbacks.onStart();
      gestures.pan.callbacks.onUpdate({ translationX: 100, translationY: 80 });
      gestures.pan.callbacks.onFinalize({}, true);
    });
    expect(onSelect).toHaveBeenCalledWith('n1');
    expect(onDragActive).toHaveBeenNthCalledWith(1, true);
    expect(onDragActive).toHaveBeenLastCalledWith(false);
    expect(onPresentationChange).toHaveBeenCalledTimes(1);
    expect(onPresentationChange.mock.calls[0][1].x).toBeCloseTo(.85);
    expect(onPresentationChange.mock.calls[0][1].y).toBeCloseTo(.7666666666666667);
  });

  it('saves a simultaneous pinch and rotation only after both gestures settle', () => {
    const onPresentationChange = jest.fn().mockResolvedValue(true);
    render(<VisionBoardNoteElement note={note} sceneWidth={300} sceneHeight={600} cameraScale={{ value: 1 } as never}
      selected onSelect={jest.fn()} onPresentationChange={onPresentationChange} reduceMotion />);
    act(() => {
      gestures.pinch.callbacks.onStart();
      gestures.rotation.callbacks.onStart();
      gestures.pinch.callbacks.onUpdate({ scale: 1.2 });
      gestures.rotation.callbacks.onUpdate({ rotation: Math.PI / 12 });
      gestures.pinch.callbacks.onFinalize({}, true);
    });
    expect(onPresentationChange).not.toHaveBeenCalled();
    act(() => gestures.rotation.callbacks.onFinalize({}, true));
    expect(onPresentationChange).toHaveBeenCalledTimes(1);
    expect(onPresentationChange.mock.calls[0][1].scale).toBeCloseTo(1.2);
    expect(onPresentationChange.mock.calls[0][1].rotation).toBeCloseTo(15);
    expect(simultaneous).toHaveLength(4);
  });

  it('disables new gestures until the presentation write settles', async () => {
    let resolveSave!: (saved: boolean) => void;
    const onPresentationChange = jest.fn(() => new Promise<boolean>(resolve => { resolveSave = resolve; }));
    render(<VisionBoardNoteElement note={note} sceneWidth={300} sceneHeight={600} cameraScale={{ value: 1 } as never}
      selected onSelect={jest.fn()} onPresentationChange={onPresentationChange} reduceMotion />);
    act(() => {
      gestures.pan.callbacks.onStart();
      gestures.pan.callbacks.onUpdate({ translationX: 20, translationY: 20 });
      gestures.pan.callbacks.onFinalize({}, true);
    });
    expect(onPresentationChange).toHaveBeenCalledTimes(1);
    expect(gestures.pan.callbacks.enabled).toBe(false);
    // Gesture Handler receives enabled=false while the request is pending; the second
    // physical gesture cannot activate until this state changes.
    expect(onPresentationChange).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSave(true); await Promise.resolve(); });
    expect(gestures.pan.callbacks.enabled).toBe(true);
  });

  it.each(['pan', 'pinch'] as const)('cancels a native %s without saving and restores the last saved geometry', kind => {
    const saved = { ...note, presentation: { ...note.presentation, rotation: 12, scale: 1.1 } };
    const onPresentationChange = jest.fn().mockResolvedValue(true);
    const onDragActive = jest.fn();
    const view = render(<VisionBoardNoteElement note={saved} sceneWidth={300} sceneHeight={600} cameraScale={{ value: 1 } as never}
      selected onSelect={jest.fn()} onDragActive={onDragActive} onPresentationChange={onPresentationChange} reduceMotion />);
    const geometry = () => view.UNSAFE_getAllByType(View).map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.width === 90 && style?.height === 90 && style?.left === 105);
    const before = geometry();
    expect(before).toBeDefined();
    const originalTransform = JSON.parse(JSON.stringify(before!.transform));
    act(() => {
      gestures[kind].callbacks.onStart();
      gestures[kind].callbacks.onUpdate(kind === 'pan' ? { translationX: 45, translationY: 60 } : { scale: 1.3 });
    });
    expect(geometry()!.transform).not.toEqual(originalTransform);
    expect(onDragActive).toHaveBeenLastCalledWith(true);
    act(() => gestures[kind].callbacks.onFinalize({}, false));
    expect(geometry()!.transform).toEqual(originalTransform);
    expect(onPresentationChange).not.toHaveBeenCalled();
    expect(onDragActive).toHaveBeenLastCalledWith(false);
    expect(gestures.pan.callbacks.enabled).toBe(true);
  });

  it.each([
    { sceneWidth: 300, sceneHeight: 1200, x: .65, y: .5 },
    { sceneWidth: 1000, sceneHeight: 300, x: .5, y: .58 },
  ])('limits rotated pinching to the actual $sceneWidth by $sceneHeight board and saves it fully inside the canvas', async ({ sceneWidth, sceneHeight, x, y }) => {
    const saved = { ...note, presentation: { ...note.presentation, x, y, rotation: 45 } };
    const onPresentationChange = jest.fn().mockResolvedValue(true);
    render(<VisionBoardNoteElement note={saved} sceneWidth={sceneWidth} sceneHeight={sceneHeight} cameraScale={{ value: 1 } as never}
      selected onSelect={jest.fn()} onPresentationChange={onPresentationChange} reduceMotion />);
    await act(async () => {
      gestures.pinch.callbacks.onStart();
      gestures.pinch.callbacks.onUpdate({ scale: 10 });
      gestures.pinch.callbacks.onFinalize({}, true);
      await Promise.resolve();
    });
    expect(onPresentationChange).toHaveBeenCalledTimes(1);
    const changed = onPresentationChange.mock.calls[0][1];
    const aspect = sceneHeight / sceneWidth, radians = changed.rotation * Math.PI / 180;
    const c = Math.abs(Math.cos(radians)), s = Math.abs(Math.sin(radians));
    const expectedScale = Math.min(2, 1 / (changed.width * c + changed.height * aspect * s), 1 / (changed.height * c + changed.width / aspect * s));
    expect(changed.scale).toBeCloseTo(expectedScale, 8);
    const halfWidth = (changed.width * c + changed.height * aspect * s) * changed.scale / 2;
    const halfHeight = (changed.height * c + changed.width / aspect * s) * changed.scale / 2;
    expect(changed.x - halfWidth).toBeGreaterThanOrEqual(-1e-8);
    expect(changed.x + halfWidth).toBeLessThanOrEqual(1 + 1e-8);
    expect(changed.y - halfHeight).toBeGreaterThanOrEqual(-1e-8);
    expect(changed.y + halfHeight).toBeLessThanOrEqual(1 + 1e-8);
  });
});
