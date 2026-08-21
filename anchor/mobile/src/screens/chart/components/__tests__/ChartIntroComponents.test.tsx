import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigateToChart = jest.fn();
const mockTrack = jest.fn();
let mockAuthState: any;
let mockJourneyState: any;
let mockAnchorState: any;
let mockSelectorAnchors: any[] = [];

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({ navigateToChart: mockNavigateToChart }),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...args: unknown[]) => mockTrack(...args) },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: any) => unknown) => selector(mockAuthState),
    { getState: () => mockAuthState },
  ),
}));

jest.mock('@/stores/chartJourneyStore', () => ({
  useChartJourneyStore: Object.assign(
    (selector: (state: any) => unknown) => selector(mockJourneyState),
    { getState: () => mockJourneyState },
  ),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector(mockAnchorState),
}));

jest.mock('@/screens/practice/components/AnchorSelectorSheet', () => {
  const mockReact = require('react');
  const { Pressable: MockPressable, Text: MockText } = require('react-native');

  return {
    AnchorSelectorSheet: ({ visible, anchors, onSelect }: any) => {
      mockSelectorAnchors = anchors;
      if (!visible || !anchors[0]) return null;
      return mockReact.createElement(
        MockPressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: `Select ${anchors[0].intentionText}`,
          onPress: () => onSelect(anchors[0]),
        },
        mockReact.createElement(MockText, null, anchors[0].intentionText),
      );
    },
  };
});

jest.mock('../../chartUi', () => {
  const mockReact = require('react');
  const { Pressable: MockPressable, Text: MockText } = require('react-native');
  const MockButton = ({ label, onPress, disabled }: any) => mockReact.createElement(
    MockPressable,
    {
      accessibilityRole: 'button',
      accessibilityLabel: label,
      disabled,
      onPress,
    },
    mockReact.createElement(MockText, null, label),
  );

  return {
    ChartButton: MockButton,
    ChartGhostButton: MockButton,
  };
});

import { ChartFirstJourneyInvitation } from '../ChartFirstJourneyInvitation';
import { ExistingUserChartIntro } from '../ExistingUserChartIntro';

describe('Chart introduction flows', () => {
  const previousBuildFlag = process.env.EXPO_PUBLIC_ENABLE_CHART;
  const navigation = { navigate: jest.fn() };

  beforeAll(() => {
    process.env.EXPO_PUBLIC_ENABLE_CHART = 'true';
  });

  afterAll(() => {
    if (previousBuildFlag === undefined) delete process.env.EXPO_PUBLIC_ENABLE_CHART;
    else process.env.EXPO_PUBLIC_ENABLE_CHART = previousBuildFlag;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectorAnchors = [];
    mockAuthState = {
      user: {
        id: 'account-1',
        chartFlags: { chart_enabled: true },
        chartCapabilities: { canViewChart: true },
      },
    };
    mockJourneyState = {
      accountId: 'account-1',
      firstAnchorId: 'anchor-first',
      resolveNewUserIntro: jest.fn(),
      resolveExistingUserIntro: jest.fn(),
    };
    mockAnchorState = {
      anchors: [
        {
          id: 'anchor-live',
          intentionText: 'Protect the work that matters',
          isReleased: false,
          archivedAt: null,
          privateDisplayData: 'must not cross navigation',
        },
        {
          id: 'anchor-released',
          intentionText: 'Released intention',
          isReleased: true,
          archivedAt: null,
        },
        {
          id: 'anchor-archived',
          intentionText: 'Archived intention',
          isReleased: false,
          archivedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    };
  });

  it('presents the new-user invitation in two steps and sends only the seed Anchor ID to setup', async () => {
    const onContinue = jest.fn();
    const onCourseSelected = jest.fn();
    const screen = render(
      <ChartFirstJourneyInvitation
        visible
        onContinue={onContinue}
        onCourseSelected={onCourseSelected}
      />,
    );

    expect(screen.getByText('One intention now has a form.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Chart a Course'));

    expect(screen.getByText('Some intentions are destinations.')).toBeTruthy();
    expect(mockNavigateToChart).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Chart a Course'));

    expect(mockJourneyState.resolveNewUserIntro).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    await waitFor(() => expect(mockNavigateToChart).toHaveBeenCalledWith('CourseSetup', {
      seedAnchorId: 'anchor-first',
    }));
    expect(onCourseSelected).toHaveBeenCalledTimes(1);
    expect(onCourseSelected.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigateToChart.mock.invocationCallOrder[0],
    );
    const routeParams = mockNavigateToChart.mock.calls[0][1];
    expect(Object.keys(routeParams)).toEqual(['seedAnchorId']);
  });

  it('resolves the new-user invitation and continues when Maybe later is chosen', async () => {
    const onContinue = jest.fn();
    const screen = render(
      <ChartFirstJourneyInvitation visible onContinue={onContinue} />,
    );

    fireEvent.press(screen.getByLabelText('Maybe later'));

    expect(mockJourneyState.resolveNewUserIntro).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect(mockNavigateToChart).not.toHaveBeenCalled();
  });

  it('resolves and continues when the Anchor remains standalone on step two', async () => {
    const onContinue = jest.fn();
    const screen = render(
      <ChartFirstJourneyInvitation visible onContinue={onContinue} />,
    );

    fireEvent.press(screen.getByLabelText('Chart a Course'));
    fireEvent.press(screen.getByLabelText('Keep this as a standalone Anchor'));

    expect(mockJourneyState.resolveNewUserIntro).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect(mockNavigateToChart).not.toHaveBeenCalled();
  });

  it('does not let an in-flight account-A invitation resolve into or navigate account B', async () => {
    let finishAccountAResolution!: () => void;
    const accountAResolution = new Promise<void>((resolve) => {
      finishAccountAResolution = resolve;
    });
    const resolveAccountA = jest.fn(() => accountAResolution);
    const resolveAccountB = jest.fn();
    mockJourneyState.resolveNewUserIntro = resolveAccountA;
    const onContinue = jest.fn();
    const onCourseSelected = jest.fn();
    const screen = render(
      <ChartFirstJourneyInvitation
        visible
        onContinue={onContinue}
        onCourseSelected={onCourseSelected}
      />,
    );

    fireEvent.press(screen.getByLabelText('Chart a Course'));
    fireEvent.press(screen.getByLabelText('Chart a Course'));
    expect(resolveAccountA).toHaveBeenCalledTimes(1);

    mockAuthState = {
      user: {
        id: 'account-2',
        chartFlags: { chart_enabled: true },
        chartCapabilities: { canViewChart: true },
      },
    };
    mockJourneyState = {
      accountId: 'account-2',
      firstAnchorId: 'anchor-account-2',
      resolveNewUserIntro: resolveAccountB,
      resolveExistingUserIntro: jest.fn(),
    };
    screen.rerender(
      <ChartFirstJourneyInvitation
        visible
        onContinue={onContinue}
        onCourseSelected={onCourseSelected}
      />,
    );

    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    finishAccountAResolution();
    await accountAResolution;
    await waitFor(() => expect(resolveAccountA).toHaveBeenCalledTimes(1));
    expect(resolveAccountB).not.toHaveBeenCalled();
    expect(onCourseSelected).not.toHaveBeenCalled();
    expect(mockNavigateToChart).not.toHaveBeenCalled();
  });

  it('still completes the new-user route when resolving the milestone hides its parent first', async () => {
    let finishResolution!: () => void;
    const resolution = new Promise<void>((resolve) => {
      finishResolution = resolve;
    });
    mockJourneyState.resolveNewUserIntro = jest.fn(() => resolution);
    const onCourseSelected = jest.fn();
    const screen = render(
      <ChartFirstJourneyInvitation
        visible
        onContinue={jest.fn()}
        onCourseSelected={onCourseSelected}
      />,
    );

    fireEvent.press(screen.getByLabelText('Chart a Course'));
    fireEvent.press(screen.getByLabelText('Chart a Course'));
    screen.rerender(
      <ChartFirstJourneyInvitation
        visible={false}
        onContinue={jest.fn()}
        onCourseSelected={onCourseSelected}
      />,
    );

    finishResolution();
    await resolution;
    await waitFor(() => expect(onCourseSelected).toHaveBeenCalledTimes(1));
    expect(mockNavigateToChart).toHaveBeenCalledWith('CourseSetup', {
      seedAnchorId: 'anchor-first',
    });
  });

  it('keeps the existing-user introduction hidden until visible and resolves dismissal', () => {
    const screen = render(
      <ExistingUserChartIntro visible={false} navigation={navigation as any} />,
    );

    expect(screen.queryByText('Turn what matters into a path forward.')).toBeNull();

    screen.rerender(
      <ExistingUserChartIntro visible navigation={navigation as any} />,
    );
    expect(screen.getByText('Turn what matters into a path forward.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Not now'));

    expect(mockJourneyState.resolveExistingUserIntro).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('routes an explicit selector choice with only seed context and never a silent link payload', async () => {
    const screen = render(
      <ExistingUserChartIntro visible navigation={navigation as any} />,
    );

    expect(mockSelectorAnchors.map((anchor) => anchor.id)).toEqual(['anchor-live']);
    fireEvent.press(screen.getByLabelText('Use an Existing Anchor'));
    fireEvent.press(screen.getByLabelText('Select Protect the work that matters'));

    expect(mockJourneyState.resolveExistingUserIntro).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CourseSetup', {
      seedAnchorId: 'anchor-live',
    }));
    const routeParams = navigation.navigate.mock.calls[0][1];
    expect(Object.keys(routeParams)).toEqual(['seedAnchorId']);
    expect(routeParams).not.toHaveProperty('anchor');
    expect(routeParams).not.toHaveProperty('linkAnchor');
  });

  it('still completes an existing-user route when milestone resolution hides the intro first', async () => {
    let finishResolution!: () => void;
    const resolution = new Promise<void>((resolve) => {
      finishResolution = resolve;
    });
    mockJourneyState.resolveExistingUserIntro = jest.fn(() => resolution);
    const screen = render(
      <ExistingUserChartIntro visible navigation={navigation as any} />,
    );

    fireEvent.press(screen.getByLabelText('Plot a New Destination'));
    screen.rerender(
      <ExistingUserChartIntro visible={false} navigation={navigation as any} />,
    );
    finishResolution();
    await resolution;

    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CourseSetup'));
  });

  it('drops account-A selector state and blocks its pending navigation before allowing a fresh B intro', async () => {
    let finishAccountAResolution!: () => void;
    const accountAResolution = new Promise<void>((resolve) => {
      finishAccountAResolution = resolve;
    });
    const resolveAccountA = jest.fn(() => accountAResolution);
    const resolveAccountB = jest.fn();
    mockJourneyState.resolveExistingUserIntro = resolveAccountA;
    const screen = render(
      <ExistingUserChartIntro visible navigation={navigation as any} />,
    );

    fireEvent.press(screen.getByLabelText('Use an Existing Anchor'));
    fireEvent.press(screen.getByLabelText('Select Protect the work that matters'));
    expect(resolveAccountA).toHaveBeenCalledTimes(1);

    mockAuthState = {
      user: {
        id: 'account-2',
        chartFlags: { chart_enabled: true },
        chartCapabilities: { canViewChart: true },
      },
    };
    mockJourneyState = {
      accountId: 'account-2',
      firstAnchorId: null,
      resolveNewUserIntro: jest.fn(),
      resolveExistingUserIntro: resolveAccountB,
    };
    screen.rerender(
      <ExistingUserChartIntro visible navigation={navigation as any} />,
    );
    expect(screen.queryByLabelText('Select Protect the work that matters')).toBeNull();

    finishAccountAResolution();
    await accountAResolution;
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(resolveAccountB).not.toHaveBeenCalled();

    // A real visibility transition starts a new, account-B-owned intro.
    screen.rerender(
      <ExistingUserChartIntro visible={false} navigation={navigation as any} />,
    );
    screen.rerender(
      <ExistingUserChartIntro visible navigation={navigation as any} />,
    );
    fireEvent.press(screen.getByLabelText('Plot a New Destination'));

    await waitFor(() => expect(resolveAccountB).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CourseSetup'));
  });
});
