import React from 'react';
import { AccessibilityInfo, BackHandler, Pressable, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { SpotlightCoach } from '../SpotlightCoach';
import { measureTeachingTarget } from '../scrollToTarget';
import { TEACHING_COPY } from '@/constants/v2/teachingCopy';
jest.mock('../scrollToTarget', () => ({ measureTeachingTarget: jest.fn(async () => ({ x: 0, y: 0, width: 390, height: 844 })) }));
const steps = ['home.today', 'home.progress'].map(id => ({ id, ...TEACHING_COPY.beats[id as 'home.today'] , getRect: async () => ({ x: 20, y: 250, width: 300, height: 70 }) })) as React.ComponentProps<typeof SpotlightCoach>['steps'];
beforeEach(() => jest.clearAllMocks());
it('announces, advances, cuts instantly with reduced motion, and leaves no touch surface when hidden', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const ready = jest.fn();
  const dismiss = jest.fn();
  const advance = jest.fn();
  const props = { visible: true, steps, reducedMotion: true, onReady: ready, onDismiss: dismiss, onAdvance: advance };
  const tree = render(<SpotlightCoach {...props} />);
  await waitFor(() => expect(ready).toHaveBeenCalledWith('home.today'));
  expect(announce).toHaveBeenCalledWith(expect.stringContaining(steps[0].body));
  expect(tree.getAllByLabelText('Dismiss tip')).toHaveLength(4);
  expect(tree.getByText('1 of 2')).toBeTruthy();
  fireEvent.press(tree.getByText('Next'));
  await waitFor(() => expect(ready).toHaveBeenCalledWith('home.progress'));
  expect(Reanimated.withTiming).not.toHaveBeenCalled();
  fireEvent.press(tree.getByText('Got it'));
  expect(dismiss).toHaveBeenCalledWith('complete');
  expect(advance).toHaveBeenCalledTimes(2);
  tree.rerender(<SpotlightCoach {...props} visible={false} />);
  expect(tree.toJSON()).toBeNull();
});
it('dismisses by scrim and Android back, and has no count for one beat', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener');
  const dismiss = jest.fn();
  const tree = render(<SpotlightCoach visible steps={steps.slice(0, 1)} reducedMotion onReady={jest.fn()} onAdvance={jest.fn()} onDismiss={dismiss} />);
  await waitFor(() => expect(tree.getByTestId('spotlight-coach')).toBeTruthy());
  expect(tree.queryByText('1 of 1')).toBeNull();
  fireEvent.press(tree.getAllByLabelText('Dismiss tip')[0]);
  expect(dismiss).toHaveBeenCalledWith('scrim');
  const listener = back.mock.calls.find(([name]) => name === 'hardwareBackPress')![1];
  expect((listener as () => boolean)()).toBe(true);
  expect(dismiss).toHaveBeenCalledWith('back');
});
it('skips an unavailable target silently and adjusts the remaining step count', async () => {
  const ready = jest.fn();
  const skip = jest.fn();
  const tree = render(<SpotlightCoach visible steps={[{ ...steps[0], getRect: async () => null }, steps[1]]} reducedMotion onReady={ready} onSkip={skip} onAdvance={jest.fn()} onDismiss={jest.fn()} />);
  await waitFor(() => expect(ready).toHaveBeenCalledWith('home.progress'));
  expect(ready).not.toHaveBeenCalledWith('home.today');
  expect(skip).toHaveBeenCalledWith('home.today');
  expect(tree.queryByText('2 of 2')).toBeNull();
  expect(measureTeachingTarget).toHaveBeenCalled();
});

it('leaves the highlighted target touch-transparent and announces spoken units', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const tree = render(<SpotlightCoach visible steps={[{ ...steps[0], accessibilityLabel: 'Focus, 30 seconds.' }]} reducedMotion onReady={jest.fn()} onAdvance={jest.fn()} onDismiss={jest.fn()} />);
  await waitFor(() => expect(tree.getByTestId('spotlight-target-hole')).toBeTruthy());
  expect(tree.getByTestId('spotlight-target-hole').props.pointerEvents).toBe('none');
  expect(tree.getByTestId('spotlight-coach').props.pointerEvents).toBe('box-none');
  expect(announce).toHaveBeenCalledWith('Focus, 30 seconds.');
});

it('keeps Begin actionable while its spotlight is visible without dismissing as a scrim tap', async () => {
  const begin = jest.fn();
  const dismiss = jest.fn();
  const tree = render(<View>
    <Pressable accessibilityRole="button" accessibilityLabel="Begin practice" onPress={begin}><Text>Begin</Text></Pressable>
    <SpotlightCoach visible steps={steps.slice(0, 1)} reducedMotion onReady={jest.fn()} onAdvance={jest.fn()} onDismiss={dismiss} />
  </View>);
  await waitFor(() => expect(tree.getByTestId('spotlight-target-hole')).toBeTruthy());
  expect(tree.getByTestId('spotlight-target-hole').props.pointerEvents).toBe('none');
  fireEvent.press(tree.getByLabelText('Begin practice', { includeHiddenElements: true }));
  expect(begin).toHaveBeenCalledTimes(1);
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.press(tree.getAllByLabelText('Dismiss tip')[0]);
  expect(dismiss).toHaveBeenCalledWith('scrim');
  expect(begin).toHaveBeenCalledTimes(1);
});
