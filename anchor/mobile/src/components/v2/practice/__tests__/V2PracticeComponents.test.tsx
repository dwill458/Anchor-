import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { getPracticeCardTheme } from '@/theme/v2';
import { V2PracticeAnchorHeader } from '../V2PracticeAnchorHeader';
import { V2AnchorSwitcherSheet, orderAnchorsForSwitcher } from '../V2AnchorSwitcherSheet';
import { V2TodayPracticeCard } from '../V2TodayPracticeCard';
import { V2PracticeGrid } from '../V2PracticeGrid';
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
    expect(screen.queryByText(/Thread Strength/)).toBeNull();
    expect(screen.getByTestId('v2-practice-thread-strength')).toBeTruthy();
  });

  it('labels the selector with an ACTIVE ANCHOR eyebrow rather than a card chrome', () => {
    render(<V2PracticeAnchorHeader anchor={makeAnchor({ id: 'a3' })} onPress={jest.fn()} />);

    expect(screen.getByText('ACTIVE ANCHOR')).toBeTruthy();
  });

  it('clamps a long intention to two lines with a tail ellipsis', () => {
    const longIntention =
      'Build a calm, deliberate morning practice that I return to every single day without fail';
    render(
      <V2PracticeAnchorHeader
        anchor={makeAnchor({ id: 'a4', intentionText: longIntention })}
        onPress={jest.fn()}
      />
    );

    const intention = screen.getByText(longIntention);
    expect(intention.props.numberOfLines).toBe(2);
    expect(intention.props.ellipsizeMode).toBe('tail');
  });

  it('keeps the whole selector tappable, not just the chevron', () => {
    const onPress = jest.fn();
    render(<V2PracticeAnchorHeader anchor={makeAnchor({ id: 'a5' })} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('v2-practice-anchor-header'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('V2PracticeGrid', () => {
  const capabilities = { focus: true, deep_prime: true, visualize: true, release: true };

  it.each([
    ['focus', ['deep_prime', 'visualize'], 'release'],
    ['deep_prime', ['focus', 'visualize'], 'release'],
    ['visualize', ['focus', 'deep_prime'], 'release'],
    ['release', ['focus', 'deep_prime'], 'visualize'],
  ] as const)('excludes %s hero and keeps two tiles plus the correct slim row', (heroMode, tiles, slimMode) => {
    const onSelectMode = jest.fn();
    render(<V2PracticeGrid capabilities={capabilities} heroMode={heroMode} onSelectMode={onSelectMode} />);

    expect(screen.queryByTestId(`v2-practice-row-${heroMode}`)).toBeNull();
    tiles.forEach((mode) => expect(screen.getByTestId(`v2-practice-row-${mode}`)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`v2-practice-row-${slimMode}`));
    expect(onSelectMode).toHaveBeenCalledWith(slimMode);
  });

  it('renders all 3 tile modes plus slim release row when heroMode is null (today failed to load)', () => {
    const onSelectMode = jest.fn();
    render(<V2PracticeGrid capabilities={capabilities} heroMode={null} onSelectMode={onSelectMode} />);

    expect(screen.getByTestId('v2-practice-row-focus')).toBeTruthy();
    expect(screen.getByTestId('v2-practice-row-deep_prime')).toBeTruthy();
    expect(screen.getByTestId('v2-practice-row-visualize')).toBeTruthy();
    expect(screen.getByTestId('v2-practice-row-release')).toBeTruthy();
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

  it('does not repeat "Thread Strength" on rows and shows the compact line with a percentage', () => {
    render(
      <V2AnchorSwitcherSheet visible anchors={anchors} selectedAnchorId="a1" onSelect={jest.fn()} onClose={jest.fn()} />
    );

    expect(screen.queryByText(/Thread Strength/)).toBeNull();
    expect(screen.getByText('74%')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
    // No baseline yet: no line, the existing status copy instead.
    expect(screen.getByText('Baseline not established')).toBeTruthy();
  });

  it('pins the active Anchor first, then orders by most recently practiced', () => {
    expect(
      orderAnchorsForSwitcher(anchors, 'a3', { a1: 100, a2: 900 }).map((a) => a.id)
    ).toEqual(['a3', 'a2', 'a1']);
  });

  it('keeps incoming order for Anchors with no practice history', () => {
    expect(orderAnchorsForSwitcher(anchors, 'a2').map((a) => a.id)).toEqual(['a2', 'a1', 'a3']);
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
    expect(screen.getByText('Build consistency today.')).toBeTruthy();
    expect(screen.getByText('Begin Focus')).toBeTruthy();

    fireEvent.press(screen.getByText('Begin Focus'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the completed-arc Release copy and omits its duration pill', () => {
    render(<V2TodayPracticeCard mode="release" isCompletedToday={false} onPress={jest.fn()} />);

    expect(screen.getByText('This intention is complete.')).toBeTruthy();
    expect(screen.getByText('Close it with intention.')).toBeTruthy();
    expect(screen.getByText('Begin Release')).toBeTruthy();
    expect(screen.queryByText('When ready')).toBeNull();
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
    expect(screen.getByText('TODAY COMPLETE')).toBeTruthy();
    expect(screen.getByText('You reinforced your Anchor today.')).toBeTruthy();
    expect(screen.getByText('Your intention is holding strong.')).toBeTruthy();
    expect(screen.queryByText(/Settle into the rest of your day/i)).toBeNull();

    const practiceAgainBtn = screen.getByLabelText('Practice again');
    expect(practiceAgainBtn).toBeTruthy();
    fireEvent.press(practiceAgainBtn);
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['focus', 'Focus', 'Begin Focus'],
    ['deep_prime', 'Deep Focus', 'Begin Deep Focus'],
    ['visualize', 'Visualize', 'Begin Visualize'],
    ['release', 'Release', 'Begin Release'],
  ] as const)(
    'inherits the %s identity — label, artwork and CTA — rather than hard-coding Focus',
    (mode, label, cta) => {
      render(<V2TodayPracticeCard mode={mode} isCompletedToday={false} onPress={jest.fn()} />);

      expect(screen.getByTestId(`v2-practice-artwork-${mode}-featured`)).toBeTruthy();
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText(cta)).toBeTruthy();
      expect(screen.getByText('TODAY')).toBeTruthy();
    }
  );

  it.each(['focus', 'deep_prime', 'visualize', 'release'] as const)(
    'renders %s on the warm cream split surface',
    (mode) => {
      render(<V2TodayPracticeCard mode={mode} isCompletedToday={false} onPress={jest.fn()} />);

      const card = screen.getByTestId('v2-recommended-today');
      const flat = StyleSheet.flatten(card.props.style) as { backgroundColor?: string };
      expect(flat.backgroundColor).toBe('#F4EFE6');
    }
  );

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
      expect(screen.getByText('TODAY COMPLETE')).toBeTruthy();
    }
  );
});
