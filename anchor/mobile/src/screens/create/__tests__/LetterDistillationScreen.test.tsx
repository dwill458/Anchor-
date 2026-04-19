import React from 'react';
import { render, screen } from '@testing-library/react-native';
import LetterDistillationScreen from '../LetterDistillationScreen';

let mockAuthAnchorCount = 0;
let mockLocalAnchorCount = 0;
let mockTotalAnchorsCreated = 0;
const mockPlaySound = jest.fn();

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: mockTotalAnchorsCreated > 0 ? { totalAnchorsCreated: mockTotalAnchorsCreated } : null,
      anchorCount: mockAuthAnchorCount,
    }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      anchors: Array.from({ length: mockLocalAnchorCount }, (_, index) => ({ id: `anchor-${index}` })),
    }),
}));

jest.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
  }),
}));

describe('LetterDistillationScreen', () => {
  const navigation = {
    navigate: jest.fn(),
  } as any;

  const route = {
    params: {
      intentionText: 'Stay grounded',
      distilledLetters: ['S', 'T', 'Y', 'G', 'R', 'N', 'D'],
      category: 'custom',
    },
  } as any;

  beforeEach(() => {
    navigation.navigate.mockClear();
    mockPlaySound.mockClear();
    mockAuthAnchorCount = 0;
    mockLocalAnchorCount = 0;
    mockTotalAnchorsCreated = 0;
  });

  it('shows skip for returning users with locally stored anchors', () => {
    mockLocalAnchorCount = 1;

    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(screen.getByRole('button', { name: 'Skip to final stage' })).toBeTruthy();
  });

  it('hides skip for first-time users', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(screen.queryByRole('button', { name: 'Skip to final stage' })).toBeNull();
  });
});
