import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { V2ProgressScreen } from '../V2ProgressScreen';
import { useV2Progress } from '@/hooks/v2/progress';
import type { V2ProgressModel } from '@/adapters/v2/progress';

jest.mock('@/hooks/v2/progress');
const mockUseV2Progress = useV2Progress as jest.MockedFunction<typeof useV2Progress>;

describe('V2ProgressScreen', () => {
  const mockModel: V2ProgressModel = {
    anchorId: 'anchor-progress-1',
    intention: 'Build lasting clarity and momentum',
    category: 'Creativity',
    threadStrength: 65,
    unmeasured: false,
    qualitativeLabel: 'Rooted',
    highestEvolutionStage: 'Rooted',
    practiceSummary: {
      focusCount: 5,
      focusSeconds: 1500,
      deepPrimeCount: 3,
      deepPrimeSeconds: 540,
      visualizeCount: 2,
      visualizeSeconds: 300,
      releaseCount: 0,
      releaseSeconds: 0,
      totalSessions: 10,
      totalDurationSeconds: 2340,
    },
    waypointsReachedCount: 3,
    events: [
      {
        id: 'evt-1',
        type: 'WAYPOINT_REACHED',
        title: 'Prototype Validated',
        copy: 'Milestone reached on your route.',
        why: 'Real-world milestone confirmed.',
        significance: 'HIGH',
        occurredAt: '2026-08-15T12:00:00.000Z',
        formattedDate: 'Aug 15',
        formattedTime: '12:00 PM',
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        waypointTitle: 'Prototype Validated',
        sourceDomain: 'COURSE_EVENT',
      },
      {
        id: 'evt-2',
        type: 'EVOLUTION_STAGE_REACHED',
        title: 'Rooted reached',
        copy: 'Your Anchor reached its permanent structural stage: Rooted.',
        why: 'Meaningful reinforcement held across time.',
        significance: 'HIGH',
        occurredAt: '2026-08-10T09:00:00.000Z',
        formattedDate: 'Aug 10',
        formattedTime: '9:00 AM',
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        stageName: 'Rooted',
        sourceDomain: 'THREAD_ENGINE',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when loading without model', () => {
    mockUseV2Progress.mockReturnValue({
      model: null,
      loading: true,
      error: null,
      selectedEvent: null,
      setSelectedEvent: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByTestId, getByText } = render(<V2ProgressScreen anchorId="anchor-1" />);
    expect(getByTestId('v2-progress-screen-loading')).toBeTruthy();
    expect(getByText('Gathering verifiable evidence...')).toBeTruthy();
  });

  it('renders progress hero, evidence summary, and timeline without The Weave', () => {
    mockUseV2Progress.mockReturnValue({
      model: mockModel,
      loading: false,
      error: null,
      selectedEvent: null,
      setSelectedEvent: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByTestId, getByText, getAllByText, queryByText } = render(
      <V2ProgressScreen anchorId="anchor-progress-1" />,
    );

    // Renders intention & thread strength
    expect(getByText('Build lasting clarity and momentum')).toBeTruthy();
    expect(getByText('65')).toBeTruthy();
    expect(getAllByText('Rooted').length).toBeGreaterThanOrEqual(1);

    // Renders evidence summary
    expect(getByTestId('v2-progress-screen-summary')).toBeTruthy();
    expect(getByText('10')).toBeTruthy(); // total practice sessions
    expect(getByText('3')).toBeTruthy(); // waypoints count

    // Renders thread events
    expect(getByTestId('v2-progress-screen-timeline')).toBeTruthy();
    expect(getByText('Prototype Validated')).toBeTruthy();
    expect(getByText('Rooted reached')).toBeTruthy();

    // Critical assertion: The Weave must NOT exist
    expect(queryByText(/the weave/i)).toBeNull();
  });

  it('does not fabricate thread delta when server value is null', () => {
    mockUseV2Progress.mockReturnValue({
      model: mockModel,
      loading: false,
      error: null,
      selectedEvent: mockModel.events[0], // Event with authoritativeDelta = null
      setSelectedEvent: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByTestId, getByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
    expect(getByTestId('v2-progress-screen-event-detail')).toBeTruthy();
    expect(getByText('No server delta recorded for this event.')).toBeTruthy();
  });

  it('calls onNavigateToChart and onNavigateToVision shortcuts', () => {
    mockUseV2Progress.mockReturnValue({
      model: mockModel,
      loading: false,
      error: null,
      selectedEvent: null,
      setSelectedEvent: jest.fn(),
      refresh: jest.fn(),
    });

    const onNavigateToChart = jest.fn();
    const onNavigateToVision = jest.fn();

    const { getByTestId } = render(
      <V2ProgressScreen
        anchorId="anchor-progress-1"
        onNavigateToChart={onNavigateToChart}
        onNavigateToVision={onNavigateToVision}
      />,
    );

    fireEvent.press(getByTestId('v2-progress-screen-nav-chart'));
    expect(onNavigateToChart).toHaveBeenCalledWith('anchor-progress-1');

    fireEvent.press(getByTestId('v2-progress-screen-nav-vision'));
    expect(onNavigateToVision).toHaveBeenCalledWith('anchor-progress-1');
  });
});
