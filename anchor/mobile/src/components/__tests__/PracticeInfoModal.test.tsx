import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PracticeInfoModal } from '../PracticeInfoModal';

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    selection: jest.fn(),
    impact: jest.fn(),
  },
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

describe('PracticeInfoModal', () => {
  const onDismissMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four practice modes with outcomes and metadata when visible', () => {
    const { getByText } = render(
      <PracticeInfoModal isVisible={true} onDismiss={onDismissMock} />
    );

    expect(getByText('CHOOSE WHAT YOU NEED')).toBeTruthy();
    expect(
      getByText('Each practice strengthens your anchor differently.')
    ).toBeTruthy();

    expect(getByText('DEEP PRIME')).toBeTruthy();
    expect(getByText('Stay with it longer.')).toBeTruthy();
    expect(getByText('2–10 min · Build sustained attention')).toBeTruthy();

    expect(getByText('VISUALIZE')).toBeTruthy();
    expect(getByText('See the outcome before it happens.')).toBeTruthy();
    expect(getByText('1–5 min · Mental rehearsal')).toBeTruthy();

    expect(getByText('FOCUS SESSION')).toBeTruthy();
    expect(getByText('Come back to what matters.')).toBeTruthy();
    expect(getByText('10–60 sec · Quick reset')).toBeTruthy();

    expect(getByText('RELEASE')).toBeTruthy();
    expect(getByText('Close the loop.')).toBeTruthy();
    expect(getByText('Completed intentions · Let go')).toBeTruthy();

    expect(getByText('Got It')).toBeTruthy();
  });

  it('does not render when isVisible is false', () => {
    const { queryByText } = render(
      <PracticeInfoModal isVisible={false} onDismiss={onDismissMock} />
    );

    expect(queryByText('CHOOSE WHAT YOU NEED')).toBeNull();
  });

  it('expands progressive teaching on tap and reveals explanatory sentence', () => {
    const { getByText, queryByText } = render(
      <PracticeInfoModal isVisible={true} onDismiss={onDismissMock} />
    );

    expect(
      queryByText(
        'Stay with your anchor long enough for the intention to settle and compound.'
      )
    ).toBeNull();

    fireEvent.press(getByText('DEEP PRIME'));

    expect(
      getByText(
        'Stay with your anchor long enough for the intention to settle and compound.'
      )
    ).toBeTruthy();
  });

  it('allows only one mode to be expanded at a time (accordion behavior)', () => {
    const { getByText, queryByText } = render(
      <PracticeInfoModal isVisible={true} onDismiss={onDismissMock} />
    );

    // Expand Deep Prime
    fireEvent.press(getByText('DEEP PRIME'));
    expect(
      getByText(
        'Stay with your anchor long enough for the intention to settle and compound.'
      )
    ).toBeTruthy();

    // Expand Visualize -> Deep Prime should collapse
    fireEvent.press(getByText('VISUALIZE'));
    expect(
      getByText(
        'Picture a specific future moment where the intention is already real.'
      )
    ).toBeTruthy();
    expect(
      queryByText(
        'Stay with your anchor long enough for the intention to settle and compound.'
      )
    ).toBeNull();

    // Expand Focus Session -> Visualize collapses
    fireEvent.press(getByText('FOCUS SESSION'));
    expect(
      getByText(
        'Use a short session to return quickly to the anchor and the next step.'
      )
    ).toBeTruthy();
    expect(
      queryByText(
        'Picture a specific future moment where the intention is already real.'
      )
    ).toBeNull();

    // Expand Release -> Focus collapses
    fireEvent.press(getByText('RELEASE'));
    expect(
      getByText(
        'Let go when an intention has completed its work while preserving its history.'
      )
    ).toBeTruthy();
    expect(
      queryByText(
        'Use a short session to return quickly to the anchor and the next step.'
      )
    ).toBeNull();
  });

  it('collapses an expanded row when tapped again', () => {
    const { getByText, queryByText } = render(
      <PracticeInfoModal isVisible={true} onDismiss={onDismissMock} />
    );

    fireEvent.press(getByText('DEEP PRIME'));
    expect(
      getByText(
        'Stay with your anchor long enough for the intention to settle and compound.'
      )
    ).toBeTruthy();

    fireEvent.press(getByText('DEEP PRIME'));
    expect(
      queryByText(
        'Stay with your anchor long enough for the intention to settle and compound.'
      )
    ).toBeNull();
  });

  it('calls onDismiss when Got It button is pressed', () => {
    const { getByText } = render(
      <PracticeInfoModal isVisible={true} onDismiss={onDismissMock} />
    );

    fireEvent.press(getByText('Got It'));
    expect(onDismissMock).toHaveBeenCalledTimes(1);
  });
});
