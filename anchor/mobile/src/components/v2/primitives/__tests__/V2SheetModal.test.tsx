import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { V2SheetModal } from '../V2SheetModal';

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
});
