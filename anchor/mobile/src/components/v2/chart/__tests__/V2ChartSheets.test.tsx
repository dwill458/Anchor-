import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  V2WaypointDetailSheet,
  V2WaypointReachedModal,
  V2WaypointCelebrationModal,
  V2EditChartSheet,
  V2JourneyOverviewSheet,
  V2VisionDetailSheet,
  V2VisionBrowseSheet,
  V2AnchorDetailSheet,
} from '../V2ChartSheets';
import type { V2WaypointPresentation } from '@/adapters/v2/chart';

describe('V2ChartSheets', () => {
  const mockWaypoints: V2WaypointPresentation[] = [
    {
      id: 'wp-1',
      value: 'Draft Prototype',
      description: 'First version',
      state: 'completed',
      isCurrent: false,
      isDestination: false,
      raw: {} as any,
      reached: true,
      reachedAt: '2026-09-01T00:00:00Z',
      doneMoveCount: 1,
      totalMoveCount: 1,
      moves: [{ id: 'm-1', waypointId: 'wp-1', text: 'Draw wireframes', done: true }],
    },
    {
      id: 'wp-2',
      value: 'User Feedback',
      description: 'Interview 5 users',
      state: 'current',
      isCurrent: true,
      isDestination: false,
      raw: {} as any,
      reached: false,
      reachedAt: null,
      doneMoveCount: 0,
      totalMoveCount: 1,
      moves: [{ id: 'm-2', waypointId: 'wp-2', text: 'Schedule calls', done: false }],
    },
    {
      id: 'wp-3',
      value: 'Public Launch',
      description: 'Ship to app store',
      state: 'upcoming',
      isCurrent: false,
      isDestination: true,
      raw: {} as any,
      reached: false,
      reachedAt: null,
      doneMoveCount: 0,
      totalMoveCount: 0,
      moves: [],
    },
  ];

  describe('V2WaypointDetailSheet', () => {
    it('renders waypoint details and allows adding a move', () => {
      const onAddMoveMock = jest.fn();
      const onGoToOneMoveMock = jest.fn();
      const onReinforceAnchorMock = jest.fn();

      const { getByText, getByPlaceholderText } = render(
        <V2WaypointDetailSheet
          visible={true}
          waypoint={mockWaypoints[1]}
          isCurrent={true}
          onClose={jest.fn()}
          onAddMove={onAddMoveMock}
          onGoToOneMove={onGoToOneMoveMock}
          onReinforceAnchor={onReinforceAnchorMock}
        />,
      );

      expect(getByText('WAYPOINT')).toBeTruthy();
      expect(getByText('User Feedback')).toBeTruthy();
      expect(getByText('Interview 5 users')).toBeTruthy();
      expect(getByText('Schedule calls')).toBeTruthy();

      // Add a move
      const input = getByPlaceholderText('One concrete next step…');
      fireEvent.changeText(input, 'Draft questions');
      fireEvent.press(getByText('Go to One Move'));
      expect(onGoToOneMoveMock).toHaveBeenCalled();

      // Reinforce anchor
      fireEvent.press(getByText('Reinforce your Anchor →'));
      expect(onReinforceAnchorMock).toHaveBeenCalled();
    });
  });

  describe('V2WaypointReachedModal', () => {
    it('renders confirmation prompt and actions', () => {
      const onConfirmMock = jest.fn();
      const onCancelMock = jest.fn();

      const { getByText, getByTestId } = render(
        <V2WaypointReachedModal
          visible={true}
          waypointTitle="User Feedback"
          hasPendingMoves={true}
          onConfirm={onConfirmMock}
          onCancel={onCancelMock}
        />,
      );

      expect(getByText('Waypoint reached?')).toBeTruthy();
      expect(getByText('User Feedback')).toBeTruthy();
      expect(getByText('Keep going')).toBeTruthy();
      expect(getByText('Yes, waypoint reached')).toBeTruthy();

      fireEvent.press(getByTestId('confirm-waypoint-reached-btn'));
      expect(onConfirmMock).toHaveBeenCalled();

      fireEvent.press(getByText('Keep going'));
      expect(onCancelMock).toHaveBeenCalled();
    });
  });

  describe('V2WaypointCelebrationModal', () => {
    it('renders waypoint celebration message', () => {
      const onContinueMock = jest.fn();

      const { getByText } = render(
        <V2WaypointCelebrationModal
          visible={true}
          isDestination={false}
          destinationText="Public Launch"
          nextWaypointTitle="Public Launch"
          onContinue={onContinueMock}
        />,
      );

      expect(getByText('ONE STEP CLOSER')).toBeTruthy();
      expect(getByText('Waypoint reached.')).toBeTruthy();
      expect(getByText(/Your next waypoint is Public Launch/)).toBeTruthy();
      expect(getByText('Continue your journey →')).toBeTruthy();

      fireEvent.press(getByText('Continue your journey →'));
      expect(onContinueMock).toHaveBeenCalled();
    });

    it('renders destination celebration message', () => {
      const onContinueMock = jest.fn();

      const { getByText } = render(
        <V2WaypointCelebrationModal
          visible={true}
          isDestination={true}
          destinationText="Public Launch"
          onContinue={onContinueMock}
        />,
      );

      expect(getByText('DESTINATION REACHED')).toBeTruthy();
      expect(getByText('Look how far you’ve come.')).toBeTruthy();
      expect(getByText(/You reached Public Launch/)).toBeTruthy();
      expect(getByText('View your journey →')).toBeTruthy();
    });
  });

  describe('V2EditChartSheet', () => {
    it('supports reordering, renaming, and deleting waypoints', () => {
      const onReorderMock = jest.fn();
      const onAddWaypointMock = jest.fn();
      const onDeleteWaypointMock = jest.fn();
      const onChangeTemplateMock = jest.fn();

      const { getByText, getByLabelText, getByPlaceholderText } = render(
        <V2EditChartSheet
          visible={true}
          waypoints={mockWaypoints}
          template="gentle-s"
          hasConnectedVision={true}
          onClose={jest.fn()}
          onReorder={onReorderMock}
          onUpdateTitle={jest.fn()}
          onAddWaypoint={onAddWaypointMock}
          onDeleteWaypoint={onDeleteWaypointMock}
          onChangeTemplate={onChangeTemplateMock}
          onToggleVision={jest.fn()}
        />,
      );

      expect(getByText('EDIT CHART')).toBeTruthy();
      expect(getByText('Gentle S curve')).toBeTruthy();
      expect(getByText('Wide zig-zag')).toBeTruthy();

      // Change template
      fireEvent.press(getByText('Wide zig-zag'));
      expect(onChangeTemplateMock).toHaveBeenCalledWith('wide-zigzag');

      // Delete waypoint
      fireEvent.press(getByLabelText('Delete User Feedback'));
      expect(onDeleteWaypointMock).toHaveBeenCalledWith('wp-2');

      // Add waypoint
      const input = getByPlaceholderText('New waypoint title…');
      fireEvent.changeText(input, 'Beta Testing');
    });
  });

  describe('V2JourneyOverviewSheet', () => {
    it('renders waypoints and responds to clicks', () => {
      const onSelectWaypointMock = jest.fn();
      const onEditChartPressMock = jest.fn();

      const { getByText } = render(
        <V2JourneyOverviewSheet
          visible={true}
          waypoints={mockWaypoints}
          onClose={jest.fn()}
          onSelectWaypoint={onSelectWaypointMock}
          onEditChartPress={onEditChartPressMock}
        />,
      );

      expect(getByText('ALL WAYPOINTS')).toBeTruthy();
      expect(getByText('Draft Prototype')).toBeTruthy();
      expect(getByText('User Feedback')).toBeTruthy();
      expect(getByText('Public Launch')).toBeTruthy();

      fireEvent.press(getByText('User Feedback'));
      expect(onSelectWaypointMock).toHaveBeenCalledWith('wp-2');

      fireEvent.press(getByText('Edit Chart →'));
      expect(onEditChartPressMock).toHaveBeenCalled();
    });
  });

  describe('Vision & Anchor Sheets', () => {
    it('renders Connected Vision and disconnect action', () => {
      const onDisconnectMock = jest.fn();

      const { getByText } = render(
        <V2VisionDetailSheet
          visible={true}
          visionTitle="Horizon 2027"
          visionDescription="A clear, expansive view of what is ahead."
          onClose={jest.fn()}
          onDisconnectVision={onDisconnectMock}
        />,
      );

      expect(getByText('CONNECTED VISION')).toBeTruthy();
      expect(getByText('Horizon 2027')).toBeTruthy();
      expect(getByText('Disconnect Vision from Chart')).toBeTruthy();

      fireEvent.press(getByText('Disconnect Vision from Chart'));
      expect(onDisconnectMock).toHaveBeenCalled();
    });

    it('renders Browse Visions and connect action', () => {
      const onConnectMock = jest.fn();

      const { getByText } = render(
        <V2VisionBrowseSheet
          visible={true}
          onClose={jest.fn()}
          onConnectVision={onConnectMock}
        />,
      );

      expect(getByText('BROWSE VISIONS')).toBeTruthy();
      expect(getByText('Connect this Vision')).toBeTruthy();

      fireEvent.press(getByText('Connect this Vision'));
      expect(onConnectMock).toHaveBeenCalled();
    });

    it('renders Anchor Detail Sheet and practice action', () => {
      const onPracticeMock = jest.fn();

      const { getByText } = render(
        <V2AnchorDetailSheet
          visible={true}
          anchorTitle="Steady Hand"
          anchorDescription="Move with calm conviction."
          anchorCategory="COURAGE"
          onClose={jest.fn()}
          onPracticeAnchor={onPracticeMock}
        />,
      );

      expect(getByText('YOUR ANCHOR')).toBeTruthy();
      expect(getByText('Steady Hand')).toBeTruthy();
      expect(getByText('COURAGE')).toBeTruthy();
      expect(getByText('Reinforce this Anchor →')).toBeTruthy();

      fireEvent.press(getByText('Reinforce this Anchor →'));
      expect(onPracticeMock).toHaveBeenCalled();
    });
  });
});
