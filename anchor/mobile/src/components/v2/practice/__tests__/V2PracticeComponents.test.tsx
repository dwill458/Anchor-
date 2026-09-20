import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { V2PracticeAnchorHeader } from '../V2PracticeAnchorHeader';
import { V2AnchorSwitcherSheet } from '../V2AnchorSwitcherSheet';
import { V2TodayPracticeCard } from '../V2TodayPracticeCard';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

jest.mock('expo-video', () => ({
  VideoView: (props: any) => {
    const { View } = require('react-native');
    return <View testID={props.testID ?? 'expo-video-view'} style={props.style} />;
  },
  useVideoPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    loop: true,
    muted: true,
  })),
}));

describe('V2PracticeAnchorHeader', () => {
  it('renders inline selector with intention, category, baseline status and ChevronDown affordance', () => {
    const onPress = jest.fn();
    const anchor = makeAnchor({
      id: 'a1',
      intentionText: 'Anchor has 10k users',
      category: 'desire',
      threadStrength: undefined,
    });

    render(<V2PracticeAnchorHeader anchor={anchor} onPress={onPress} />);

    expect(screen.getByText('Anchor has 10k users')).toBeTruthy();
    expect(screen.getByText('Desire')).toBeTruthy();
    expect(screen.getByText('Baseline not established')).toBeTruthy();

    const header = screen.getByTestId('v2-practice-anchor-header');
    expect(header).toBeTruthy();
    fireEvent.press(header);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders measured Thread Strength when thread presentation is available', () => {
    const anchor = makeAnchor({
      id: 'a2',
      intentionText: 'Lead engineering team',
      category: 'career',
      threadStrength: 74,
    });

    render(
      <V2PracticeAnchorHeader
        anchor={anchor}
        thread={{
          value: 74,
          category: 'career',
          unmeasured: false,
        }}
      />
    );

    expect(screen.getByText('Lead engineering team')).toBeTruthy();
    expect(screen.getByText('Career')).toBeTruthy();
    expect(screen.getByText(/Thread Strength/)).toBeTruthy();
    expect(screen.getByText('74%')).toBeTruthy();
  });
});

describe('V2AnchorSwitcherSheet', () => {
  const anchors = [
    makeAnchor({ id: 'a1', intentionText: 'Anchor has 10k users', category: 'desire', threadStrength: undefined }),
    makeAnchor({ id: 'a2', intentionText: 'Lead engineering team with pride', category: 'career', threadStrength: 74 }),
    makeAnchor({ id: 'a3', intentionText: 'Complete marathon in sub-4hr', category: 'health', threadStrength: 42 }),
  ];

  it('renders clean list rows with thin separators and restrained selected checkmark', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(
      <V2AnchorSwitcherSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Switch Anchor')).toBeTruthy();
    expect(screen.getByText('Select the Anchor to focus your practices on')).toBeTruthy();

    expect(screen.getByText('Anchor has 10k users')).toBeTruthy();
    expect(screen.getByText('Lead engineering team with pride')).toBeTruthy();
    expect(screen.getByText('Complete marathon in sub-4hr')).toBeTruthy();

    const item1 = screen.getByTestId('v2-anchor-switcher-item-a1');
    expect(item1.props.accessibilityState).toEqual({ selected: true });

    const item2 = screen.getByTestId('v2-anchor-switcher-item-a2');
    expect(item2.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(item2);
    expect(onSelect).toHaveBeenCalledWith('a2');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('V2TodayPracticeCard', () => {
  it('renders pre-practice hero with begin CTA, today badge, and duration', () => {
    const onPress = jest.fn();
    render(
      <V2TodayPracticeCard
        mode="focus"
        isCompletedToday={false}
        onPress={onPress}
      />
    );

    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('30 sec')).toBeTruthy();
    expect(screen.getByText('Build the thread today.')).toBeTruthy();
    expect(screen.getByText('Begin Focus')).toBeTruthy();

    fireEvent.press(screen.getByText('Begin Focus'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('transforms into settled completed hero state preserving artwork and concise copy', () => {
    const onPress = jest.fn();
    const onPracticeAgain = jest.fn();

    render(
      <V2TodayPracticeCard
        mode="focus"
        isCompletedToday={true}
        onPress={onPress}
        onPracticeAgain={onPracticeAgain}
      />
    );

    expect(screen.getByTestId('v2-practice-artwork-focus-featured')).toBeTruthy();
    expect(screen.getByText('TODAY COMPLETE ✓')).toBeTruthy();
    expect(screen.getByText('You reinforced your Anchor today.')).toBeTruthy();
    expect(screen.getByText('Your intention is holding strong.')).toBeTruthy();
    expect(screen.queryByText(/Settle into the rest of your day/i)).toBeNull();

    const practiceAgainBtn = screen.getByLabelText('Practice again');
    expect(practiceAgainBtn).toBeTruthy();
    fireEvent.press(practiceAgainBtn);
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
  });

  it.each(['deep_prime', 'visualize', 'release'] as const)(
    'retains corresponding hero artwork in completed state for %s',
    (mode) => {
      render(
        <V2TodayPracticeCard
          mode={mode}
          isCompletedToday={true}
          onPress={jest.fn()}
        />
      );
      expect(screen.getByTestId(`v2-practice-artwork-${mode}-featured`)).toBeTruthy();
      expect(screen.getByText('TODAY COMPLETE ✓')).toBeTruthy();
    }
  );
});
