import React from 'react';
import { Animated } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EditProfileSheet } from '../EditProfileSheet';

const profile = {
  name: 'Mara',
  axiom: 'I return to what matters.',
  timezone: 'UTC−5 · America/Chicago',
  mono: 'initial' as const,
  photo: null,
};

const animation = () => ({
  start: jest.fn((callback?: (result: { finished: boolean }) => void) => callback?.({ finished: true })),
  stop: jest.fn(),
});

describe('EditProfileSheet', () => {
  beforeEach(() => {
    jest.spyOn(Animated, 'timing').mockReturnValue(animation() as any);
    jest.spyOn(Animated, 'parallel').mockReturnValue(animation() as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the Profile 1.5 form labels and all editable profile controls available', () => {
    render(<EditProfileSheet open profile={profile} onClose={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByText('EDIT PROFILE')).toBeTruthy();
    expect(screen.getByText('PROFILE MARK')).toBeTruthy();
    expect(screen.getByText('DISPLAY NAME')).toBeTruthy();
    expect(screen.getByText('OPERATING PRINCIPLE')).toBeTruthy();
    expect(screen.getByText('DEFAULT MARK')).toBeTruthy();
    expect(screen.getByText('TIMEZONE')).toBeTruthy();
    expect(screen.getByDisplayValue('Mara')).toBeTruthy();
    expect(screen.getByDisplayValue('I return to what matters.')).toBeTruthy();
    expect(screen.getByLabelText('Choose avatar 0 profile mark')).toBeTruthy();
  });

  it('saves the edited values through the existing profile contract', async () => {
    const onSave = jest.fn();
    render(<EditProfileSheet open profile={profile} onClose={jest.fn()} onSave={onSave} />);

    fireEvent.changeText(screen.getByDisplayValue('Mara'), 'Mara Vale');
    fireEvent.press(screen.getByLabelText('Save profile'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        ...profile,
        name: 'Mara Vale',
      });
    });
  });
});
