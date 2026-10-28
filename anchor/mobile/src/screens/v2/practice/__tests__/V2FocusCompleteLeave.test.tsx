import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { V2FocusCompleteScreen } from '../focus/V2FocusCompleteScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { playCreationSound } from '@/services/CreationSounds';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { safeHaptics } from '@/utils/haptics';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { takePracticeDeparture } from '@/stores/v2/practiceDeparture';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({
  useCelebrationReduceMotion: jest.fn(() => false),
}));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(() => Promise.resolve()),
    selection: jest.fn(() => Promise.resolve()),
    notification: jest.fn(() => Promise.resolve()),
  },
}));

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
const opacityOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).opacity;

type Measurable = { measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void };
const viewProto = View.prototype as unknown as Measurable;
const textProto = Text.prototype as unknown as Measurable;
const originalView = viewProto.measureInWindow;
const originalText = textProto.measureInWindow;

const renderComplete = (props: Partial<React.ComponentProps<typeof V2FocusCompleteScreen>> = {}) => {
  const onDone = jest.fn();
  render(
    <V2FocusCompleteScreen
      anchor={makeAnchor({ id: 'a1', category: 'desire', threadStrength: 52 })}
      durationSeconds={30}
      beforeStrength={47}
      afterStrength={52}
      sessionId="session-1"
      onDone={onDone}
      onAgain={jest.fn()}
      {...props}
    />,
  );
  return onDone;
};

describe('V2FocusCompleteScreen: Complete to Home (leaving)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    takePracticeDeparture();
    useTeachingFlags(true);
    useSessionStore.setState({
      practiceHistory: [{ id: 'prior', completionStatus: 'completed' }] as never,
      totalSessionsCount: 3,
    });
  });

  afterEach(() => {
    viewProto.measureInWindow = originalView;
    textProto.measureInWindow = originalText;
    jest.useRealTimers();
  });

  function useTeachingFlags(seen: boolean) {
    useTeachingStore.setState((state) => ({ userFlags: { ...state.userFlags, hasSeenFirstPracticeScene: seen } }));
  }

  it('calls onDone once, as before, and offers what it knows for the hand-off', () => {
    const onDone = renderComplete();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith();

    const departure = takePracticeDeparture();
    expect(departure).not.toBeNull();
    expect(departure?.sessionId).toBe('session-1');
    expect(typeof departure?.at).toBe('number');
  });

  it('hands the heading and the buttons to the 300ms fade, and the buttons stop taking presses', () => {
    // Jest cannot observe a running animated style, so this pins the start state and the press lock;
    // the fade itself (linear, 300ms, old value 200ms) is device-checked.
    renderComplete();
    expect(opacityOf('focus-complete-heading')).toBe(1);
    expect(opacityOf('focus-complete-footer')).toBe(1);
    expect(screen.getByTestId('focus-complete-footer').props.pointerEvents).toBe('auto');
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(screen.getByTestId('focus-complete-footer').props.pointerEvents).toBe('none');
  });

  it('keeps the new value on screen while everything around it fades', () => {
    renderComplete();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    advance(400);
    expect(screen.getByTestId('focus-complete-new-value')).toBeTruthy();
    expect(screen.getByTestId('focus-complete-new-value').props.children).toEqual(['52', '%']);
  });

  it('plays no sound and no haptic for Continue', () => {
    renderComplete();
    (playCreationSound as jest.Mock).mockClear();
    (safeHaptics.impact as jest.Mock).mockClear();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    advance(500);
    expect(playCreationSound).not.toHaveBeenCalled();
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(safeHaptics.notification).not.toHaveBeenCalled();
    expect(safeHaptics.selection).not.toHaveBeenCalled();
  });

  it('under Reduce Motion does not fade and offers a departure that is simply not flown', () => {
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(true);
    const onDone = renderComplete();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    advance(400);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(opacityOf('focus-complete-heading')).toBe(1);
    expect(screen.getByTestId('focus-complete-footer').props.pointerEvents).toBe('auto');
  });

  it('offers nothing when the session was not saved', () => {
    const onDone = renderComplete({ sessionSaved: false });
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(takePracticeDeparture()).toBeNull();
  });

  it('measures the artwork as the mark square (not the circle) and the new value where it stands', async () => {
    viewProto.measureInWindow = (callback) => callback(100, 200, 150, 150);
    textProto.measureInWindow = (callback) => callback(60, 480, 44, 24);
    renderComplete();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    const departure = takePracticeDeparture()!;
    const measured = await departure.measure();
    expect(measured).not.toBeNull();
    // A drawn mark fills 70% of the dark circle, centred in it.
    expect(measured!.fromRect.width).toBeCloseTo(105);
    expect(measured!.fromRect.height).toBeCloseTo(105);
    expect(measured!.fromRect.x).toBeCloseTo(100 + (150 - 105) / 2);
    expect(measured!.fromRect.y).toBeCloseTo(200 + (150 - 105) / 2);
    expect(measured!.number).toEqual({ text: '52%', rect: { x: 60, y: 480, width: 44, height: 24 } });
    // The glow is 84% of the circle, expressed against the mark square.
    expect(measured!.glow?.scale).toBeCloseTo((150 * 0.84) / 105);
    expect(measured!.glow?.opacity).toBeGreaterThan(0);
  });

  it('measures a finished image as 72% of its circle, the share Home gives it', async () => {
    viewProto.measureInWindow = (callback) => callback(0, 0, 150, 150);
    textProto.measureInWindow = (callback) => callback(0, 0, 40, 20);
    renderComplete({ anchor: makeAnchor({ id: 'a1', category: 'desire', enhancedImageUrl: 'https://assets.test/a.png' }) });
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    const measured = await takePracticeDeparture()!.measure();
    expect(measured!.fromRect.width).toBeCloseTo(108);
  });

  it('resolves null, without throwing, when the screen cannot be measured', async () => {
    viewProto.measureInWindow = () => undefined; // never answers
    renderComplete();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    const pending = takePracticeDeparture()!.measure();
    advance(300);
    await expect(pending).resolves.toBeNull();
  });

  it('carries no figure when the value did not move', async () => {
    viewProto.measureInWindow = (callback) => callback(0, 0, 150, 150);
    textProto.measureInWindow = (callback) => callback(0, 0, 40, 20);
    renderComplete({ beforeStrength: 52, afterStrength: 52 });
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    const measured = await takePracticeDeparture()!.measure();
    expect(measured!.number).toBeNull();
    expect(measured!.fromRect.width).toBeGreaterThan(0);
  });
});
