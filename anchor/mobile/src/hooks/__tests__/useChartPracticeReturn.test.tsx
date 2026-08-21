import { act, renderHook } from '@testing-library/react-native';

const mockNavigateToChart = jest.fn();
const mockNavigateToPractice = jest.fn();
const mockAuthState: { user: any } = { user: null };

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToChart: mockNavigateToChart,
    navigateToPractice: mockNavigateToPractice,
  }),
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));
jest.mock('@/services/ChartAnchorHandoffService', () => ({
  finishChartAnchorPracticeHandoff: jest.fn(),
}));

import { useChartPracticeReturn } from '../useChartPracticeReturn';

const mockFinishAnchorHandoff = jest.requireMock(
  '@/services/ChartAnchorHandoffService',
).finishChartAnchorPracticeHandoff as jest.Mock;

const completedReturn = {
  returnTo: 'chart' as const,
  chartContext: { courseId: 'course-1', waypointId: 'waypoint-1', courseVersion: 3 },
  practiceReturn: {
    outcome: 'completed' as const,
    practiceSessionId: 'session-1',
    practiceMode: 'focus' as const,
    anchorId: 'anchor-1',
  },
};

describe('useChartPracticeReturn access gate', () => {
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
    mockAuthState.user = {
      chartFlags: { chart_enabled: true },
      chartCapabilities: { canViewChart: true },
    };
  });

  it('falls back to Practice when Chart capability was revoked during the session', () => {
    mockAuthState.user.chartCapabilities = { canViewChart: false };
    const navigation = { popToTop: jest.fn() };
    const { result } = renderHook(() => useChartPracticeReturn(navigation));

    act(() => {
      expect(result.current(completedReturn)).toBe(true);
    });

    expect(mockNavigateToPractice).toHaveBeenCalledTimes(1);
    expect(mockNavigateToChart).not.toHaveBeenCalled();
    expect(mockFinishAnchorHandoff).toHaveBeenCalledWith('course-1', 'waypoint-1', 'anchor-1');
  });

  it('returns an authorized completed session to the exact waypoint', () => {
    const navigation = { popToTop: jest.fn() };
    const { result } = renderHook(() => useChartPracticeReturn(navigation));

    act(() => {
      expect(result.current(completedReturn)).toBe(true);
    });

    expect(mockNavigateToChart).toHaveBeenCalledWith('WaypointDetail', {
      courseId: 'course-1',
      waypointId: 'waypoint-1',
      practiceReturn: completedReturn.practiceReturn,
    });
    expect(mockFinishAnchorHandoff).toHaveBeenCalledWith('course-1', 'waypoint-1', 'anchor-1');
  });
});
