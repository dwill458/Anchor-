import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2ActionSheet } from '../V2ActionSheet';

describe('V2ActionSheet', () => {
  it('renders actions and triggers selection', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    const actions = [
      { key: 'primary', label: 'Make primary' },
      { key: 'regenerate', label: 'Regenerate image' },
      { key: 'remove', label: 'Remove', destructive: true },
    ];

    const { getByText, getByTestId } = render(
      <V2ActionSheet
        visible={true}
        onClose={onClose}
        title="Vision Image"
        subtitle="Manage your image"
        actions={actions}
        onSelect={onSelect}
        testID="action-sheet"
      />
    );

    expect(getByText('Vision Image')).toBeTruthy();
    expect(getByText('Manage your image')).toBeTruthy();
    expect(getByText('Make primary')).toBeTruthy();
    expect(getByText('Regenerate image')).toBeTruthy();
    expect(getByText('Remove')).toBeTruthy();

    fireEvent.press(getByTestId('action-sheet-item-primary'));
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('primary');

    fireEvent.press(getByTestId('action-sheet-cancel'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
