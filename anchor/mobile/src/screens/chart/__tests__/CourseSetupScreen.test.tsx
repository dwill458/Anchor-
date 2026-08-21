import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigation = { navigate: jest.fn(), replace: jest.fn() };
let mockRouteParams: Record<string, string> = {};
let mockCourseStore: any;
let mockJourney: any;
let mockAuthState: any;
let mockReduceMotion = false;
const mockCreateManualCourse = jest.fn();
const mockPublishCourse = jest.fn();
const mockBindAccount = jest.fn();
const mockUpdateSetupDraft = jest.fn();
const mockReplaceSetupDraft = jest.fn();
const mockClearSetupDraft = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'course-setup-route', params: mockRouteParams }),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: () => mockCourseStore }));
jest.mock('@/stores/chartJourneyStore', () => ({
  useChartJourneyStore: Object.assign(
    () => mockJourney,
    { getState: () => mockJourney },
  ),
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: any) => unknown) => selector(mockAuthState),
    { getState: () => mockAuthState },
  ),
}));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector({ getAnchorById: jest.fn() }),
}));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));
jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: {
    getCoursePlan: jest.fn(),
    getCoursePlanQuota: jest.fn(),
    generateCoursePlan: jest.fn(),
  },
  getChartErrorCode: jest.fn(),
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    COURSE_SETUP_STARTED: 'course_setup_started',
    MANUAL_COURSE_CREATION_REQUESTED: 'manual_course_creation_requested',
    MANUAL_COURSE_CREATED: 'manual_course_created',
    CHART_PLANNER_GENERATION_REQUESTED: 'planner_generation_requested',
    CHART_PLANNER_GENERATION_SUCCEEDED: 'planner_generation_succeeded',
    CHART_PLANNER_FALLBACK_USED: 'planner_fallback_used',
    CHART_PLANNER_GENERATION_DENIED: 'planner_generation_denied',
    CHART_PLANNER_QUOTA_REACHED: 'planner_quota_reached',
  },
  trackChartEventOnce: jest.fn(),
}));
jest.mock('../components/CoursePlotting', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return { CoursePlotting: () => ReactModule.createElement(Text, null, 'Plotting Course') };
});
jest.mock('../chartUi', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  const button = ({ label, onPress, disabled }: any) => ReactModule.createElement(
    Pressable,
    { accessibilityRole: 'button', accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress },
    ReactModule.createElement(Text, null, label),
  );
  return {
    ChartScreenFrame: ({ title, subtitle, children }: any) => ReactModule.createElement(View, null,
      ReactModule.createElement(Text, null, title),
      subtitle ? ReactModule.createElement(Text, null, subtitle) : null,
      children,
    ),
    ChartButton: button,
    ChartCard: ({ children }: any) => ReactModule.createElement(View, null, children),
    ReadOnlyNotice: ({ reason }: any) => ReactModule.createElement(Text, null, reason),
  };
});

import CourseSetupScreen from '../CourseSetupScreen';

const chartApi = jest.requireMock('@/services/ChartApiClient').chartApiClient as {
  getCoursePlan: jest.Mock;
  getCoursePlanQuota: jest.Mock;
  generateCoursePlan: jest.Mock;
};

const draftCourse = {
  id: 'course-1',
  destinationText: 'Publish a meaningful portfolio',
  startingContext: 'Two complete pieces',
  status: 'DRAFT',
  version: 1,
  currentWaypointId: null,
  waypointCount: 0,
  reachedCount: 0,
  plottedAt: '2026-08-21T12:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
  waypoints: [],
};

const proposal = {
  proposalId: 'proposal-1',
  courseId: null,
  baseCourseVersion: null,
  plannerVersion: '1',
  modelVersion: 'model-1',
  inputHash: 'hash',
  generationSource: 'gemini',
  fallbackReason: null,
  destinationInterpretation: 'Publish a meaningful portfolio',
  startingContext: 'Two complete pieces and no publishing rhythm',
  waypoints: [{ clientKey: 'wp-1', title: 'Choose the final pieces', description: 'Select work that supports the story.' }],
  createdAt: '2026-08-21T12:00:00.000Z',
  expiresAt: '2026-08-21T12:30:00.000Z',
};

function journeyState(overrides: Record<string, unknown> = {}) {
  return {
    accountId: 'account-1',
    hydrated: true,
    setupDraft: null,
    bindAccount: mockBindAccount,
    updateSetupDraft: mockUpdateSetupDraft,
    replaceSetupDraft: mockReplaceSetupDraft,
    clearSetupDraft: mockClearSetupDraft,
    ...overrides,
  };
}

function storeState(overrides: Record<string, unknown> = {}) {
  return {
    offline: false,
    readOnly: false,
    errorCode: null,
    flags: { chart_ai_planner_enabled: false, chart_write_enabled: true },
    createManualCourse: mockCreateManualCourse,
    publishCourse: mockPublishCourse,
    ...overrides,
  };
}

async function waitForRestore(screen: ReturnType<typeof render>) {
  await waitFor(() => expect(screen.queryByText('Restoring your Course draft…')).toBeNull());
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('CourseSetupScreen progressive setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockReduceMotion = false;
    mockAuthState = { user: { id: 'account-1' } };
    mockJourney = journeyState();
    mockCourseStore = storeState();
    mockCreateManualCourse.mockResolvedValue(draftCourse);
    mockPublishCourse.mockResolvedValue(null);
    chartApi.getCoursePlan.mockResolvedValue({ data: proposal });
    chartApi.getCoursePlanQuota.mockResolvedValue({
      data: { eligible: true, limit: 3, remaining: 2, resetAt: null, reason: null },
    });
    chartApi.generateCoursePlan.mockResolvedValue({ data: proposal });
  });

  it('requires a destination before any Course mutation', async () => {
    const screen = render(<CourseSetupScreen />);
    await waitForRestore(screen);

    fireEvent.press(screen.getByLabelText('Save draft'));

    expect(screen.getByText('Destination must be between 1 and 140 characters.')).toBeTruthy();
    expect(mockCreateManualCourse).not.toHaveBeenCalled();
  });

  it('sends optional Current Reality as trimmed authoritative creation input', async () => {
    const screen = render(<CourseSetupScreen />);
    await waitForRestore(screen);
    fireEvent.changeText(screen.getByLabelText('Course destination'), '  Publish a meaningful portfolio  ');
    fireEvent.changeText(screen.getByLabelText('Current reality'), '  Two complete pieces and no publishing rhythm  ');

    fireEvent.press(screen.getByLabelText('Save draft'));

    await waitFor(() => expect(mockCreateManualCourse).toHaveBeenCalledWith(expect.objectContaining({
      destinationText: 'Publish a meaningful portfolio',
      currentReality: 'Two complete pieces and no publishing rhythm',
      idempotencyKey: expect.any(String),
    })));
    expect(mockClearSetupDraft).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CourseEditor', { courseId: 'course-1' });
  });

  it('prefills a validated proposal but submits the user-edited destination, baseline, and waypoints', async () => {
    mockRouteParams = { fromProposalId: 'proposal-1' };
    const screen = render(<CourseSetupScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Publish a meaningful portfolio')).toBeTruthy());
    expect(screen.getByDisplayValue('Two complete pieces and no publishing rhythm')).toBeTruthy();
    expect(screen.getByDisplayValue('Choose the final pieces')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Publish six coherent pieces');
    fireEvent.changeText(screen.getByLabelText('Current reality'), 'Three pieces need revision');
    fireEvent.changeText(screen.getByLabelText('Waypoint 1 title'), 'Revise the strongest three pieces');
    fireEvent.press(screen.getByLabelText('Save draft'));

    await waitFor(() => expect(mockCreateManualCourse).toHaveBeenCalledWith(expect.objectContaining({
      destinationText: 'Publish six coherent pieces',
      currentReality: 'Three pieces need revision',
      fromProposalId: 'proposal-1',
      waypoints: [{ title: 'Revise the strongest three pieces', description: 'Select work that supports the story.' }],
    })));
    expect(mockReplaceSetupDraft).toHaveBeenCalledWith(expect.objectContaining({
      fromProposalId: 'proposal-1',
      destinationText: proposal.destinationInterpretation,
    }));
  });

  it('restores an account-matched setup draft', async () => {
    mockJourney = journeyState({
      setupDraft: {
        destinationText: 'Restore this destination',
        currentReality: 'Restore this baseline',
        waypoints: [{ title: 'Restore this waypoint', description: 'Restored description' }],
        fromProposalId: null,
        seedAnchorId: null,
        updatedAt: '2026-08-21T12:00:00.000Z',
      },
    });
    const screen = render(<CourseSetupScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Restore this destination')).toBeTruthy());
    expect(screen.getByDisplayValue('Restore this baseline')).toBeTruthy();
    expect(screen.getByDisplayValue('Restore this waypoint')).toBeTruthy();
  });

  it('does not flash a setup draft owned by a different account', async () => {
    mockJourney = journeyState({
      accountId: 'other-account',
      setupDraft: {
        destinationText: 'Other account private destination',
        currentReality: 'Other account private baseline',
        waypoints: [],
        fromProposalId: null,
        seedAnchorId: null,
        updatedAt: '2026-08-21T12:00:00.000Z',
      },
    });
    const screen = render(<CourseSetupScreen />);

    await waitFor(() => expect(mockBindAccount).toHaveBeenCalledWith('account-1'));
    expect(screen.queryByDisplayValue('Other account private destination')).toBeNull();
    expect(screen.queryByText('Other account private destination')).toBeNull();
  });

  it('clears account A form state and never persists its pending debounce into account B', async () => {
    mockJourney = journeyState({
      setupDraft: {
        destinationText: 'Account A private destination',
        currentReality: 'Account A private baseline',
        waypoints: [],
        fromProposalId: null,
        seedAnchorId: null,
        updatedAt: '2026-08-21T12:00:00.000Z',
      },
    });
    const screen = render(<CourseSetupScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Account A private destination')).toBeTruthy());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    mockUpdateSetupDraft.mockClear();

    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Account A unsaved private edit');
    mockAuthState = { user: { id: 'account-2' } };
    mockJourney = journeyState({
      accountId: 'account-2',
      setupDraft: {
        destinationText: 'Account B destination',
        currentReality: 'Account B baseline',
        waypoints: [],
        fromProposalId: null,
        seedAnchorId: null,
        updatedAt: '2026-08-21T12:05:00.000Z',
      },
    });
    screen.rerender(<CourseSetupScreen />);

    expect(screen.queryByDisplayValue('Account A unsaved private edit')).toBeNull();
    await waitFor(() => expect(screen.getByDisplayValue('Account B destination')).toBeTruthy());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(mockUpdateSetupDraft).not.toHaveBeenCalledWith(expect.objectContaining({
      destinationText: 'Account A unsaved private edit',
    }));
  });

  it('discards an account A proposal response that resolves after switching to account B', async () => {
    mockRouteParams = { fromProposalId: 'proposal-account-a' };
    const pendingProposal = deferred<{ data: typeof proposal }>();
    chartApi.getCoursePlan.mockReturnValueOnce(pendingProposal.promise);
    const screen = render(<CourseSetupScreen />);
    await waitFor(() => expect(chartApi.getCoursePlan).toHaveBeenCalledWith('proposal-account-a'));

    mockAuthState = { user: { id: 'account-2' } };
    mockJourney = journeyState({
      accountId: 'account-2',
      setupDraft: {
        destinationText: 'Account B restored destination',
        currentReality: '',
        waypoints: [],
        fromProposalId: null,
        seedAnchorId: null,
        updatedAt: '2026-08-21T12:05:00.000Z',
      },
    });
    screen.rerender(<CourseSetupScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Account B restored destination')).toBeTruthy());

    await act(async () => {
      pendingProposal.resolve({ data: proposal });
      await pendingProposal.promise;
    });

    expect(screen.queryByDisplayValue(proposal.destinationInterpretation)).toBeNull();
    expect(mockReplaceSetupDraft).not.toHaveBeenCalledWith(expect.objectContaining({
      destinationText: proposal.destinationInterpretation,
    }));
  });

  it('does not navigate account B with an account A planner result', async () => {
    mockReduceMotion = true;
    mockCourseStore = storeState({ flags: { chart_ai_planner_enabled: true, chart_write_enabled: true } });
    const pendingPlan = deferred<{ data: typeof proposal }>();
    chartApi.generateCoursePlan.mockReturnValueOnce(pendingPlan.promise);
    const screen = render(<CourseSetupScreen />);
    await waitForRestore(screen);
    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Account A private destination');
    fireEvent.press(screen.getByLabelText('Generate suggested plan'));
    await waitFor(() => expect(chartApi.generateCoursePlan).toHaveBeenCalled());

    mockAuthState = { user: { id: 'account-2' } };
    mockJourney = journeyState({ accountId: 'account-2' });
    screen.rerender(<CourseSetupScreen />);
    mockNavigation.navigate.mockClear();

    await act(async () => {
      pendingPlan.resolve({ data: proposal });
      await pendingPlan.promise;
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('AIPlanReview', expect.anything());
    expect(screen.queryByText('Plotting Course')).toBeNull();
  });

  it('does not clear account B setup state when account A save resolves late', async () => {
    const pendingSave = deferred<typeof draftCourse>();
    mockCreateManualCourse.mockReturnValueOnce(pendingSave.promise);
    const screen = render(<CourseSetupScreen />);
    await waitForRestore(screen);
    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Account A save in flight');
    fireEvent.press(screen.getByLabelText('Save draft'));
    await waitFor(() => expect(mockCreateManualCourse).toHaveBeenCalled());

    mockAuthState = { user: { id: 'account-2' } };
    mockJourney = journeyState({ accountId: 'account-2' });
    screen.rerender(<CourseSetupScreen />);
    mockClearSetupDraft.mockClear();
    mockNavigation.navigate.mockClear();

    await act(async () => {
      pendingSave.resolve(draftCourse);
      await pendingSave.promise;
    });

    expect(mockClearSetupDraft).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('CourseEditor', expect.anything());
  });

  it('moves directly to proposal review under Reduce Motion without the ceremony delay', async () => {
    mockReduceMotion = true;
    mockCourseStore = storeState({ flags: { chart_ai_planner_enabled: true, chart_write_enabled: true } });
    const screen = render(<CourseSetupScreen />);
    await waitForRestore(screen);
    await waitFor(() => expect(chartApi.getCoursePlanQuota).toHaveBeenCalled());
    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Publish a meaningful portfolio');

    fireEvent.press(screen.getByLabelText('Generate suggested plan'));

    await waitFor(() => expect(mockNavigation.navigate).toHaveBeenCalledWith('AIPlanReview', {
      courseId: null,
      proposalId: 'proposal-1',
    }));
  });
});
