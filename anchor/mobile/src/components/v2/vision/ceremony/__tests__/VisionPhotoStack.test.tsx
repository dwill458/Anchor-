import React, { useEffect, useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { VisionPhotoStack, type VisionPhotoStackItem } from '../VisionPhotoStack';

const mockGestures: Record<string, any> = {};
jest.mock('react-native-gesture-handler', () => {
  const make = (kind: string) => {
    const callbacks: Record<string, any> = {};
    const config: Record<string, any> = {};
    const gesture: any = new Proxy(callbacks, { get: (target, key: string) => {
      if (key === 'callbacks') return callbacks;
      if (key === 'config') return config;
      return (...values: any[]) => {
        if (String(key).startsWith('on')) callbacks[key] = values[0];
        else config[key] = values.length === 1 ? values[0] : values;
        return gesture;
      };
    } });
    mockGestures[kind] = gesture;
    return gesture;
  };
  return { GestureDetector: ({ children }: any) => children, Gesture: {
    Pan: () => make('pan'), Tap: () => make('tap'), Simultaneous: (...items: any[]) => items,
  } };
});
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'), runOnJS: (fn: any) => fn,
}));

type Photo = VisionPhotoStackItem & { uri: string };
const makePhotos = (count: number): Photo[] => Array.from({ length: count }, (_, i) => ({ key: `photo-${i + 1}`, uri: `file:///photo-${i + 1}.jpg` }));
const mountCounts: Record<string, number> = {};

function TrackedPhoto({ item, stackPosition }: { item: Photo; stackPosition: number }) {
  useEffect(() => { mountCounts[item.key] = (mountCounts[item.key] ?? 0) + 1; }, [item.key]);
  return <Text testID={`render-${item.key}`}>{stackPosition}</Text>;
}

function Harness({ count, interactive = true }: { count: number; interactive?: boolean }) {
  const items = makePhotos(count);
  const [activeId, setActiveId] = useState(items[0]?.key ?? '');
  return <VisionPhotoStack items={items} activeId={activeId} onActiveIdChange={setActiveId} interactive={interactive}
    hitTargetStyle={{ left: 10, top: 20, width: 100, height: 120 }}
    renderItem={({ item, stackPosition, active }) => <Text testID={`render-${item.key}`} key={item.key}>{`${stackPosition}:${active}`}</Text>} />;
}

describe('VisionPhotoStack', () => {
  it.each([1, 2, 4, 6, 7, 8])('keeps stable photo IDs and reports the active item for %i selected photos', count => {
    const view = render(<Harness count={count} />);
    expect(view.getByTestId('render-photo-1')).toBeTruthy();
    expect(view.getByText('0:true')).toBeTruthy();
    if (count > 1) {
      expect(view.getByTestId('vision-photo-stack-count').props.children).toBe(`1 of ${count}`);
      expect(view.getAllByTestId(/render-photo-/)).toHaveLength(count);
    } else {
      expect(view.queryByTestId('vision-photo-stack-hit-target')).toBeNull();
    }
  });

  it('advances on tap, exposes the correct count, and wraps after the last photo', () => {
    const view = render(<Harness count={4} />);
    act(() => mockGestures.tap.callbacks.onEnd?.({}, true));
    expect(view.getByTestId('render-photo-2')).toBeTruthy();
    expect(view.getByTestId('vision-photo-stack-count').props.children).toBe('2 of 4');
    act(() => { mockGestures.tap.callbacks.onEnd?.({}, true); mockGestures.tap.callbacks.onEnd?.({}, true); mockGestures.tap.callbacks.onEnd?.({}, true); });
    expect(view.getByTestId('render-photo-1')).toBeTruthy();
    expect(view.getByTestId('vision-photo-stack-count').props.children).toBe('1 of 4');
  });

  it('uses horizontal swipes in both directions and rejects vertical or short movement', () => {
    const view = render(<Harness count={4} />);
    act(() => mockGestures.pan.callbacks.onEnd?.({ translationX: -80, translationY: 4 }, true));
    expect(view.getByTestId('render-photo-2')).toBeTruthy();
    act(() => mockGestures.pan.callbacks.onEnd?.({ translationX: 80, translationY: 2 }, true));
    expect(view.getByTestId('render-photo-1')).toBeTruthy();
    act(() => mockGestures.pan.callbacks.onEnd?.({ translationX: -80, translationY: 130 }, true));
    act(() => mockGestures.pan.callbacks.onEnd?.({ translationX: -12, translationY: 0 }, true));
    expect(view.getByTestId('render-photo-1')).toBeTruthy();
    expect(mockGestures.pan.config.activeOffsetX).toEqual([-18, 18]);
    expect(mockGestures.pan.config.failOffsetY).toEqual([-14, 14]);
  });

  it('does not advance for a failed tap or failed swipe', () => {
    const view = render(<Harness count={2} />);
    act(() => { mockGestures.tap.callbacks.onEnd?.({}, false); mockGestures.pan.callbacks.onEnd?.({ translationX: -90, translationY: 0 }, false); });
    expect(view.getByTestId('render-photo-1')).toBeTruthy();
    expect(view.getByTestId('vision-photo-stack-count').props.children).toBe('1 of 2');
  });

  it('keeps every print mounted but hides the indicator and hit target while sealing', () => {
    const view = render(<Harness count={4} interactive={false} />);
    expect(view.getAllByTestId(/render-photo-/)).toHaveLength(4);
    expect(view.queryByTestId('vision-photo-stack-hit-target')).toBeNull();
    expect(view.queryByTestId('vision-photo-stack-count')).toBeNull();
    expect(mockGestures.tap.config.enabled).toBe(false);
    expect(mockGestures.pan.config.enabled).toBe(false);
    act(() => mockGestures.tap.callbacks.onEnd?.({}, true));
    expect(view.getByTestId('render-photo-1')).toBeTruthy();
  });

  it('keeps a photo mounted as it moves from the top of the stack to the paper beneath it', () => {
    Object.keys(mountCounts).forEach(key => delete mountCounts[key]);
    const items = makePhotos(4);
    const StatefulHarness = () => {
      const [activeId, setActiveId] = useState(items[0].key);
      return <VisionPhotoStack items={items} activeId={activeId} onActiveIdChange={setActiveId}
        hitTargetStyle={{ left: 0, top: 0, width: 90, height: 100 }}
        renderItem={({ item, stackPosition }) => <TrackedPhoto item={item} stackPosition={stackPosition} />} />;
    };
    const view = render(<StatefulHarness />);
    expect(mountCounts['photo-1']).toBe(1);
    expect(mountCounts['photo-4']).toBe(1);
    act(() => mockGestures.tap.callbacks.onEnd?.({}, true));
    expect(view.getByTestId('render-photo-1').props.children).toBe(1);
    expect(mountCounts['photo-1']).toBe(1);
    expect(mountCounts['photo-4']).toBe(1);
    expect(view.getByTestId('render-photo-4').props.children).toBe(2);
  });
});
