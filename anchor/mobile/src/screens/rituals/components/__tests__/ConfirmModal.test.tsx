import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ConfirmModal } from '../ConfirmModal';

describe('ConfirmModal (2.0)', () => {
  const defaultProps = {
    visible: true,
    title: 'Exit Focus Session?',
    body: 'You will need to start over if you leave now.',
    primaryCtaLabel: 'Keep Practicing',
    secondaryCtaLabel: 'Exit',
    onPrimary: jest.fn(),
    onSecondary: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, body, and action buttons in 2.0 design language', () => {
    const { getByText, getByTestId } = render(<ConfirmModal {...defaultProps} />);

    expect(getByTestId('confirm-modal-sheet')).toBeTruthy();
    expect(getByText('Exit Focus Session?')).toBeTruthy();
    expect(getByText('You will need to start over if you leave now.')).toBeTruthy();
    expect(getByText('Keep Practicing')).toBeTruthy();
    expect(getByText('Exit')).toBeTruthy();
  });

  it('calls onPrimary when Keep Practicing is pressed', () => {
    const { getByTestId } = render(<ConfirmModal {...defaultProps} />);

    fireEvent.press(getByTestId('confirm-modal-primary'));
    expect(defaultProps.onPrimary).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSecondary).not.toHaveBeenCalled();
  });

  it('calls onSecondary when Exit is pressed', () => {
    const { getByTestId } = render(<ConfirmModal {...defaultProps} />);

    fireEvent.press(getByTestId('confirm-modal-secondary'));
    expect(defaultProps.onSecondary).toHaveBeenCalledTimes(1);
    expect(defaultProps.onPrimary).not.toHaveBeenCalled();
  });
});
