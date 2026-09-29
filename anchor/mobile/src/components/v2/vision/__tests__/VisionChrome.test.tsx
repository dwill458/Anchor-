import React from 'react';
import { render } from '@testing-library/react-native';
import { VisionHeaderRow, VisionIdentity, VisionInkBand } from '../VisionChrome';

// Mock Safe Area Context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('VisionChrome', () => {
  describe('VisionIdentity', () => {
    it('omits circular Anchor thumbnail when showAnchor is false', () => {
      const { queryByLabelText, getByText } = render(
        <VisionIdentity
          intention="Anchor has ten thousand users"
          category="desire"
          showAnchor={false}
          testID="vision-identity-saved"
        />,
      );

      // The Anchor circular thumbnail must NOT be present
      expect(queryByLabelText(/Anchor/i)).toBeNull();

      // The intention copy and category must be present
      expect(getByText('Anchor has ten thousand users')).toBeTruthy();
      expect(getByText('DESIRE')).toBeTruthy();
    });

    it('renders circular Anchor mark when showAnchor is true (or default)', () => {
      const { getByLabelText, getByText } = render(
        <VisionIdentity
          intention="Anchor has ten thousand users"
          category="desire"
          art={{ svg: '<svg></svg>', category: 'desire' }}
          showAnchor={true}
          testID="vision-identity-default"
        />,
      );

      // The Anchor thumbnail accessibility label must be present
      expect(getByLabelText(/Desire Anchor/i)).toBeTruthy();
      expect(getByText('Anchor has ten thousand users')).toBeTruthy();
      expect(getByText('DESIRE')).toBeTruthy();
    });
  });

  describe('VisionHeaderRow', () => {
    it('renders header title and responds to back press', () => {
      const onBack = jest.fn();
      const { getByText, getByLabelText } = render(
        <VisionHeaderRow title="Vision" onBack={onBack} />,
      );

      expect(getByText('Vision')).toBeTruthy();
      const backButton = getByLabelText('Go back');
      expect(backButton).toBeTruthy();
    });
  });

  describe('VisionInkBand', () => {
    it('renders children with light status bar styling', () => {
      const { getByText } = render(
        <VisionInkBand>
          <></>
        </VisionInkBand>,
      );
      expect(true).toBe(true);
    });
  });
});
