import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, BackHandler } from 'react-native';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { V2DeepFocusActiveScreen } from '../V2DeepFocusActiveScreen';
import { safeHaptics } from '@/utils/haptics';

const mockAmbient = { play: jest.fn(), pause: jest.fn(), stop: jest.fn(), setVolume: jest.fn() };
let mockPlaybackTime = 0;
const mockVoice = { play: jest.fn(), pause: jest.fn(), stop: jest.fn(), setVolume: jest.fn(), seekTo: jest.fn(), getCurrentTime: () => mockPlaybackTime };
const mockCreate = jest.fn((_asset, options) => options.loop ? mockAmbient : mockVoice);
jest.mock('@/hooks/useSessionAudio', () => ({ useSessionAudio: () => ({ createSessionAudioPlayer: mockCreate }) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { selection: jest.fn() } }));
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsEvents: {}, AnalyticsService: { track: jest.fn() } }));

describe('Deep Focus interaction and audio', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    mockPlaybackTime = 0;
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  });
  afterEach(() => jest.useRealTimers());
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
  const anchor = makeAnchor({ id: 'deep-anchor', intentionText: 'Stay with the work I choose.', category: 'career' });

  it('keeps the complete mix on its playback clock through cold buffering and mute', () => {
    const onComplete = jest.fn();
    render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="female" ambient onComplete={onComplete} />);
    advance(22_000);
    expect(onComplete).not.toHaveBeenCalled();
    mockPlaybackTime = 98;
    advance(120_000);
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Show Deep Focus controls'));
    mockVoice.pause.mockClear();
    fireEvent.press(screen.getByLabelText('Sound: On'));
    expect(mockVoice.setVolume).toHaveBeenCalledWith(0);
    expect(mockVoice.pause).not.toHaveBeenCalled();
    mockPlaybackTime = 120;
    advance(250);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('holds a failed guidance stream and retries before completing', () => {
    const onComplete = jest.fn();
    render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="female" ambient onComplete={onComplete} />);
    act(() => mockCreate.mock.calls[0][1].onFailure());
    advance(150_000);
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Retry guidance'), { stopPropagation: jest.fn() });
    advance(250);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    mockPlaybackTime = 120;
    advance(250);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('schedules the current modular cue while muted without replaying earlier narration on unmute', () => {
    render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="soothing" ambient onComplete={jest.fn()} />);
    advance(1_000);
    fireEvent.press(screen.getByLabelText('Show Deep Focus controls'));
    fireEvent.press(screen.getByLabelText('Sound: On'));
    advance(104_250);
    const cueCount = mockCreate.mock.calls.length;
    expect(mockCreate.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({ volume: 0 }));
    fireEvent.press(screen.getByLabelText('Show Deep Focus controls'));
    fireEvent.press(screen.getByLabelText('Sound: Off'));
    expect(mockCreate).toHaveBeenCalledTimes(cueCount);
    expect(mockVoice.setVolume).toHaveBeenLastCalledWith(0.443);
  });

  it('hides controls until requested, pauses and resolves one intentional exit', () => {
    const onComplete = jest.fn();
    const onExit = jest.fn();
    render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="none" ambient={false} onExit={onExit} onComplete={onComplete} />);
    expect(screen.queryByLabelText('End session')).toBeNull();
    advance(22000);
    fireEvent.press(screen.getByLabelText('Show Deep Focus controls'));
    expect(screen.getByTestId('deep-focus-remaining-time')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Pause Deep Focus'));
    expect(screen.getByTestId('deep-focus-paused-overlay')).toBeTruthy();
    advance(300000);
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('End session'));
    advance(1250);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('plays one full-length mix with its bed baked in, never layering a second ambient bed', () => {
    const view = render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={600} voice="female" ambient onComplete={jest.fn()} />);
    advance(15000);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1]).toEqual(expect.objectContaining({ volume: 1 }));
    expect(mockCreate.mock.calls[0][1].loop).toBeFalsy();
    expect(mockVoice.play).toHaveBeenCalled();
    advance(450000);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockAmbient.play).not.toHaveBeenCalled();
    expect(safeHaptics.selection).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mockVoice.stop).toHaveBeenCalled();
  });

  it('keeps the Deep Focus ambient bed when no guidance voice is chosen', () => {
    const view = render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={600} voice="none" ambient onComplete={jest.fn()} />);
    advance(15000);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1].loop).toBe(true);
    advance(65000);
    expect(mockAmbient.setVolume.mock.calls.at(-1)?.[0]).toBeCloseTo(0.07);
    view.unmount();
    expect(mockAmbient.stop).toHaveBeenCalled();
    const calls = mockAmbient.setVolume.mock.calls.length;
    advance(600000);
    expect(mockAmbient.setVolume).toHaveBeenCalledTimes(calls);
  });

  it('fades requested controls after inactivity and allows revealing them in release', () => {
    render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="none" ambient={false} onComplete={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Show Deep Focus controls'));
    advance(3750);
    expect(screen.queryByLabelText('End session')).toBeNull();
    advance(107000);
    fireEvent.press(screen.getByLabelText('Show Deep Focus controls'));
    expect(screen.getByLabelText('Pause Deep Focus')).toBeTruthy();
  });

  it.each(['A clear intention.', 'A longer personal intention. '.repeat(25)])('renders real intention content without replacing the Anchor: %s', intentionText => {
    render(<V2DeepFocusActiveScreen anchor={{ ...anchor, intentionText }} durationSeconds={120} voice="none" ambient={false} onComplete={jest.fn()} />);
    advance(20000);
    expect(screen.getByText(intentionText)).toBeTruthy();
    expect(screen.getByTestId('deep-focus-anchor-artwork')).toBeTruthy();
  });

  it('disables the iOS edge swipe while active and restores it on exit', () => {
    const navigationModule = require('@react-navigation/native');
    const setOptions = jest.fn();
    const spy = jest.spyOn(navigationModule, 'useNavigation').mockReturnValue({ setOptions });
    const view = render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="none" ambient={false} onComplete={jest.fn()} />);
    expect(setOptions).toHaveBeenCalledWith({ gestureEnabled: false });
    view.unmount();
    expect(setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    spy.mockRestore();
  });

  it('treats Android hardware Back as pause rather than an accidental exit', () => {
    const onComplete = jest.fn();
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    const view = render(<V2DeepFocusActiveScreen anchor={anchor} durationSeconds={120} voice="none" ambient={false} onComplete={onComplete} />);
    const calls = spy.mock.calls;
    const handler = calls.filter(([name]) => name === 'hardwareBackPress').at(-1)?.[1];
    if (!handler) throw new Error('Deep Focus did not register its hardware Back handler');
    act(() => { expect(handler({} as never)).toBe(true); });
    expect(screen.getByTestId('deep-focus-paused-overlay')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    view.unmount();
    spy.mockRestore();
  });

  it.each([1, 80])('keeps the shared artwork renderer with an SVG containing %i paths', count => {
    const baseSigilSvg = `<svg viewBox="0 0 200 200">${'<path d="M40 100L100 40L160 100L100 160Z" fill="none" stroke="black"/>'.repeat(count)}</svg>`;
    const view = render(<V2DeepFocusActiveScreen anchor={{ ...anchor, baseSigilSvg, reinforcedSigilSvg: undefined }} durationSeconds={120} voice="none" ambient={false} onComplete={jest.fn()} />);
    expect(screen.getByTestId('deep-focus-anchor-artwork')).toBeTruthy();
    view.unmount();
  });
});
