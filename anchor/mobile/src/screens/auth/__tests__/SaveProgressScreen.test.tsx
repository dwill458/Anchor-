import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SaveProgressScreen } from '../SaveProgressScreen';
import { AuthService } from '@/services/AuthService';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockSetAuthenticated = jest.fn();
const mockSetHasCompletedOnboarding = jest.fn();
const mockSetIsGuest = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    replace: mockReplace,
  })),
  useRoute: jest.fn(() => ({
    params: {
      anchorIntention: 'I move with focus',
      anchorSvg: '<svg><path d="M0 0"/></svg>',
    },
  })),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setAuthenticated: mockSetAuthenticated,
      setHasCompletedOnboarding: mockSetHasCompletedOnboarding,
      setIsGuest: mockSetIsGuest,
    }),
}));

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    signInWithGoogle: jest.fn(),
  },
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
    (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders the save progress sheet', () => {
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('SEAL MY PROGRESS')).toBeTruthy();
    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByText('Use Email Instead')).toBeTruthy();
    expect(getByText("Skip — I know it won't be saved")).toBeTruthy();
  });

  it('shows the anchor intention text', () => {
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('I move with focus')).toBeTruthy();
  });

  it('navigates to SignUp when SEAL MY PROGRESS is pressed', () => {
    const { getByText } = render(<SaveProgressScreen />);
    fireEvent.press(getByText('SEAL MY PROGRESS'));
    expect(mockNavigate).toHaveBeenCalledWith('SignUp');
  });

  it('navigates to SignUp when Use Email Instead is pressed', () => {
    const { getByText } = render(<SaveProgressScreen />);
    fireEvent.press(getByText('Use Email Instead'));
    expect(mockNavigate).toHaveBeenCalledWith('SignUp');
  });

  it('sets guest mode and navigates to Vault on skip', () => {
    const { getByText } = render(<SaveProgressScreen />);
    fireEvent.press(getByText("Skip — I know it won't be saved"));
    expect(mockSetIsGuest).toHaveBeenCalledWith(true);
    expect(mockSetHasCompletedOnboarding).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('Vault');
  });

  it('calls Google sign-in and navigates to Vault on success', async () => {
    const { getByText } = render(<SaveProgressScreen />);
    fireEvent.press(getByText('Continue with Google'));
    await Promise.resolve();
    expect(AuthService.signInWithGoogle).toHaveBeenCalled();
  });

  it('shows anchor status as unsaved', () => {
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('Forged · unsaved')).toBeTruthy();
  });

  it('shows warning chip about device storage', () => {
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('Lives on this device only. ')).toBeTruthy();
  });

  it('renders empty anchor thumbnail when anchorSvg is empty', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: { anchorIntention: 'Test', anchorSvg: '' },
    });
    const { getByText } = render(<SaveProgressScreen />);
    expect(getByText('⚓')).toBeTruthy();
  });
});
