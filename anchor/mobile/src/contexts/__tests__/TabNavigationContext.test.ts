const { dispatchPendingPracticeRoute } = jest.requireActual('../TabNavigationContext') as typeof import('../TabNavigationContext');

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
