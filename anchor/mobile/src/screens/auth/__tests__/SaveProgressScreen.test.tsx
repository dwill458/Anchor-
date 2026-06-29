import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SaveProgressScreen } from '../SaveProgressScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
  useRoute: jest.fn(() => ({
    params: {
      anchorId: 'anchor-1',
    },
  })),
}));

const mockGetAnchorById = jest.fn();

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      getAnchorById: mockGetAnchorById,
    }),
}));

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Mock = ({ children, ...props }: any) => <View {...props}>{children}</View>;
  return {
    __esModule: true,
    default: Mock,
    Path: Mock,
    SvgXml: Mock,
  };
});

describe('SaveProgressScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAnchorById.mockReturnValue({
      id: 'anchor-1',
      intentionText: 'I move with focus',
      baseSigilSvg: '<svg><path d="M0 0"/></svg>',
      reinforcedSigilSvg: '<svg><path d="M1 1"/></svg>',
      enhancedImageUrl: null,
    });
  });

  it('renders the save progress sheet', () => {
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('SAVE PROGRESS')).toBeTruthy();
    expect(getByText('Create Account')).toBeTruthy();
    expect(getByText('I already have an account')).toBeTruthy();
    expect(
      getByText(/Creating your account starts your free 7-day trial/i)
    ).toBeTruthy();
  });

  it('does not offer a skip option (account required before Vault)', () => {
    const { queryByText } = render(<SaveProgressScreen />);
    expect(queryByText('Skip for now')).toBeNull();
  });

  it('shows the anchor intention text', () => {
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('I move with focus')).toBeTruthy();
  });

  it('navigates to SignUp when Create Account is pressed', () => {
    const { getByText } = render(<SaveProgressScreen />);
    fireEvent.press(getByText('Create Account'));
    expect(mockNavigate).toHaveBeenCalledWith('SignUp', {
      context: 'save_progress',
      initialTab: 'signup',
    });
  });

  it('navigates to Login when sign in is pressed', () => {
    const { getByText } = render(<SaveProgressScreen />);
    fireEvent.press(getByText('I already have an account'));
    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      context: 'save_progress',
    });
  });

  it('renders empty anchor thumbnail when anchorSvg is empty', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: { anchorId: 'anchor-2' },
    });
    mockGetAnchorById.mockReturnValue({
      id: 'anchor-2',
      intentionText: 'Test',
      baseSigilSvg: '',
      reinforcedSigilSvg: '',
      enhancedImageUrl: null,
    });
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('⚓')).toBeTruthy();
  });
});
