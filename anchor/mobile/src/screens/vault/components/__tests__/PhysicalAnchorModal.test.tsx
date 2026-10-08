import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PhysicalAnchorModal, PRODUCTS } from '../PhysicalAnchorModal';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import type { Anchor } from '@/types';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    track: jest.fn(),
  },
  AnalyticsEvents: {
    MERCH_PRODUCT_SELECTED: 'merch_product_selected',
  },
}));

describe('PhysicalAnchorModal', () => {
  const mockAnchor: Anchor = {
    id: 'anchor-test-123',
    user_id: 'user-1',
    intention: 'Peace and focus',
    category: 'mindfulness',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Anchor;

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    anchor: mockAnchor,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all product options in Anchor 2.0 design language', () => {
    const { getByText, getByTestId } = render(<PhysicalAnchorModal {...defaultProps} />);

    expect(getByTestId('physical-anchor-modal')).toBeTruthy();
    expect(getByText('PHYSICAL ARTIFACT')).toBeTruthy();
    expect(getByText('Choose a form')).toBeTruthy();
    expect(getByText('Your anchor will be mapped exactly as shown.')).toBeTruthy();

    for (const product of PRODUCTS) {
      expect(getByText(product.title)).toBeTruthy();
      expect(getByText(product.description)).toBeTruthy();
    }
  });

  it('tracks analytics and shows alert when selecting a product', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<PhysicalAnchorModal {...defaultProps} />);

    fireEvent.press(getByText('Keychain'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.MERCH_PRODUCT_SELECTED,
      {
        anchor_id: 'anchor-test-123',
        product_type: 'keychain',
        product_title: 'Keychain',
      }
    );

    expect(alertSpy).toHaveBeenCalledWith(
      'Keychain',
      expect.stringContaining('Printful integration coming soon!'),
      expect.any(Array)
    );
  });

  it('calls onClose when Cancel button is pressed', () => {
    const { getByTestId } = render(<PhysicalAnchorModal {...defaultProps} />);

    fireEvent.press(getByTestId('physical-anchor-modal-cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
