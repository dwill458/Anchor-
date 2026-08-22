import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PhotoSourceSheet } from '../PhotoSourceSheet';

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    selection: jest.fn(),
    impact: jest.fn(),
  },
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

describe('PhotoSourceSheet', () => {
  const onCloseMock = jest.fn();
  const onSelectCameraMock = jest.fn();
  const onSelectLibraryMock = jest.fn();
  const onRemovePhotoMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header, options, and cancel button when visible', () => {
    const { getByText } = render(
      <PhotoSourceSheet
        visible={true}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
      />
    );

    expect(getByText('YOUR IMAGE')).toBeTruthy();
    expect(getByText('Update Your Signal Photo')).toBeTruthy();
    expect(getByText("Choose how you'd like to add it.")).toBeTruthy();
    expect(getByText('Take Photo')).toBeTruthy();
    expect(getByText('Capture a new image with your camera')).toBeTruthy();
    expect(getByText('Choose from Library')).toBeTruthy();
    expect(getByText('Select an existing photo from your library')).toBeTruthy();
    expect(getByText('CANCEL')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(
      <PhotoSourceSheet
        visible={false}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
      />
    );

    expect(queryByText('YOUR IMAGE')).toBeNull();
    expect(queryByText('Update Your Signal Photo')).toBeNull();
  });

  it('fires onSelectCamera when Take Photo is pressed', () => {
    const { getByLabelText } = render(
      <PhotoSourceSheet
        visible={true}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
      />
    );

    fireEvent.press(getByLabelText('Take Photo'));
    expect(onSelectCameraMock).toHaveBeenCalledTimes(1);
  });

  it('fires onSelectLibrary when Choose from Library is pressed', () => {
    const { getByLabelText } = render(
      <PhotoSourceSheet
        visible={true}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
      />
    );

    fireEvent.press(getByLabelText('Choose from Library'));
    expect(onSelectLibraryMock).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when CANCEL is pressed', () => {
    const { getByLabelText } = render(
      <PhotoSourceSheet
        visible={true}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
      />
    );

    fireEvent.press(getByLabelText('Cancel'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when backdrop is tapped', () => {
    const { getByLabelText } = render(
      <PhotoSourceSheet
        visible={true}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
      />
    );

    fireEvent.press(getByLabelText('Dismiss photo options'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('renders remove photo option and calls onRemovePhoto when existing photo is present', () => {
    const { getByLabelText, getByText } = render(
      <PhotoSourceSheet
        visible={true}
        onClose={onCloseMock}
        onSelectCamera={onSelectCameraMock}
        onSelectLibrary={onSelectLibraryMock}
        onRemovePhoto={onRemovePhotoMock}
        hasExistingPhoto={true}
      />
    );

    expect(getByText('Remove Photo')).toBeTruthy();
    expect(getByText('Revert to your default signal mark')).toBeTruthy();

    fireEvent.press(getByLabelText('Remove Photo'));
    expect(onRemovePhotoMock).toHaveBeenCalledTimes(1);
  });
});
