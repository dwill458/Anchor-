/**
 * Privacy boundaries for the E and F Chart surfaces.
 *
 * User-authored text and provider internals must never reach the rendered
 * review screen, analytics, logs, or the practice navigation payload.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  return {
    __mockNavigation: navigation,
    useNavigation: () => navigation,
    useRoute: () => ({ params: { courseId: null, proposalId: 'proposal-1' } }),
  };
});
jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: { getCoursePlan: jest.fn(), acceptCoursePlan: jest.fn() },
  getChartErrorCode: jest.fn(),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: jest.fn() }));

import AIPlanReviewScreen from '../AIPlanReviewScreen';
import { normalizeChartPracticeContext } from '@/types/practice';

const mockGetCoursePlan = jest.requireMock('@/services/ChartApiClient').chartApiClient
  .getCoursePlan as jest.Mock;
const mockUseCourseStore = jest.requireMock('@/stores/courseStore').useCourseStore as jest.Mock;

const proposal = {
  proposalId: 'proposal-1',
  courseId: null,
  baseCourseVersion: null,
  plannerVersion: '1',
  modelVersion: 'gemini-2.0-flash',
  inputHash: 'e3b0c44298fc1c149afbf4c8996fb924',
  generationSource: 'gemini' as const,
  fallbackReason: null,
  destinationInterpretation: 'Finish a portfolio',
  waypoints: [
    {
      clientKey: 'key-1',
      title: 'Clarify the target',
      description: 'Define a useful result.',
    },
  ],
  createdAt: '2026-08-03T00:00:00.000Z',
  expiresAt: '2026-08-03T00:30:00.000Z',
};

describe('AI plan review privacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCourseStore.mockReturnValue({
      offline: false,
      flags: { chart_write_enabled: true },
      refresh: jest.fn(),
    });
    mockGetCoursePlan.mockResolvedValue({ data: proposal });
  });

  it('renders no provider identity, hashes, or raw JSON', async () => {
    const screen = render(<AIPlanReviewScreen />);
    await waitFor(() => expect(screen.getByText('Finish a portfolio')).toBeTruthy());

    for (const secret of [
      'gemini-2.0-flash',
      'gemini',
      proposal.inputHash,
      'proposal-1',
      'plannerVersion',
      'modelVersion',
      'clientKey',
      'key-1',
    ]) {
      expect(screen.queryByText(secret)).toBeNull();
    }
  });

  it('describes a deterministic fallback without naming the provider or the reason code', async () => {
    mockGetCoursePlan.mockResolvedValue({
      data: {
        ...proposal,
        generationSource: 'deterministic_fallback',
        fallbackReason: 'timeout',
        modelVersion: 'deterministic-v1',
      },
    });

    const screen = render(<AIPlanReviewScreen />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'A simple planning outline is shown because a suggested plan was not available.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('timeout')).toBeNull();
    expect(screen.queryByText('deterministic-v1')).toBeNull();
    expect(screen.queryByText('deterministic_fallback')).toBeNull();
  });
});

describe('Chart practice context privacy', () => {
  it('drops every field that is not a frozen identifier', () => {
    const context = normalizeChartPracticeContext({
      courseId: 'course-1',
      waypointId: 'waypoint-1',
      courseVersion: 3,
      // None of these may survive the boundary.
      destinationText: 'my private destination',
      intention: 'my private intention',
      reflection: 'my private reflection',
      notes: 'practice notes',
      waypointTitle: 'a waypoint title',
    });

    expect(context).not.toBeNull();
    const serialized = JSON.stringify(context);
    for (const secret of [
      'my private destination',
      'my private intention',
      'my private reflection',
      'practice notes',
      'a waypoint title',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(Object.keys(context!).sort()).toEqual(['courseId', 'courseVersion', 'waypointId']);
  });
});
