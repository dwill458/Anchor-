import React from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SealMedallion } from '../SealMedallion';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useSettingsStore } from '@/stores/settingsStore';
import { createAudioPlayer } from 'expo-audio';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
const mockSoundStop = jest.fn();
const mockPlayCreationSound = jest.fn((_key: string) => ({ stop: mockSoundStop }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (key: string) => mockPlayCreationSound(key) }));
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
it('plays one non-looping Seal rise and stops it when the finger lifts', async () => {
  const { screen } = setup(); await act(async () => {});
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  expect(mockPlayCreationSound).toHaveBeenCalledTimes(1);
  expect(mockPlayCreationSound).toHaveBeenCalledWith('sealRise');
  fireEvent(screen.getByTestId('seal-hold'), 'pressOut');
  expect(mockSoundStop).toHaveBeenCalledTimes(1);
});
it.each([true, false])('holds for 1.2 seconds in reduced-motion=%s and invokes keep once', async (reduceMotion) => {
  const { props, screen } = setup(reduceMotion);
  await act(async () => {});
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(1199));
  expect(props.onCommitted).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(17));
  expect(props.onCommitted).toHaveBeenCalledTimes(1);
  fireEvent(screen.getByTestId('seal-hold'), 'pressOut');
  act(() => jest.advanceTimersByTime(600));
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
it('uses hold in full motion without showing any trace interaction or hint', async () => {
  const { props, screen } = setup(false); await act(async () => {});
  expect(screen.getByText('Hold to seal.')).toBeTruthy();
  expect(screen.queryByTestId('seal-trace')).toBeNull();
  expect(screen.queryByText('Trace to seal.')).toBeNull();
  fireEvent(screen.getByTestId('seal-hold'), 'pressIn');
  act(() => jest.advanceTimersByTime(4000));
  expect(props.onKeep).toHaveBeenCalledTimes(1);
});
