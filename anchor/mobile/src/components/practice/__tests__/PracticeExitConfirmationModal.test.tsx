import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PracticeExitConfirmationModal,
  type PracticeExitMode,
} from '../PracticeExitConfirmationModal';
import { colors } from '@/theme';

describe('PracticeExitConfirmationModal', () => {
  it('renders default generic modal with canonical buttons and copy', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();

    const { getByText, getByTestId } = render(
      <PracticeExitConfirmationModal
        visible={true}
        onPrimary={onPrimary}
        onSecondary={onSecondary}
      />
    );

    const titleNode = getByText('Exit Practice?');
    expect(titleNode).toBeTruthy();
    expect(titleNode.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.gold }),
      ])
    );
    expect(getByText('You will need to start over if you leave now.')).toBeTruthy();
    expect(getByText('Keep Practicing')).toBeTruthy();
    expect(getByText('Exit')).toBeTruthy();

    fireEvent.press(getByTestId('confirm-modal-primary-btn'));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('confirm-modal-secondary-btn'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['focus', 'Exit Focus?', colors.practiceMode.focus.primary],
    ['deep_prime', 'Exit Deep Prime?', colors.bronze],
    ['deepPrime', 'Exit Deep Prime?', colors.bronze],
    ['visualize', 'Exit Visualize?', colors.practiceMode.visualize.primary],
    ['release', 'Exit Burn & Release?', colors.practiceMode.release.primary],
    ['generic', 'Exit Practice?', colors.gold],
  ] as const)(
    'renders correct title and color for mode %s',
    (mode: PracticeExitMode | string, expectedTitle: string, expectedColor: string) => {
      const { getByText } = render(
        <PracticeExitConfirmationModal
          visible={true}
          mode={mode}
          onPrimary={jest.fn()}
          onSecondary={jest.fn()}
        />
      );

      const titleNode = getByText(expectedTitle);
      expect(titleNode).toBeTruthy();
      expect(titleNode.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: expectedColor }),
        ])
      );
    }
  );

  it('allows custom overrides for title, body, and button labels', () => {
    const { getByText } = render(
      <PracticeExitConfirmationModal
        visible={true}
        mode="release"
        title="Cancel Burn & Release?"
        titleColor="#FF5500"
        body="Cancelling will stop the burn. Your anchor will not be released."
        primaryCtaLabel="Continue Practice"
        secondaryCtaLabel="Cancel"
        onPrimary={jest.fn()}
        onSecondary={jest.fn()}
      />
    );

    const titleNode = getByText('Cancel Burn & Release?');
    expect(titleNode).toBeTruthy();
    expect(titleNode.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#FF5500' }),
      ])
    );
    expect(
      getByText('Cancelling will stop the burn. Your anchor will not be released.')
    ).toBeTruthy();
    expect(getByText('Continue Practice')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('handles backdrop dismissal by invoking onBackdropPress or onPrimary', () => {
    const onPrimary = jest.fn();
    const onBackdropPress = jest.fn();

    const { getByTestId, rerender } = render(
      <PracticeExitConfirmationModal
        visible={true}
        onPrimary={onPrimary}
        onSecondary={jest.fn()}
        onBackdropPress={onBackdropPress}
      />
    );

    fireEvent.press(getByTestId('confirm-modal-backdrop', { includeHiddenElements: true }));
    expect(onBackdropPress).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();

    // When onBackdropPress is not provided, defaults to onPrimary
    rerender(
      <PracticeExitConfirmationModal
        visible={true}
        onPrimary={onPrimary}
        onSecondary={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('confirm-modal-backdrop', { includeHiddenElements: true }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});
