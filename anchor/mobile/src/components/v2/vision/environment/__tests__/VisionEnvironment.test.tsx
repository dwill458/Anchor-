import React from 'react';
import { render } from '@testing-library/react-native';
import { VisionEnvironment } from '../VisionEnvironment';
import { resolveVisionEnvironment } from '../visionEnvironmentAssets';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Safe Area Context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('VisionEnvironment', () => {
  it('resolves the environmental asset pack for any category, defaulting cleanly', () => {
    const desirePack = resolveVisionEnvironment('desire');
    expect(desirePack.headerCompass).toBeDefined();
    expect(desirePack.headerBotanical).toBeDefined();
    expect(desirePack.leftEnvironment).toBeDefined();
    expect(desirePack.rightEnvironment).toBeDefined();
    expect(desirePack.bottomContours).toBeDefined();

    // Fallback for null/undefined or other categories
    const fallbackPack = resolveVisionEnvironment(null);
    expect(fallbackPack.headerCompass).toBe(desirePack.headerCompass);
    const healthPack = resolveVisionEnvironment('health');
    expect(healthPack.headerCompass).toBe(desirePack.headerCompass);
  });

  it('renders all 5 environmental illustration layers with proper testIDs', () => {
    const { getByTestId } = render(
      <VisionEnvironment category="desire" boardWidth={369} reduceMotion={false} testID="test-env" />,
    );

    const opts = { includeHiddenElements: true };
    expect(getByTestId('test-env', opts)).toBeTruthy();
    expect(getByTestId('test-env-compass', opts)).toBeTruthy();
    expect(getByTestId('test-env-botanical', opts)).toBeTruthy();
    expect(getByTestId('test-env-left', opts)).toBeTruthy();
    expect(getByTestId('test-env-right', opts)).toBeTruthy();
    expect(getByTestId('test-env-bottom', opts)).toBeTruthy();
  });

  it('mounts without crashing when reduceMotion is enabled', () => {
    const { getByTestId } = render(
      <VisionEnvironment category="desire" boardWidth={369} reduceMotion={true} testID="test-env-rm" />,
    );

    expect(getByTestId('test-env-rm', { includeHiddenElements: true })).toBeTruthy();
  });

  it('adapts responsive layout positioning to both iPhone and Android screen widths', () => {
    const opts = { includeHiddenElements: true };
    // iPhone 14 Pro width approx (369 board width)
    const { getByTestId: getIPhone, rerender } = render(
      <VisionEnvironment category="desire" boardWidth={369} testID="env-responsive" />,
    );
    const leftAssetIPhone = getIPhone('env-responsive-left', opts);
    expect(leftAssetIPhone.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          left: expect.any(Number),
          top: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      ]),
    );

    // Galaxy S24 smaller width (e.g. 336 board width)
    rerender(<VisionEnvironment category="desire" boardWidth={336} testID="env-responsive" />);
    const leftAssetS24 = getIPhone('env-responsive-left', opts);
    expect(leftAssetS24).toBeTruthy();
  });
});
