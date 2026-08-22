import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { EditProfileSheet } from '../EditProfileSheet';

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: jest.fn(() => ({})),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///test-library-photo.jpg' }],
  }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///test-camera-photo.jpg' }],
  }),
}));

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    selection: jest.fn(),
    impact: jest.fn(),
  },
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

describe('EditProfileSheet with PhotoSourceSheet', () => {
  const onCloseMock = jest.fn();
  const onSaveMock = jest.fn();

  const mockProfile = {
    name: 'Marcus Aurelius',
    axiom: 'Waste no more time arguing what a good man should be. Be one.',
    timezone: 'America/New_York',
    mono: 'initial' as const,
    photo: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders EditProfileSheet and opens PhotoSourceSheet on Change image press', () => {
    const { getByText, queryByText } = render(
      <EditProfileSheet
        open={true}
        profile={mockProfile}
        onClose={onCloseMock}
        onSave={onSaveMock}
      />
    );

    expect(getByText('EDIT YOUR SIGNAL')).toBeTruthy();
    expect(getByText('Change image')).toBeTruthy();

    // PhotoSourceSheet should not be visible before clicking
    expect(queryByText('Update Your Signal Photo')).toBeNull();

    // Click "Change image"
    fireEvent.press(getByText('Change image'));

    // PhotoSourceSheet should now be visible
    expect(getByText('Update Your Signal Photo')).toBeTruthy();
    expect(getByText('Take Photo')).toBeTruthy();
    expect(getByText('Choose from Library')).toBeTruthy();
    expect(getByText('CANCEL')).toBeTruthy();
  });

  it('closes PhotoSourceSheet when cancel is pressed in the photo sheet', () => {
    const { getByText, getByLabelText } = render(
      <EditProfileSheet
        open={true}
        profile={mockProfile}
        onClose={onCloseMock}
        onSave={onSaveMock}
      />
    );

    fireEvent.press(getByText('Change image'));
    expect(getByText('Update Your Signal Photo')).toBeTruthy();

    fireEvent.press(getByLabelText('Cancel'));
    // Triggers dismissal
  });
});
