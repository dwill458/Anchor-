import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { withSpring } from 'react-native-reanimated';
import { V2SheetGrabZone, V2SheetModal } from '../V2SheetModal';

const mockWithSpring = jest.mocked(withSpring);

function Host() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Pressable accessibilityLabel="toggle" onPress={() => setOpen((v) => !v)}><Text>toggle</Text></Pressable>
      <V2SheetModal visible={open} onClose={() => setOpen(false)} scrimAccessibilityLabel="Close sheet" testID="sheet">
        <Text>Sheet body</Text>
      </V2SheetModal>
    </>
  );
}

describe('V2SheetModal', () => {
  it('includes keyboard clearance in the measured root so the lifted sheet remains inside its touch bounds', () => {
    const view = render(<V2SheetModal visible onClose={jest.fn()} bottomInset={280} testID="keyboard-sheet"><Text>Typing</Text></V2SheetModal>);
    expect(StyleSheet.flatten(view.getByTestId('keyboard-sheet-layout').props.style).paddingBottom).toBe(280);
  });
  it('renders its content while visible', () => {
    render(<Host />);
    expect(screen.getByText('Sheet body')).toBeTruthy();
  });

  it('unmounts after closing even when the exit animation never reports completion', async () => {
    render(<Host />);
    fireEvent.press(screen.getByLabelText('Close sheet'));
    await waitFor(() => expect(screen.queryByText('Sheet body')).toBeNull(), { timeout: 5000 });
  });

  it('stays open when reopened before the exit finishes', async () => {
    render(<Host />);
    fireEvent.press(screen.getByLabelText('Close sheet'));
    fireEvent.press(screen.getByLabelText('toggle'));
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(screen.getByText('Sheet body')).toBeTruthy();
  });

  it('keeps the existing immediate drag-dismiss behavior as the default', () => {
    const onClose = jest.fn();
    render(<V2SheetModal visible onClose={onClose}><V2SheetGrabZone><Text>Legacy drag body</Text></V2SheetGrabZone></V2SheetModal>);
    const pan = screen.UNSAFE_getAllByType(GestureDetector)[0].props.gesture.handlers;
    mockWithSpring.mockClear();

    act(() => pan.onEnd({ translationY: 200, velocityY: 0 }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockWithSpring).toHaveBeenCalledWith(48, expect.objectContaining({ overshootClamping: true }), expect.any(Function));
  });

  it('requests a guarded drag close and snaps back while the controlled sheet stays visible', () => {
    const onClose = jest.fn();
    render(
      <V2SheetModal visible onClose={onClose} deferDragDismiss testID="guarded-sheet">
        <V2SheetGrabZone><Text>Guarded sheet body</Text></V2SheetGrabZone>
      </V2SheetModal>,
    );
    const pan = screen.UNSAFE_getAllByType(GestureDetector)[0].props.gesture.handlers;

    mockWithSpring.mockClear();
    act(() => pan.onEnd({ translationY: 200, velocityY: 0 }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockWithSpring).toHaveBeenCalledWith(0, expect.objectContaining({ velocity: 0 }));
    expect(screen.getByText('Guarded sheet body')).toBeTruthy();
  });

  it('uses the controlled visibility change for the deferred drag exit', async () => {
    function ControlledHost() {
      const [open, setOpen] = useState(true);
      return <V2SheetModal visible={open} onClose={() => setOpen(false)} deferDragDismiss><V2SheetGrabZone><Text>Controlled body</Text></V2SheetGrabZone></V2SheetModal>;
    }
    render(<ControlledHost />);
    const pan = screen.UNSAFE_getAllByType(GestureDetector)[0].props.gesture.handlers;
    act(() => pan.onEnd({ translationY: 200, velocityY: 0 }));
    await waitFor(() => expect(screen.queryByText('Controlled body')).toBeNull(), { timeout: 5000 });
  });
});
