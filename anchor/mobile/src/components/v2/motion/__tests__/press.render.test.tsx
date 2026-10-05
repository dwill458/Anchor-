import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AnimatedPressable, usePressScale } from '../press';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));

function Host({ onPress }: { onPress: () => void }) {
  const press = usePressScale();
  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={press.style}>
      <Text>press me</Text>
    </AnimatedPressable>
  );
}

describe('usePressScale', () => {
  it('leaves the pressable pressable', () => {
    const onPress = jest.fn();
    render(<Host onPress={onPress} />);
    fireEvent(screen.getByText('press me'), 'pressIn');
    fireEvent(screen.getByText('press me'), 'pressOut');
    fireEvent.press(screen.getByText('press me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
