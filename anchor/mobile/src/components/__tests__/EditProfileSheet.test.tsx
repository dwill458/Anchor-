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

  it('renders Anchor 2.0 editorial edit profile form with display name and photo actions', () => {
    render(<EditProfileSheet open profile={profile} onClose={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByText('Edit profile')).toBeTruthy();
    expect(screen.getByText('DISPLAY NAME')).toBeTruthy();
    expect(screen.getByDisplayValue('Mara')).toBeTruthy();
    expect(screen.getByText('Change photo')).toBeTruthy();
    expect(screen.getByLabelText('Cancel editing profile')).toBeTruthy();
    expect(screen.getByLabelText('Save profile')).toBeTruthy();

    // Verify obsolete V1 concepts are absent
    expect(screen.queryByText('OPERATING PRINCIPLE')).toBeNull();
    expect(screen.queryByText('DEFAULT MARK')).toBeNull();
  });

  it('saves the edited display name through the profile contract', async () => {
    const onSave = jest.fn();
    render(<EditProfileSheet open profile={profile} onClose={jest.fn()} onSave={onSave} />);

    fireEvent.changeText(screen.getByDisplayValue('Mara'), 'Mara Vale');
    fireEvent.press(screen.getByLabelText('Save profile'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mara Vale',
        })
      );
    });
  });
});
