import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockNavigateToPractice = jest.fn();
const mockNavigateToChart = jest.fn();
const mockNavigateToVault = jest.fn();
const mockStartPractice = jest.fn();
const mockResumeState = {
  consumeChartDeepLink: jest.fn(),
  consumeTarget: jest.fn(),
};
const mockAuthState: { user: any } = { user: null };

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToPractice: mockNavigateToPractice,
    navigateToChart: mockNavigateToChart,
    navigateToVault: mockNavigateToVault,
  }),
}));
jest.mock('@/hooks/usePracticeEntry', () => ({
  usePracticeEntry: () => ({ startPractice: mockStartPractice }),
}));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ getAnchorById: jest.fn() }) },
}));
jest.mock('@/stores/navigationResumeStore', () => ({
  useNavigationResumeStore: { getState: () => mockResumeState },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));
jest.mock('@/config', () => ({ ENABLE_VISUALIZE: false }));

import { ResumeTargetHandler } from '../ResumeTargetHandler';

describe('ResumeTargetHandler Chart capability gate', () => {
  const previousBuildFlag = process.env.EXPO_PUBLIC_ENABLE_CHART;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_ENABLE_CHART = 'true';
  });

  afterAll(() => {
    if (previousBuildFlag === undefined) delete process.env.EXPO_PUBLIC_ENABLE_CHART;
    else process.env.EXPO_PUBLIC_ENABLE_CHART = previousBuildFlag;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockResumeState.consumeTarget.mockReturnValue(null);
    mockAuthState.user = {
      chartFlags: { chart_enabled: true },
      chartCapabilities: { canViewChart: true },
    };
  });

  it('routes a Chart deep link to the safe fallback when capability is denied', async () => {
    mockAuthState.user.chartCapabilities = { canViewChart: false };
    mockResumeState.consumeChartDeepLink.mockReturnValue({
      kind: 'waypoint',
      courseId: 'course-1',
      waypointId: 'waypoint-1',
    });

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToVault).toHaveBeenCalledTimes(1));
    expect(mockNavigateToChart).not.toHaveBeenCalled();
  });

  it('restores the exact Chart target when both flag and capability allow access', async () => {
    mockResumeState.consumeChartDeepLink.mockReturnValue({
      kind: 'waypoint',
      courseId: 'course-1',
      waypointId: 'waypoint-1',
    });

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToChart).toHaveBeenCalledWith('WaypointDetail', {
      courseId: 'course-1',
      waypointId: 'waypoint-1',
    }));
    expect(mockNavigateToVault).not.toHaveBeenCalled();
  });
});
