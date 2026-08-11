import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SaveProgressScreen } from '../SaveProgressScreen';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockTrack = jest.fn();
const mockWarn = jest.fn();
const mockAnchor = {
  id: 'anchor-1',
  userId: 'user-local',
  intentionText: 'Listen before reacting',
  category: 'career',
  distilledLetters: ['L', 'S', 'T', 'N'],
  baseSigilSvg: '<svg><path d="M0 0"/></svg>',
  reinforcedSigilSvg: '<svg><path d="M1 1"/></svg>',
  enhancedImageUrl: null,
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2026-06-30T00:00:00Z'),
  updatedAt: new Date('2026-06-30T00:00:00Z'),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    replace: mockReplace,
  })),
  useRoute: jest.fn(() => ({
    params: {
      anchor: mockAnchor,
    },
  })),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => cb(), [cb]);
  },
}));

const mockFinalize = jest.fn().mockResolvedValue(true);
let mockAuthState: Record<string, unknown> = {
  isAuthenticated: false,
  pendingFirstAnchorDraft: null,
  isFinalizingPendingFirstAnchor: false,
  pendingFirstAnchorError: null,
  finalizePendingFirstAnchorDraft: mockFinalize,
  clearPendingFirstAnchorError: jest.fn(),
  signOut: jest.fn(),
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockAuthState),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => true,
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...args: unknown[]) => mockTrack(...args) },
}));

jest.mock('@/utils/logger', () => ({
  logger: { warn: (...args: unknown[]) => mockWarn(...args) },
}));

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Mock = ({ children, ...props }: any) => <View {...props}>{children}</View>;
  return {
    __esModule: true,
    default: Mock,
    Circle: Mock,
    Path: Mock,
    Svg: Mock,
    SvgXml: Mock,
  };
});

describe('SaveProgressScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFinalize.mockResolvedValue(true);
    mockAuthState = {
      isAuthenticated: false,
      pendingFirstAnchorDraft: null,
      isFinalizingPendingFirstAnchor: false,
      pendingFirstAnchorError: null,
      finalizePendingFirstAnchorDraft: mockFinalize,
      clearPendingFirstAnchorError: jest.fn(),
      signOut: jest.fn(),
    };
  });

  it('renders the prototype copy and forged intention', () => {
    const { getByText } = render(<SaveProgressScreen />);

    expect(getByText('SAVE YOUR ANCHOR')).toBeTruthy();
    expect(getByText(/YOUR FIRST ANCHOR/)).toBeTruthy();
    expect(getByText(/You made this\. Create a free account to keep it synced/i)).toBeTruthy();
    expect(getByText('FORGED JUST NOW')).toBeTruthy();
    expect(getByText('Listen before reacting')).toBeTruthy();
    expect(getByText('SAVE MY ANCHOR')).toBeTruthy();
    expect(getByText('I already have an account')).toBeTruthy();
  });

  it('tracks the view with artwork availability', () => {
    render(<SaveProgressScreen />);

    expect(mockTrack).toHaveBeenCalledWith('save_progress_viewed', {
      anchor_id: 'anchor-1',
      has_png: false,
      has_svg: true,
    });
  });

  it('navigates to SignUp with the anchor id when Save My Anchor is pressed', () => {
    const { getByText } = render(<SaveProgressScreen />);

    fireEvent.press(getByText('SAVE MY ANCHOR'));

    expect(mockTrack).toHaveBeenCalledWith('save_progress_save_tapped', {
      anchor_id: 'anchor-1',
    });
    expect(mockNavigate).toHaveBeenCalledWith('SignUp', {
      context: 'save_progress',
      initialTab: 'signup',
      anchorId: 'anchor-1',
    });
  });

  it('navigates to Login with the anchor id when sign in is pressed', () => {
    const { getByText } = render(<SaveProgressScreen />);

    fireEvent.press(getByText('I already have an account'));

    expect(mockTrack).toHaveBeenCalledWith('save_progress_signin_tapped', {
      anchor_id: 'anchor-1',
    });
    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      context: 'save_progress',
      anchorId: 'anchor-1',
    });
  });

  it('finalizes the pending first anchor and enters Prime once authenticated', async () => {
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      pendingFirstAnchorDraft: { tempAnchorId: 'anchor-1' },
    };

    render(<SaveProgressScreen />);

    await waitFor(() => expect(mockFinalize).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PrimeYourAnchor', { anchorId: 'anchor-1' }));
    expect(mockNavigate).not.toHaveBeenCalledWith('SignUp', expect.anything());
  });

  it('drops an authenticated user with no pending draft straight into Prime', () => {
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      pendingFirstAnchorDraft: null,
    };

    render(<SaveProgressScreen />);

    expect(mockReplace).toHaveBeenCalledWith('PrimeYourAnchor', { anchorId: 'anchor-1' });
    expect(mockFinalize).not.toHaveBeenCalled();
  });
});
