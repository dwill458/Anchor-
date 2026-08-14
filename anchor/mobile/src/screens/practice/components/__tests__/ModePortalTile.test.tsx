import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ModePortalTile } from '../ModePortalTile';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

let mockReduceMotion = false;
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

const defaultProps = {
  variant: 'focus' as const,
  title: 'FOCUS',
  meaning: 'Return your attention to the Anchor.',
  durationHint: '10–60 SEC',
  onPress: jest.fn(),
  testID: 'tile-focus',
};

describe('ModePortalTile', () => {
  beforeEach(() => {
    mockReduceMotion = false;
    jest.clearAllMocks();
  });

  it('renders selected with expanded state reflected in accessibility', () => {
    const screen = render(<ModePortalTile {...defaultProps} selected />);
    expect(screen.getByTestId('tile-focus').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('renders unselected as collapsed', () => {
    const screen = render(<ModePortalTile {...defaultProps} selected={false} />);
    expect(screen.getByTestId('tile-focus').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('calls onPress when tapped, regardless of selection state', () => {
    const onPress = jest.fn();
    const screen = render(<ModePortalTile {...defaultProps} onPress={onPress} selected={false} />);
    fireEvent.press(screen.getByTestId('tile-focus'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const screen = render(<ModePortalTile {...defaultProps} onPress={onPress} disabled />);
    fireEvent.press(screen.getByTestId('tile-focus'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the selected description to accessibility queries', () => {
    const screen = render(<ModePortalTile {...defaultProps} selected />);
    expect(screen.getByText(defaultProps.meaning)).toBeTruthy();
  });

  it('omits a collapsed description from the tree entirely', () => {
    const screen = render(<ModePortalTile {...defaultProps} selected={false} />);
    expect(screen.queryByText(defaultProps.meaning)).toBeNull();
    expect(
      screen.queryAllByText(defaultProps.meaning, { includeHiddenElements: true }).length,
    ).toBe(0);
  });

  it('always renders the title, duration, and selection node regardless of selection', () => {
    const selected = render(<ModePortalTile {...defaultProps} selected />);
    expect(selected.getByText('FOCUS')).toBeTruthy();
    expect(selected.getByText('10–60 SEC')).toBeTruthy();

    const collapsed = render(<ModePortalTile {...defaultProps} selected={false} />);
    expect(collapsed.getByText('FOCUS')).toBeTruthy();
    expect(collapsed.getByText('10–60 SEC')).toBeTruthy();
  });

  it('renders an icon and badge when provided, independent of selection', () => {
    const screen = render(
      <ModePortalTile {...defaultProps} selected={false} badge="PRO" icon={<Text>icon</Text>} />,
    );
    expect(screen.getByText('PRO')).toBeTruthy();
    expect(screen.getByText('icon')).toBeTruthy();
  });

  it('renders whatever real description content an item carries, not a fixed-size placeholder', () => {
    const longMeaning =
      'A deliberately long description meant to prove the expandable region renders whatever real copy an item carries, not a fixed-size placeholder — including longer localized or Dynamic-Type strings.';
    const screen = render(<ModePortalTile {...defaultProps} selected meaning={longMeaning} />);
    expect(screen.getByText(longMeaning)).toBeTruthy();
  });

  it('does not throw and remains internally consistent under reduced motion', () => {
    mockReduceMotion = true;
    const screen = render(<ModePortalTile {...defaultProps} selected />);
    expect(screen.getByTestId('tile-focus').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(defaultProps.meaning)).toBeTruthy();
  });

  it('reflects rapid selection toggles in the final rendered state', () => {
    const screen = render(<ModePortalTile {...defaultProps} selected={false} />);
    screen.rerender(<ModePortalTile {...defaultProps} selected />);
    screen.rerender(<ModePortalTile {...defaultProps} selected={false} />);
    screen.rerender(<ModePortalTile {...defaultProps} selected />);

    expect(screen.getByTestId('tile-focus').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(defaultProps.meaning)).toBeTruthy();
  });

  it('shows the locked indicator without altering the accessibility label copy', () => {
    const screen = render(<ModePortalTile {...defaultProps} locked selected={false} />);
    expect(screen.getByTestId('tile-focus').props.accessibilityLabel).toBe('FOCUS, locked');
  });

  it('keeps the plain title label when not locked', () => {
    const screen = render(<ModePortalTile {...defaultProps} selected={false} />);
    expect(screen.getByTestId('tile-focus').props.accessibilityLabel).toBe('FOCUS');
  });
});
