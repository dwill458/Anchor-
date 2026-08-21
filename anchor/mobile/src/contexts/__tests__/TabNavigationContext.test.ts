import React from 'react';
import { act, render } from '@testing-library/react-native';

const {
  dispatchPendingPracticeRoute,
  TabNavigationProvider,
  useTabNavigation,
} = jest.requireActual('../TabNavigationContext') as typeof import('../TabNavigationContext');

const mockPracticeNavigation = {
  navigate: jest.fn(),
  push: jest.fn(),
  popToTop: jest.fn(),
};

describe('dispatchPendingPracticeRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses the PracticeHome root when a request arrives before the tab mounts', () => {
    dispatchPendingPracticeRoute(mockPracticeNavigation, {
      screen: 'PracticeHome',
      params: { anchorId: 'anchor-1' },
    });

    expect(mockPracticeNavigation.navigate).toHaveBeenCalledWith('PracticeHome', {
      anchorId: 'anchor-1',
    });
    expect(mockPracticeNavigation.push).not.toHaveBeenCalled();
  });

  it('pushes non-root practice routes onto the existing stack', () => {
    dispatchPendingPracticeRoute(mockPracticeNavigation, {
      screen: 'ChargeSetup',
      params: { anchorId: 'anchor-1' },
    });

    expect(mockPracticeNavigation.push).toHaveBeenCalledWith('ChargeSetup', {
      anchorId: 'anchor-1',
    });
    expect(mockPracticeNavigation.navigate).not.toHaveBeenCalled();
  });
});

describe('TabNavigationProvider Chart capability boundary', () => {
  let latestContext: ReturnType<typeof useTabNavigation> | null;

  const CaptureContext = () => {
    latestContext = useTabNavigation();
    return null;
  };

  beforeEach(() => {
    latestContext = null;
    jest.clearAllMocks();
  });

  it('drops a queued Chart route when capability is revoked before the stack mounts', () => {
    const onIndexChange = jest.fn();
    const onNavigateToPaywall = jest.fn();
    const renderTree = (chartAvailable: boolean) => React.createElement(
      TabNavigationProvider,
      {
        onIndexChange,
        onNavigateToPaywall,
        activeIndex: 0,
        chartAvailable,
        children: React.createElement(CaptureContext),
      },
    );
    const view = render(renderTree(true));

    act(() => {
      latestContext?.navigateToChart('WaypointDetail', {
        courseId: 'course-a',
        waypointId: 'waypoint-a',
      });
    });
    expect(onIndexChange).toHaveBeenCalledWith(2);

    view.rerender(renderTree(false));
    const chartNavigation = { navigate: jest.fn(), push: jest.fn(), popToTop: jest.fn() };
    act(() => latestContext?.registerTabNav(2, chartNavigation));

    view.rerender(renderTree(true));
    act(() => latestContext?.registerTabNav(2, chartNavigation));
    expect(chartNavigation.navigate).not.toHaveBeenCalled();
  });

  it('refuses new Chart navigation while unavailable', () => {
    const onIndexChange = jest.fn();
    const onNavigateToPaywall = jest.fn();
    render(React.createElement(
      TabNavigationProvider,
      {
        onIndexChange,
        onNavigateToPaywall,
        activeIndex: 1,
        chartAvailable: false,
        children: React.createElement(CaptureContext),
      },
    ));

    act(() => {
      latestContext?.navigateToChart('CourseDetails', { courseId: 'course-a' });
    });

    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('returns an already-selected revoked Chart tab to Sanctuary', () => {
    const onIndexChange = jest.fn();
    render(React.createElement(
      TabNavigationProvider,
      {
        onIndexChange,
        onNavigateToPaywall: jest.fn(),
        activeIndex: 2,
        chartAvailable: false,
        children: React.createElement(CaptureContext),
      },
    ));

    act(() => latestContext?.navigateToChart());

    expect(onIndexChange).toHaveBeenCalledWith(0);
  });
});
