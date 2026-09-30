import React from 'react';
import { render } from '@testing-library/react-native';
import { VisionDevelopingPhoto } from '../VisionDevelopingPhoto';

describe('VisionDevelopingPhoto', () => {
  const defaultRect = {
    x: 20,
    y: 40,
    width: 160,
    height: 120,
    rotation: -2,
    zIndex: 10,
  };

  it('renders developing abstract photographic surface when imageUrl is not ready', () => {
    const { getByTestId, queryByRole } = render(
      <VisionDevelopingPhoto
        testID="test-dev-photo"
        rect={defaultRect}
        sceneId="scene-1"
        category="career"
        isReady={false}
      />,
    );
    expect(getByTestId('test-dev-photo')).toBeTruthy();
  });

  it('renders photo image when isReady is true and imageUrl is provided', () => {
    const { getByTestId } = render(
      <VisionDevelopingPhoto
        testID="test-dev-photo"
        rect={defaultRect}
        sceneId="scene-1"
        category="career"
        imageUrl="https://example.com/moment.jpg"
        isReady={true}
        reduceMotion={true}
      />,
    );
    const photo = getByTestId('test-dev-photo');
    expect(photo).toBeTruthy();
  });
});
