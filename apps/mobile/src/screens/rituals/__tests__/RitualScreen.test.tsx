import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RitualScreen } from '../RitualScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useRitualController } from '@/hooks/useRitualController';
import { getRitualConfig } from '@/config/ritualConfigs';
import { apiClient } from '@/services/ApiClient';
import { createMockAnchor } from '@/__tests__/utils/testUtils';

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      createAnimatedComponent: (component: any) => component,
    },
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, replace: mockReplace }),
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/hooks/useRitualController');
jest.mock('@/config/ritualConfigs');
jest.mock('@/services/ApiClient');

const mockActions = {
  start: jest.fn(),
  reset: jest.fn(),
  startSeal: jest.fn(),
  cancelSeal: jest.fn(),
};

let mockState: any = {
  progress: 0.2,
  isSealPhase: false,
  isSealComplete: false,
  sealProgress: 0,
  formattedRemaining: '0:25',
  currentInstruction: 'Hold steady',
  currentPhase: { title: 'Focus' },
  currentPhaseIndex: 0,
  totalPhases: 2,
};

let lastControllerOptions: any = null;

(useRitualController as jest.Mock).mockImplementation((options) => {
  lastControllerOptions = options;
  return {
    state: mockState,
    actions: mockActions,
  };
});

const mockConfig = {
  id: 'quick',
  name: 'Quick',
  totalDurationSeconds: 30,
  sealDurationSeconds: 3,
  phases: [{ title: 'Focus' }, { title: 'Seal' }],
};

(getRitualConfig as jest.Mock).mockReturnValue(mockConfig);

describe('RitualScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastControllerOptions = null;
    mockState = {
      progress: 0.2,
      isSealPhase: false,
      isSealComplete: false,
      sealProgress: 0,
      formattedRemaining: '0:25',
      currentInstruction: 'Hold steady',
      currentPhase: { title: 'Focus' },
      currentPhaseIndex: 0,
      totalPhases: 2,
    };

    mockUseRoute.mockReturnValue({
      params: {
        anchorId: 'anchor-123',
        ritualType: 'quick',
      },
    });

    (useAnchorStore as unknown as jest.Mock).mockReturnValue({
      getAnchorById: jest.fn(() =>
        createMockAnchor({ id: 'anchor-123', baseSigilSvg: '<svg></svg>' })
      ),
      updateAnchor: jest.fn().mockResolvedValue(undefined),
    });

    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });
  });

  it('renders error state when anchor is missing', () => {
    (useAnchorStore as unknown as jest.Mock).mockReturnValue({
      getAnchorById: jest.fn(() => undefined),
      updateAnchor: jest.fn(),
    });

    const { getByText } = render(<RitualScreen />);

    expect(getByText('Anchor not found. Returning to vault...')).toBeTruthy();
  });

  it('starts and resets the ritual lifecycle', () => {
    const { unmount } = render(<RitualScreen />);

    expect(mockActions.start).toHaveBeenCalled();

    unmount();

    expect(mockActions.reset).toHaveBeenCalled();
  });

  it('shows the phase indicator when multiple phases exist', () => {
    const { getByText } = render(<RitualScreen />);

    expect(getByText('Phase 1 of 2')).toBeTruthy();
  });

  it('renders the timer when not in seal phase', () => {
    const { getByText } = render(<RitualScreen />);

    expect(getByText('0:25 remaining')).toBeTruthy();
  });

  it('renders seal gesture prompt and responds to press in/out', () => {
    mockState = {
      ...mockState,
      isSealPhase: true,
      isSealComplete: false,
      sealProgress: 0.4,
    };

    const { getByText } = render(<RitualScreen />);

    const prompt = getByText('Press and hold to seal');
    const sealButton = (prompt.parent as any)?.parent as any;
    fireEvent(sealButton, 'pressIn');
    fireEvent(sealButton, 'pressOut');

    expect(mockActions.startSeal).toHaveBeenCalled();
    expect(mockActions.cancelSeal).toHaveBeenCalled();
  });

  it('prompts for exit and navigates back when confirmed', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, message, buttons) => {
        const exitButton = buttons?.find((button) => button.text === 'Exit');
        exitButton?.onPress?.();
      });

    const { getByText } = render(<RitualScreen />);
    const backIcon = String.fromCharCode(215);

    fireEvent.press(getByText(backIcon).parent as any);

    expect(alertSpy).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('charges the anchor and updates state on seal completion (quick)', async () => {
    render(<RitualScreen />);

    await lastControllerOptions.onSealComplete();

    expect(apiClient.post).toHaveBeenCalledWith('/api/anchors/anchor-123/charge', {
      chargeType: 'initial_quick',
      durationSeconds: 30,
    });

    const store = (useAnchorStore as unknown as jest.Mock).mock.results[0].value;
    await waitFor(() => {
      expect(store.updateAnchor).toHaveBeenCalledWith('anchor-123', {
        isCharged: true,
        chargedAt: expect.any(Date),
      });
    });

    expect(mockReplace).toHaveBeenCalledWith('ChargeComplete', { anchorId: 'anchor-123' });
  });

  it('uses deep charge type for deep rituals', async () => {
    mockUseRoute.mockReturnValue({
      params: {
        anchorId: 'anchor-123',
        ritualType: 'deep',
      },
    });

    render(<RitualScreen />);

    await lastControllerOptions.onSealComplete();

    expect(apiClient.post).toHaveBeenCalledWith('/api/anchors/anchor-123/charge', {
      chargeType: 'initial_deep',
      durationSeconds: 30,
    });
  });

  it('alerts on seal completion errors', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<RitualScreen />);

    await lastControllerOptions.onSealComplete();

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to save charge. Please try again.');

    alertSpy.mockRestore();
  });
});
