import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { V2SavedVision } from '../V2SavedVision';
import { getTeachingSeen, resetTeachingSeenCache } from '@/hooks/v2/teaching/teachingSeen';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: (select: Function) => select({ user: null }) }));
jest.mock('@/hooks/v2/teaching/useTeachingFocus', () => ({ useTeachingFocus: () => ({ isFocused: true, transitioning: false }) }));
jest.mock('@/components/v2/teaching/ScreenTeaching', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return { ScreenTeaching: ({ queue }: any) => queue.steps.map((beat: string) => <React.Fragment key={beat}><Pressable testID={`shown-${beat}`} onPress={() => queue.markShown(beat)} /><Pressable testID={beat} onPress={() => queue.dismiss()} /></React.Fragment>) };
});
jest.mock('../board/VisionBoard', () => {
  const { Pressable } = require('react-native');
  return { VisionBoard: ({ onTeachingIdleChange, onDragActive, onReorder }: any) => <>
  <Pressable testID="rest" onPress={() => onTeachingIdleChange(true)} />
  <Pressable testID="focus" onPress={() => onTeachingIdleChange(false)} />
  <Pressable testID="drag" onPress={() => { onTeachingIdleChange(false); onDragActive(true); }} />
  <Pressable testID="reorder" onPress={() => { onDragActive(false); onReorder(['s2', 's1']); onTeachingIdleChange(true); }} />
</> };
});
jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; } }));
const base = {
  anchorIntention: 'An actual intention', description: 'A future with room to create.', teachingEnabled: true,
  onBack: jest.fn(), onVisualize: jest.fn(), onChart: jest.fn(), onUpdateDescription: jest.fn(async () => true),
  onReorder: jest.fn(async () => true), onRemove: jest.fn(async () => true), onAddPhoto: jest.fn(), onAddGenerate: jest.fn(),
  onReplace: jest.fn(async () => {}), onRegenerate: jest.fn(), canGenerateMore: true, onArchive: jest.fn(async () => true),
};
const tiles = [1, 2].map(i => ({ id: `s${i}`, sceneId: `s${i}`, imageUrl: `https://example.com/${i}`, prompt: null, sortOrder: i - 1, isHero: i === 1 }));
beforeEach(() => { resetTeachingSeenCache(); jest.clearAllMocks(); });
it('waits for board rest, whispers at one, and counts dismissal as seen', async () => {
  const view = render(<V2SavedVision {...base} tiles={tiles.slice(0, 1)} />);
  expect(view.queryByTestId('vision.first')).toBeNull();
  fireEvent.press(view.getByTestId('rest'));
  await waitFor(() => expect(view.getByTestId('vision.first')).toBeTruthy());
  fireEvent.press(view.getByTestId('shown-vision.first'));
  fireEvent.press(view.getByTestId('vision.first'));
  expect(await getTeachingSeen(null, 'vision.first')).toBe(true);
});
it('skips first at two, blocks focus and drag, and retains the reorder contract', async () => {
  const view = render(<V2SavedVision {...base} tiles={tiles} />);
  fireEvent.press(view.getByTestId('rest'));
  await waitFor(() => expect(view.getByTestId('vision.second')).toBeTruthy());
  expect(await getTeachingSeen(null, 'vision.first')).toBe(true);
  fireEvent.press(view.getByTestId('focus'));
  expect(view.queryByTestId('vision.second')).toBeNull();
  expect(await getTeachingSeen(null, 'vision.second')).toBe(false);
  fireEvent.press(view.getByTestId('drag'));
  expect(view.queryByTestId('vision.second')).toBeNull();
  await act(async () => fireEvent.press(view.getByTestId('reorder')));
  expect(base.onReorder).toHaveBeenCalledWith([{ id: 's2', sortOrder: 0 }, { id: 's1', sortOrder: 1 }]);
});
it('blocks arrival and external ceremony/picker activity', async () => {
  const view = render(<V2SavedVision {...base} tiles={tiles} teachingBlocked />);
  fireEvent.press(view.getByTestId('rest'));
  await act(async () => { await Promise.resolve(); });
  expect(view.queryByTestId('vision.second')).toBeNull();
  view.rerender(<V2SavedVision {...base} tiles={tiles} teachingBlocked={false} />);
  await waitFor(() => expect(view.getByTestId('vision.second')).toBeTruthy());
});

it('waits for a queued milestone and yields if one starts during teaching', async () => {
  useMilestoneCelebrationStore.setState({ queue: [{ key: 'before' } as never] });
  const view = render(<V2SavedVision {...base} tiles={tiles.slice(0, 1)} />);
  fireEvent.press(view.getByTestId('rest'));
  await act(async () => { await Promise.resolve(); });
  expect(view.queryByTestId('vision.first')).toBeNull();
  act(() => useMilestoneCelebrationStore.getState().shift('before'));
  await waitFor(() => expect(view.getByTestId('vision.first')).toBeTruthy());
  act(() => useMilestoneCelebrationStore.setState({ queue: [{ key: 'during' } as never] }));
  expect(view.queryByTestId('vision.first')).toBeNull();
  view.unmount();
  useMilestoneCelebrationStore.setState({ queue: [] });
});
