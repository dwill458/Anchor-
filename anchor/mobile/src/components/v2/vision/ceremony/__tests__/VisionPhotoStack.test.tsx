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

jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => false }));

describe('VisionPhotoStack pager', () => {
  it.each([1, 2, 4])('keeps all %i prints mounted and uses dots only for multiple photos', count => {
    const view = render(<Harness count={count} />);
    expect(view.getAllByTestId(/render-photo-/)).toHaveLength(count);
    expect(view.queryByTestId('vision-photo-stack-count')).toBeNull();
    if (count > 1) {
      expect(view.getAllByTestId(/vision-photo-stack-dot-\d/)).toHaveLength(count);
      expect(view.getByTestId('vision-photo-stack-dot-0').props.accessibilityState.selected).toBe(true);
    } else expect(view.queryByTestId('vision-photo-stack-dots')).toBeNull();
  });
  it('selects a card with its dot and preserves the caption identity', () => {
    const view = render(<Harness count={4} />);
    fireEvent.press(view.getByTestId('vision-photo-stack-dot-2'));
    expect(view.getByTestId('render-photo-3').props.children).toBe('0:true');
    expect(view.getByTestId('vision-photo-stack-dot-2').props.accessibilityState.selected).toBe(true);
  });
  it('settles to the nearest card after a continuous drag, without wrapping the edges', () => {
    const view = render(<Harness count={4} />);
    act(() => {
      mockGestures.pan.callbacks.onStart();
      mockGestures.pan.callbacks.onUpdate({ translationX: -160 });
      mockGestures.pan.callbacks.onEnd({ velocityX: -400 }, true);
      mockGestures.pan.callbacks.onFinalize();
    });
    expect(view.getByTestId('vision-photo-stack-dot-1').props.accessibilityState.selected).toBe(true);
    act(() => {
      mockGestures.pan.callbacks.onStart();
      mockGestures.pan.callbacks.onUpdate({ translationX: 900 });
      mockGestures.pan.callbacks.onEnd({ velocityX: 200 }, true);
      mockGestures.pan.callbacks.onFinalize();
    });
    expect(view.getByTestId('vision-photo-stack-dot-0').props.accessibilityState.selected).toBe(true);
  });
  it('uses the half-distance boundary, including clamped first and last cards', () => {
    const { nearestVisionCard } = require('../VisionPhotoStack');
    expect(nearestVisionCard(-128, 258, 4)).toBe(0);
    expect(nearestVisionCard(-129, 258, 4)).toBe(1);
    expect(nearestVisionCard(-387, 258, 4)).toBe(2);
    expect(nearestVisionCard(400, 258, 4)).toBe(0);
    expect(nearestVisionCard(-2000, 258, 4)).toBe(3);
  });
  it('keeps the same print views when selection changes', () => {
    Object.keys(mountCounts).forEach(key => delete mountCounts[key]);
    const items = makePhotos(4);
    const StatefulHarness = () => {
      const [activeId, setActiveId] = useState(items[0].key);
      return <VisionPhotoStack items={items} activeId={activeId} onActiveIdChange={setActiveId}
        hitTargetStyle={{ left: 0, top: 0, width: 90, height: 100 }}
        renderItem={({ item, stackPosition }) => <TrackedPhoto item={item} stackPosition={stackPosition} />} />;
    };
    const view = render(<StatefulHarness />);
    fireEvent.press(view.getByTestId('vision-photo-stack-dot-1'));
    expect(mountCounts['photo-1']).toBe(1);
    expect(mountCounts['photo-4']).toBe(1);
  });
  it('disables browsing and hides the dots during the seal', () => {
    const view = render(<Harness count={4} interactive={false} />);
    expect(view.getAllByTestId(/render-photo-/)).toHaveLength(4);
    expect(view.queryByTestId('vision-photo-stack-hit-target')).toBeNull();
    expect(view.queryByTestId('vision-photo-stack-dots')).toBeNull();
    expect(mockGestures.pan.config.enabled).toBe(false);
  });
});
