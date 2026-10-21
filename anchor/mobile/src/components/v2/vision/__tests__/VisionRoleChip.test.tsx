import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { VisionRoleChip } from '../VisionRoleChip';

jest.mock('../VisionChoiceSheet', () => ({
  VisionChoiceSheet: (props: { visible: boolean; actions: Array<{ key: string; label: string }>; onChoose: (key: string) => void; testID: string }) => {
    const React = require('react');
    const { Pressable: MockPressable, Text: MockText, View: MockView } = require('react-native');
    return props.visible ? React.createElement(MockView, { testID: props.testID }, props.actions.map(action => React.createElement(
      MockPressable,
      { key: action.key, accessibilityRole: 'button', accessibilityLabel: action.label, onPress: () => props.onChoose(action.key) },
      React.createElement(MockText, null, action.label),
    ))) : null;
  },
}));

describe('VisionRoleChip', () => {
  it('opens a chooser for Person, Place, Object, and Inspiration', () => {
    const onChange = jest.fn();
    const view = render(<VisionRoleChip role="inspiration" onChange={onChange} />);

    fireEvent.press(view.getByLabelText('Inspiration reference role'));
    expect(view.getByLabelText('Person')).toBeTruthy();
    expect(view.getByLabelText('Place')).toBeTruthy();
    expect(view.getByLabelText('Object')).toBeTruthy();
    expect(view.getByLabelText('Inspiration')).toBeTruthy();
  });

  it('sends the selected role and exposes an accessible touch target', () => {
    const onChange = jest.fn();
    const view = render(<VisionRoleChip role="place" onChange={onChange} testID="role" />);
    const chip = view.getByTestId('role');

    const targetHeight = StyleSheet.flatten(chip.props.style).minHeight + chip.props.hitSlop.top + chip.props.hitSlop.bottom;
    expect(targetHeight).toBeGreaterThanOrEqual(44);
    fireEvent.press(chip);
    fireEvent.press(view.getByLabelText('Person'));
    expect(onChange).toHaveBeenCalledWith('identity');
  });

  it('does not open its chooser when disabled', () => {
    const view = render(<VisionRoleChip role="object" onChange={jest.fn()} disabled />);
    fireEvent.press(view.getByLabelText('Object reference role'));
    expect(view.queryByLabelText('Person')).toBeNull();
  });
});
