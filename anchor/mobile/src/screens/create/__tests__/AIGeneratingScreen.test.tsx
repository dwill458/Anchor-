import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { replace: mockReplace, navigate: mockNavigate, goBack: mockGoBack };
const mockUpdateDraft = jest.fn();
const mockFetch = jest.fn();
const routeParams = {
  intentionText: 'I return to deliberate work.',
  category: 'career' as const,
  distilledLetters: ['R', 'T', 'N'],
  baseSigilSvg: '<svg><path d="M0 0L10 10" /></svg>',
  reinforcedSigilSvg: '<svg><path d="M1 1L9 9" /></svg>',
  structureVariant: 'balanced' as const,
  styleChoice: 'architectural_trace' as const,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: routeParams }),
}));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => true }));
jest.mock('@/hooks/useTrialStatus', () => ({ useTrialStatus: () => ({ hasActiveEntitlement: true }) }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    user: { id: 'user-1' },
    isAuthenticated: true,
    anchorCount: 1,
  }),
}));
jest.mock('@/stores/firstAnchorFlowStore', () => ({
  useFirstAnchorFlowStore: { getState: () => ({ updateDraft: mockUpdateDraft }) },
}));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn(() => Promise.resolve('token')) } }));
jest.mock('@/services/PerformanceMonitoring', () => ({
  PerformanceMonitoring: { startTrace: jest.fn(() => ({ putAttribute: jest.fn(), stop: jest.fn() })) },
}));
jest.mock('@/services/FrictionAnalytics', () => ({
  FrictionAnalytics: { stepCompleted: jest.fn(), flowError: jest.fn(), flowRetry: jest.fn() },
}));
jest.mock('@/services/ErrorTrackingService', () => ({
  ErrorTrackingService: { addBreadcrumb: jest.fn(), captureException: jest.fn() },
}));

const AIGeneratingScreen = require('../AIGeneratingScreen').default;

describe('AIGeneratingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as typeof globalThis).fetch = mockFetch as unknown as typeof fetch;
  });

  it('renders the generation lifecycle and navigates only after a successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        variations: ['https://example.test/variation.png'],
        prompt: 'architectural anchor',
        model: 'gemini',
        provider: 'gemini',
        controlMethod: 'lineart',
        generationTime: 2,
      }),
    });
    const screen = render(<AIGeneratingScreen />);

    expect(screen.getByText('Generating Your Anchor')).toBeTruthy();
    expect(screen.getByText('PREPARING STRUCTURE')).toBeTruthy();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/ai/enhance'), expect.anything());
      expect(mockReplace).toHaveBeenCalledWith(
        'EnhancedVersionPicker',
        expect.objectContaining({ variations: ['https://example.test/variation.png'] }),
      );
    });

    const [, request] = mockFetch.mock.calls[0];
    expect(request.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer token' }));
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({ sigilSvg: routeParams.reinforcedSigilSvg }));

    expect(mockUpdateDraft).toHaveBeenCalledWith({ generationStatus: 'complete' });
  });

  it('preserves the selection on a connection failure and retries explicitly', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network connection lost'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ variations: [] }) });
    const screen = render(<AIGeneratingScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Connection Lost').length).toBeGreaterThan(0);
      expect(screen.getByText('Your choices are saved.')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Retry generation'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
