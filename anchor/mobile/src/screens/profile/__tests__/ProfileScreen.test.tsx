import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockAnchors: any[] = [];
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  subscriptionStatus: 'free',
  totalAnchorsCreated: 2,
  totalActivations: 0,
  currentStreak: 0,
  longestStreak: 0,
  stabilizesTotal: 0,
  stabilizeStreakDays: 0,
  createdAt: new Date('2026-01-10T00:00:00.000Z'),
};

const mockProfileState = {
  name: '',
  axiom: '',
  timezone: 'America/Chicago',
  mono: null,
  photo: null,
  memberSince: null,
  updateProfile: jest.fn(),
  syncFromUser: jest.fn(),
};

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.2',
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: any) => unknown) => {
    const state = {
      user: mockUser,
      setUser: jest.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector?: (state: any) => unknown) => {
    const state = {
      anchors: mockAnchors,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/profileStore', () => ({
  useProfileStore: (selector?: (state: any) => unknown) =>
    selector ? selector(mockProfileState) : mockProfileState,
}));

jest.mock('@/components/ToastProvider', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({
    isSubscribed: false,
  }),
}));

jest.mock('@/hooks/useProgressionData', () => ({
  useProgressionData: () => ({
    rank: {
      currentName: 'Practitioner',
      isMax: false,
      guidance: 'Keep going',
      progress: 0.5,
    },
    deepestPractice: {
      empty: true,
      title: 'No anchors primed yet',
      subtitle: 'Your deepest practice will appear here.',
      tierColor: '#D4AF37',
      tierName: 'Initiate',
      stats: { primes: 0 },
      progress: 0,
      guidance: 'Start priming',
    },
    nextMark: {
      earned: false,
      name: 'Discipline Mark',
      subtitle: 'Forged at 30 practice days',
      current: 9,
      required: 30,
    },
    practiceDays: 9,
    totalPrimes: 18,
    activeAnchors: 1,
  }),
}));

jest.mock('@/components/profile/ProfileHeader', () => ({
  ProfileHeader: () => null,
}));

jest.mock('@/components/profile/ProgressionSheet', () => ({
  ProgressionSheet: () => null,
}));

jest.mock('@/components/EditProfileSheet', () => ({
  EditProfileSheet: () => null,
}));

jest.mock('@/components/common', () => ({
  OptimizedImage: ({ style }: { style?: any }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'optimized-image', style });
  },
}));

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    patch: jest.fn(),
  },
}));

jest.mock('@/services/ProfileMediaService', () => ({
  persistProfilePhoto: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import { ProfileScreen } from '../ProfileScreen';

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockAnchors.length = 0;
    mockProfileState.syncFromUser.mockReset();
  });

  it('adds a greyed overlay for released anchors in the vault', () => {
    mockAnchors.push(
      {
        id: 'active-anchor',
        userId: 'user-1',
        intentionText: 'Build focus',
        category: 'career',
        distilledLetters: ['B', 'F'],
        baseSigilSvg: '<svg></svg>',
        structureVariant: 'balanced',
        enhancedImageUrl: 'https://example.com/active.png',
        isCharged: true,
        activationCount: 3,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'released-anchor',
        userId: 'user-1',
        intentionText: 'Old goal',
        category: 'career',
        distilledLetters: ['O', 'G'],
        baseSigilSvg: '<svg></svg>',
        structureVariant: 'balanced',
        enhancedImageUrl: 'https://example.com/released.png',
        isCharged: true,
        isReleased: true,
        releasedAt: new Date('2026-02-01T00:00:00.000Z'),
        activationCount: 4,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      }
    );

    render(<ProfileScreen />);

    expect(screen.getByTestId('vault-cell-active-anchor')).toBeTruthy();
    expect(screen.getByTestId('vault-cell-released-anchor')).toBeTruthy();
    expect(screen.queryByTestId('vault-burned-overlay-active-anchor')).toBeNull();
    expect(screen.getByTestId('vault-burned-overlay-released-anchor')).toBeTruthy();
  });
});
