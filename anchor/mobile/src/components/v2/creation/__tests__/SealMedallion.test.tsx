import React from 'react';
import { AccessibilityInfo, PanResponder, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SealMedallion } from '../SealMedallion';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useSettingsStore } from '@/stores/settingsStore';
import { createAudioPlayer } from 'expo-audio';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
const points = [{ x: 10, y: 10 }, { x: 90, y: 10 }];
function setup(reduceMotion = true) {
  const props = { points, size: 200, active: true, disabled: false, reduceMotion,
    onKeep: jest.fn(), onInteraction: jest.fn(), onCommitted: jest.fn(), onMeasure: jest.fn() };
  return { props, screen: render(<SealMedallion {...props}><View /></SealMedallion>) };
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  useSettingsStore.setState({ soundEffectsEnabled: true });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
it('holds for 1.2 seconds, shows provenance, and invokes keep once after its beat', async () => {
  const { props, screen } = setup();
  await act(async () => {});
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(1199));
  expect(props.onCommitted).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(17));
  expect(props.onCommitted).toHaveBeenCalledTimes(1);
  fireEvent(screen.getByTestId('seal-hold'), 'pressOut');
  act(() => jest.advanceTimersByTime(230));
  expect(screen.getByTestId('seal-provenance').props.children).toMatch(/^Anchor No\. \d+ · Forged /);
  expect(props.onKeep).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(2000));
  expect(props.onKeep).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(5000));
  expect(props.onKeep).toHaveBeenCalledTimes(1);
  expect(AnalyticsService.track).toHaveBeenCalledWith('anchor_seal_completed');
});
it('releases early without saving and can retry the hold', async () => {
  const { props, screen } = setup(); await act(async () => {});
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(500));
  fireEvent(screen.getByTestId('seal-hold'), 'pressOut');
  act(() => jest.advanceTimersByTime(600));
  expect(props.onKeep).not.toHaveBeenCalled();
  expect(props.onInteraction).toHaveBeenLastCalledWith(false);
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(4000));
  expect(props.onKeep).toHaveBeenCalledTimes(1);
});
it('reports abandonment and cancels pending work on unmount', async () => {
  const { props, screen } = setup(); await act(async () => {});
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(300));
  screen.unmount(); act(() => jest.advanceTimersByTime(5000));
  expect(props.onKeep).not.toHaveBeenCalled();
  expect(AnalyticsService.track).toHaveBeenCalledWith('anchor_seal_abandoned');
});
it('stays silent with sound disabled while completion still works', async () => {
  useSettingsStore.setState({ soundEffectsEnabled: false });
  const { props, screen } = setup(); await act(async () => {});
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(4000));
  expect(createAudioPlayer).not.toHaveBeenCalled(); expect(props.onKeep).toHaveBeenCalledTimes(1);
});
it('uses the hold for a screen reader even with full motion', async () => {
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
  const { screen } = setup(false); await act(async () => {});
  expect(screen.getByTestId('seal-hold')).toBeTruthy();
  expect(screen.queryByTestId('seal-trace')).toBeNull();
});
it('traces the ordered guide and calls keep exactly once', async () => {
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => ({ panHandlers: {
    onResponderGrant: config.onPanResponderGrant, onResponderMove: config.onPanResponderMove, onResponderRelease: config.onPanResponderRelease,
  } }) as ReturnType<typeof PanResponder.create>);
  const { props, screen } = setup(false); await act(async () => {});
  const guide = screen.getByTestId('seal-trace');
  const event = (x: number) => ({ nativeEvent: { locationX: x, locationY: 42.4 } });
  fireEvent(guide, 'responderGrant', event(42.4));
  for (const x of [80, 120, 157.6]) fireEvent(guide, 'responderMove', event(x));
  expect(props.onCommitted).toHaveBeenCalledTimes(1);
  fireEvent(guide, 'responderMove', event(157.6));
  fireEvent(guide, 'responderRelease', event(157.6));
  act(() => jest.advanceTimersByTime(3000));
  expect(props.onKeep).toHaveBeenCalledTimes(1);
  expect(AnalyticsService.track).toHaveBeenCalledWith('anchor_seal_started');
});
it('decays an unfinished trace and releases its interaction lock', async () => {
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => ({ panHandlers: {
    onResponderGrant: config.onPanResponderGrant, onResponderMove: config.onPanResponderMove, onResponderRelease: config.onPanResponderRelease,
  } }) as ReturnType<typeof PanResponder.create>);
  const { props, screen } = setup(false); await act(async () => {});
  const guide = screen.getByTestId('seal-trace');
  fireEvent(guide, 'responderGrant', { nativeEvent: { locationX: 42.4, locationY: 42.4 } });
  fireEvent(guide, 'responderMove', { nativeEvent: { locationX: 80, locationY: 42.4 } });
  fireEvent(guide, 'responderRelease', {});
  act(() => jest.advanceTimersByTime(399));
  expect(props.onInteraction).toHaveBeenLastCalledWith(true);
  act(() => jest.advanceTimersByTime(1));
  expect(props.onInteraction).toHaveBeenLastCalledWith(false);
  expect(props.onKeep).not.toHaveBeenCalled();
});
