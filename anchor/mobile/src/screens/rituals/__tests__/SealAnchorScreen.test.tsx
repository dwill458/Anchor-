import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SealAnchorScreen } from '../SealAnchorScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import type { Anchor } from '@/types';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
  }),
  useRoute: () => ({
    params: {
      anchorId: 'test-anchor-seal-1',
      returnTo: 'vault',
    },
  }),
}));

const mockAnchor: Anchor = {
  id: 'test-anchor-seal-1',
  userId: 'user-1',
  name: 'Vitality',
  intentionText: 'I radiate boundless energy',
  category: 'health',
  baseSigilSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>',
  reinforcedSigilSvg: null,
  enhancedImageUrl: null,
  isCharged: false,
  threadStrength: 0,
  streak: 0,
  chargeCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('SealAnchorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useAnchorStore.setState({
      anchors: [mockAnchor],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders anchor intention and seal affordance', () => {
    render(<SealAnchorScreen />);

    expect(screen.getByText('"I radiate boundless energy"')).toBeTruthy();
    expect(screen.getByText('Breathe and hold')).toBeTruthy();
  });

  it('completes seal on long-press and navigates swiftly to FirstPrimeComplete', async () => {
    render(<SealAnchorScreen />);

    const holdButton = screen.getByLabelText('Press and hold to seal your anchor');
    
    act(() => {
      fireEvent(holdButton, 'pressIn');
    });

    // Advance 3000ms for hold duration + 300ms for transition
    await act(async () => {
      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(350);
    });

    expect(mockReplace).toHaveBeenCalledWith(
      'FirstPrimeComplete',
      expect.objectContaining({
        anchorId: 'test-anchor-seal-1',
      })
    );
  });

  it('cancels seal if released prematurely', async () => {
    render(<SealAnchorScreen />);

    const holdButton = screen.getByLabelText('Press and hold to seal your anchor');
    
    act(() => {
      fireEvent(holdButton, 'pressIn');
    });

    act(() => {
      jest.advanceTimersByTime(1000);
      fireEvent(holdButton, 'pressOut');
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
