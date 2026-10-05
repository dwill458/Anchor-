import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartWaypointContent } from '../../ChartWaypointContent';
import { useSessionStore } from '@/stores/sessionStore';
import { localDateString } from '@/utils/primingAnalytics';
import {
  EARLIER_TODAY,
  NOW,
  chartActions,
  course,
  dayClosedCourse,
  dayClosedNoNextCourse,
  finishedCourse,
  move,
  movesOnlyCourse,
  viewOf,
} from './chartPanelFixtures';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';

type ContentProps = Partial<React.ComponentProps<typeof ChartWaypointContent>>;

function renderContent(view: ChartViewModel, props: ContentProps = {}) {
  const actions = (props.chart as ReturnType<typeof chartActions> | undefined) ?? chartActions();
  const onReached = jest.fn();
  const utils = render(
    <ChartWaypointContent
      view={view}
      waypointId={props.waypointId ?? view.current?.id ?? 'w2'}
      chart={actions}
      category="desire"
      reducedMotion
      actionError={null}
      bottomInset={0}
      onBack={jest.fn()}
      onReached={onReached}
      now={NOW}
      practiced={false}
      {...props}
    />
  );
  return { ...utils, actions, onReached };
}

describe('ChartWaypointContent — ink panel', () => {
  it('puts the current One Move before progress so its action comes first on opening', () => {
    const { toJSON, getByTestId } = renderContent(viewOf());
    const tree = JSON.stringify(toJSON());
    const moveIndex = tree.indexOf('"testID":"chart-one-move"');
    const barIndex = tree.indexOf('"testID":"chart-waypoint-bar"');
    const progressIndex = tree.indexOf('"testID":"chart-update-progress-button"');
    expect(getByTestId('chart-one-move-check')).toBeTruthy();
    expect(moveIndex).toBeGreaterThanOrEqual(0);
    expect(barIndex).toBeGreaterThan(moveIndex);
    expect(progressIndex).toBeGreaterThan(moveIndex);
  });

  it('caps the current rationale to one line without changing the stored copy', () => {
    const { getByText } = renderContent(viewOf());
    expect(getByText('Growth becomes visible.').props.numberOfLines).toBe(1);
  });

  it('shows the current waypoint: label row, title, why line, bar, value row and the ONE MOVE card', () => {
    const { getByText, queryByText, getByTestId, getByLabelText } = renderContent(viewOf());
    expect(getByText('CURRENT WAYPOINT')).toBeTruthy();
    expect(getByText('2 of 3')).toBeTruthy();
    expect(getByText('Reach 1,000 active users')).toBeTruthy();
    expect(getByText('Growth becomes visible.')).toBeTruthy();
    expect(getByTestId('chart-waypoint-bar').props.accessibilityRole).toBe('progressbar');
    expect(getByText('642 / 1,000')).toBeTruthy();
    // The fraction already says it started at zero.
    expect(queryByText('started at 0')).toBeNull();
    expect(getByText('ONE MOVE')).toBeTruthy();
    expect(getByText('Finish onboarding redesign')).toBeTruthy();
    expect(getByLabelText('Complete: Finish onboarding redesign').props.accessibilityRole).toBe('checkbox');
    expect(getByTestId('chart-current-waypoint')).toBeTruthy();
    expect(getByTestId('chart-one-move-check')).toBeTruthy();
  });

  it('first open after creation: waypoint 1 reads YOUR COURSE BEGINS HERE; other waypoints and later opens keep their labels', () => {
    const base = viewOf();
    const first = {
      ...base,
      waypoints: base.waypoints.map((item) => ({ ...item, state: item.number === 1 ? 'current' : 'upcoming' })),
    } as ChartViewModel;
    const firstId = first.waypoints.find((item) => item.number === 1)!.id;
    const begun = renderContent(first, { waypointId: firstId, entrance: 'reveal' });
    expect(begun.getByText('YOUR COURSE BEGINS HERE')).toBeTruthy();
    begun.unmount();
    expect(renderContent(first, { waypointId: firstId, entrance: 'open' }).queryByText('YOUR COURSE BEGINS HERE')).toBeNull();
    expect(renderContent(viewOf(), { entrance: 'reveal' }).queryByText('YOUR COURSE BEGINS HERE')).toBeNull();
  });

  it('checking the One Move goes through the move handler', async () => {
    const onCompleteMove = jest.fn(async () => true);
    const { getByTestId } = renderContent(viewOf(), { onCompleteMove });
    fireEvent.press(getByTestId('chart-one-move-check'));
    await waitFor(() => expect(onCompleteMove).toHaveBeenCalledWith('m1'));
  });

  it('the chevron expands every move; a star makes another move the One Move (setCurrentMove)', () => {
    const { getByTestId, getByLabelText, actions, queryByLabelText } = renderContent(viewOf());
    expect(queryByLabelText('Make this the One Move: Launch creator campaign')).toBeNull();
    fireEvent.press(getByTestId('chart-one-move-toggle'));
    expect(getByLabelText('Complete: Launch creator campaign')).toBeTruthy();
    fireEvent.press(getByLabelText('Make this the One Move: Launch creator campaign'));
    expect(actions.setCurrentMove).toHaveBeenCalledWith('m2');
    // Existing features stay reachable in the expanded card.
    expect(getByTestId('chart-suggest-moves')).toBeTruthy();
    expect(getByTestId('chart-add-move')).toBeTruthy();
  });

  it('day closed, not practiced yet: offers Focus and Deep Focus that open Practice', () => {
    const onOpenPractice = jest.fn();
    const { getByText, getByTestId, queryByText } = renderContent(viewOf(dayClosedCourse()), { onOpenPractice });
    expect(getByText('TODAY')).toBeTruthy();
    expect(getByText("Today's move is done.")).toBeTruthy();
    expect(getByText('Next move tomorrow.')).toBeTruthy();
    expect(getByText('Lock it in — a short practice reinforces what you just moved.')).toBeTruthy();
    expect(queryByText('You practiced today too.')).toBeNull();
    fireEvent.press(getByTestId('chart-practice-focus'));
    expect(onOpenPractice).toHaveBeenLastCalledWith('focus');
    fireEvent.press(getByTestId('chart-practice-deep-focus'));
    expect(onOpenPractice).toHaveBeenLastCalledWith('deep_prime');
    expect(getByText('Focus')).toBeTruthy();
    expect(getByText('Deep Focus')).toBeTruthy();
  });

  it('day closed, practiced today: says so and offers no practice', () => {
    const { getByText, queryByText, queryByTestId } = renderContent(viewOf(dayClosedCourse()), { practiced: true });
    expect(getByText("Today's move is done.")).toBeTruthy();
    expect(getByText('You practiced today too.')).toBeTruthy();
    expect(queryByText('Lock it in — a short practice reinforces what you just moved.')).toBeNull();
    expect(queryByTestId('chart-practice-focus')).toBeNull();
  });

  it('reads "practiced today" from the session store when not overridden', () => {
    useSessionStore.setState({ todayPractice: { date: localDateString(NOW), sessionsCount: 1, totalSeconds: 120 } });
    try {
      const { getByText } = renderContent(viewOf(dayClosedCourse()), { practiced: undefined });
      expect(getByText('You practiced today too.')).toBeTruthy();
    } finally {
      useSessionStore.setState({ todayPractice: { date: localDateString(NOW), sessionsCount: 0, totalSeconds: 0 } });
    }
  });

  it('"Do another move now" hides the day-closed card for the session and brings the next move back', () => {
    const { getByText, queryByText, queryByTestId } = renderContent(viewOf(dayClosedCourse()));
    expect(queryByTestId('chart-one-move')).toBeNull();
    fireEvent.press(getByText('Do another move now'));
    expect(queryByTestId('chart-day-closed')).toBeNull();
    expect(queryByText("Today's move is done.")).toBeNull();
    expect(getByText('Launch creator campaign')).toBeTruthy();
  });

  it('a new completion re-closes the day after "Do another move now" hid the card', () => {
    const base = dayClosedCourse();
    const props = { chart: chartActions() as never, category: 'desire', reducedMotion: true, actionError: null, bottomInset: 0, onBack: jest.fn(), onReached: jest.fn(), now: NOW, practiced: false };
    const first = viewOf(base);
    const { getByText, queryByTestId, getByTestId, rerender } = render(<ChartWaypointContent view={first} waypointId="w2" {...props} />);
    fireEvent.press(getByText('Do another move now'));
    expect(queryByTestId('chart-day-closed')).toBeNull();
    const closedAgain = viewOf({
      ...base,
      currentMoveId: 'm4',
      moves: [
        ...(base.moves ?? []).map((m) => (m.id === 'm2' ? { ...m, status: 'COMPLETED' as const, completedAt: EARLIER_TODAY, isCurrent: false } : m)),
        move({ id: 'm4', title: 'One more thing', position: 400, isCurrent: true }),
      ],
    });
    rerender(<ChartWaypointContent view={closedAgain} waypointId="w2" {...props} />);
    expect(getByTestId('chart-day-closed')).toBeTruthy();
  });

  // DEFERRED: (replaced: a closed day with nothing left shows ONLY the day-closed card, as in the prototype)
  // DEFERRED: it('with no next move there is no "Do another move now", and the waypoint says every move is done', () => {
  // DEFERRED: const { getByText, queryByText } = renderContent(viewOf(dayClosedNoNextCourse()));
  // DEFERRED: expect(getByText("Today's move is done.")).toBeTruthy();
  // DEFERRED: expect(queryByText('Do another move now')).toBeNull();
  // DEFERRED: expect(getByText('Every move on this waypoint is done.')).toBeTruthy();
  // DEFERRED: });


  it('with no next move there is no "Do another move now", and only the day-closed card shows', () => {
    const { getByText, queryByText, queryByTestId, getByTestId } = renderContent(viewOf(dayClosedNoNextCourse()));
    expect(getByText("Today's move is done.")).toBeTruthy();
    expect(queryByText('Do another move now')).toBeNull();
    expect(queryByText('Every move on this waypoint is done.')).toBeNull();
    expect(queryByTestId('chart-one-move')).toBeNull();
    expect(getByTestId('chart-day-closed')).toBeTruthy();
  });

  it('a day-closed card never outlives midnight (the clock refreshes on its own)', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 30, 23, 58, 0) });
    try {
      const closed = viewOf(course({
        currentMoveId: 'm2',
        moves: [move({ id: 'm1', title: 'Done', status: 'COMPLETED', completedAt: new Date(2026, 8, 30, 20, 0, 0).toISOString() }), move({ id: 'm2', title: 'Next', position: 200, isCurrent: true })],
      }));
      const { queryByTestId } = render(
        <ChartWaypointContent view={closed} waypointId="w2" chart={chartActions() as never} category="desire" reducedMotion actionError={null} bottomInset={0} onBack={jest.fn()} onReached={jest.fn()} practiced={false} />
      );
      expect(queryByTestId('chart-day-closed')).not.toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(3 * 60 * 1000);
      });
      expect(queryByTestId('chart-day-closed')).toBeNull();
      expect(queryByTestId('chart-one-move')).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds the day-closed card back while the route is still extending', () => {
    const { queryByTestId, rerender, getByTestId } = renderContent(viewOf(dayClosedCourse()), { dayClosedHold: true });
    expect(queryByTestId('chart-day-closed')).toBeNull();
    rerender(
      <ChartWaypointContent
        view={viewOf(dayClosedCourse())}
        waypointId="w2"
        chart={chartActions()}
        category="desire"
        reducedMotion
        actionError={null}
        bottomInset={0}
        onBack={jest.fn()}
        onReached={jest.fn()}
        now={NOW}
        practiced={false}
        dayClosedHold={false}
      />
    );
    expect(getByTestId('chart-day-closed')).toBeTruthy();
  });

  it('does not render "Mark waypoint reached" in the page body', () => {
    const { queryByTestId } = renderContent(viewOf());
    expect(queryByTestId('chart-mark-waypoint')).toBeNull();
  });

  it('the commit card: category border, "WAYPOINT n REACHED", locked copy, and "I\'m committed" dismisses it', () => {
    const onCommitDismiss = jest.fn();
    const { getByText, getByTestId } = renderContent(viewOf(), { commit: { number: 1 }, onCommitDismiss });
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(getByText('WAYPOINT 1 REACHED')).toBeTruthy();
    expect(getByText("Look how far you've come.")).toBeTruthy();
    expect(getByText('Commit to the next leg.')).toBeTruthy();
    fireEvent.press(getByText("I'm committed"));
    expect(onCommitDismiss).toHaveBeenCalledTimes(1);
  });

  it('the arrival panel: ARRIVED, "You\'ve arrived.", the destination, View Vision and Release', () => {
    const onOpenVision = jest.fn();
    const onRelease = jest.fn();
    const view = viewOf(finishedCourse());
    const { getByText, getByTestId, queryByTestId } = renderContent(view, {
      waypointId: 'w3',
      arrived: true,
      onOpenVision,
      onRelease,
      vision: { imageUrl: null, description: 'My dashboard shows 10 thousand active users.' },
    });
    expect(getByText('ARRIVED')).toBeTruthy();
    expect(getByText('3 of 3')).toBeTruthy();
    expect(getByText("You've arrived.")).toBeTruthy();
    expect(getByText('Reach 10,000 active users')).toBeTruthy();
    expect(getByText('YOUR VISION')).toBeTruthy();
    fireEvent.press(getByText('View Vision'));
    expect(onOpenVision).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText('Release'));
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(queryByTestId('chart-mark-waypoint')).toBeNull();
    expect(getByTestId('chart-arrival-card')).toBeTruthy();
  });

  it('the course log row reads "Course log · {n} days on course" and navigates on tap', () => {
    const onOpenLog = jest.fn();
    const { getByText, getByTestId } = renderContent(viewOf(), { onOpenLog });
    expect(getByText('Course log · 10 days on course')).toBeTruthy();
    fireEvent.press(getByTestId('chart-course-log'));
    expect(onOpenLog).toHaveBeenCalledTimes(1);
  });

  it('the course log keeps the exact copy on the first day', () => {
    const { getByText } = renderContent(viewOf(course({ plottedAt: new Date(2026, 8, 30, 8, 0, 0).toISOString() })));
    expect(getByText('Course log · 1 day on course')).toBeTruthy();
  });

  it('the destination card names the destination and opens the Vision', () => {
    const onOpenVision = jest.fn();
    const { getByText, getByTestId } = renderContent(viewOf(), { onOpenVision, vision: { imageUrl: null, description: 'A dashboard.' } });
    expect(getByText('DESTINATION')).toBeTruthy();
    fireEvent.press(getByTestId('chart-view-vision'));
    expect(onOpenVision).toHaveBeenCalledTimes(1);
  });

  it('an upcoming waypoint is read-only with a way back to the current waypoint', () => {
    const onBack = jest.fn();
    const { getByText, queryByTestId, queryByLabelText } = renderContent(viewOf(), { waypointId: 'w3', onBack });
    expect(getByText('UPCOMING')).toBeTruthy();
    expect(getByText('3 of 3')).toBeTruthy();
    expect(queryByTestId('chart-mark-waypoint')).toBeNull();
    expect(queryByLabelText(/^Complete:/)).toBeNull();
    fireEvent.press(getByText('Back to current waypoint'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('a reached waypoint reads REACHED with a full bar', () => {
    const { getByText, getByTestId } = renderContent(viewOf(), { waypointId: 'w1' });
    expect(getByText('REACHED')).toBeTruthy();
    expect(getByTestId('chart-waypoint-bar').props.accessibilityValue).toMatchObject({ now: 100 });
  });

  it('never uses streak or missed-day language', () => {
    const { toJSON } = renderContent(viewOf(dayClosedCourse()));
    expect(JSON.stringify(toJSON())).not.toMatch(/streak|missed|broke|lost|you didn/i);
  });
});

describe('ChartWaypointContent — update progress sheet', () => {
  it('opens the update progress sheet, updates input with chips, and saves', async () => {
    const { getByTestId, getByText, actions } = renderContent(viewOf());
    expect(getByText('Update progress →')).toBeTruthy();
    fireEvent.press(getByTestId('chart-update-progress-button'));
    expect(getByText('Update progress')).toBeTruthy();
    expect(getByText('Target: 1,000 active users')).toBeTruthy();
    expect(getByTestId('chart-progress-input')).toBeTruthy();

    // A 1,000 target steps in fifties: -50 / +50 / +250 / +500.
    fireEvent.press(getByTestId('chart-sheet-chip-+50'));
    fireEvent.press(getByTestId('chart-sheet-chip-+250'));

    // Tap save
    fireEvent.press(getByTestId('chart-save-progress'));
    await waitFor(() => {
      expect(actions.updateProgress).toHaveBeenCalledWith('w2', expect.any(Number));
    });
  });

  it('has no inline chips in the page body', () => {
    const { queryByTestId } = renderContent(viewOf());
    expect(queryByTestId('chart-progress-chips')).toBeNull();
  });
});

function withW2(overrides: Record<string, unknown>) {
  const base = course();
  return {
    ...base,
    waypoints: base.waypoints.map((item) => (item.id === 'w2' ? { ...item, ...overrides } : item)),
  } as ReturnType<typeof course>;
}

describe('ChartWaypointContent — progress by metric type', () => {
  it('numeric: steppers scale to the target, so a 50,000 goal never nudges in tens', () => {
    const big = withW2({ metric: { label: 'subscribers', baseline: 0, target: 50000, current: 12000 } });
    const { getByTestId, queryByTestId } = renderContent(viewOf(big));
    fireEvent.press(getByTestId('chart-update-progress-button'));
    expect(getByTestId('chart-sheet-chip-+2000')).toBeTruthy();
    expect(getByTestId('chart-sheet-chip-+10000')).toBeTruthy();
    expect(getByTestId('chart-sheet-chip-+20000')).toBeTruthy();
    expect(queryByTestId('chart-sheet-chip-+10')).toBeNull();
  });

  it('moves: shows "n of m moves done" and a check-off sheet, with no counter or steppers', async () => {
    const qualitative = withW2({ kind: 'MILESTONE', metric: null, progressMode: 'moves' });
    const { getByText, getByTestId, queryByTestId, queryByText, actions } = renderContent(viewOf(qualitative));
    expect(getByText('0 of 2 moves done')).toBeTruthy();
    expect(queryByText(/\/ 1,000/)).toBeNull();
    fireEvent.press(getByTestId('chart-update-progress-button'));
    expect(getByTestId('chart-progress-moves')).toBeTruthy();
    expect(queryByTestId('chart-progress-input')).toBeNull();
    expect(queryByTestId('chart-save-progress')).toBeNull();
    expect(queryByTestId('chart-sheet-chip-+50')).toBeNull();
    fireEvent.press(getByTestId('chart-progress-moves').findAllByProps({ accessibilityRole: 'checkbox' })[0]);
    await waitFor(() => expect(actions.completeMove).toHaveBeenCalled());
  });

  it('none: no bar, no value, no Update progress', () => {
    const plain = withW2({ kind: 'MILESTONE', metric: null, progressMode: 'none' });
    const { queryByTestId } = renderContent(viewOf({ ...plain, moves: [] }));
    expect(queryByTestId('chart-waypoint-bar')).toBeNull();
    expect(queryByTestId('chart-waypoint-value')).toBeNull();
    expect(queryByTestId('chart-update-progress-button')).toBeNull();
  });

  it('never puts a numeric counter on a non-numeric waypoint', () => {
    const qualitative = withW2({ kind: 'MILESTONE', metric: null, progressMode: 'moves' });
    const { queryByText } = renderContent(viewOf(qualitative));
    expect(queryByText(/\d+ \/ [\d,]+/)).toBeNull();
  });
});

describe('ChartWaypointContent — marking a waypoint reached', () => {
  it('confirms, then hands the server result to the celebration', async () => {
    const result = { completedTitle: 'Reach 1,000 active users', nextTitle: 'Reach 10,000 active users', destinationReached: false, chart: course() };
    const reachWaypoint = jest.fn(async () => result);
    const { getByTestId, onReached } = renderContent(viewOf(), { chart: chartActions({ reachWaypoint }) as never });
    fireEvent.press(getByTestId('chart-mark-waypoint-cta'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    await waitFor(() => expect(onReached).toHaveBeenCalledWith(result));
    expect(reachWaypoint).toHaveBeenCalledWith('w2');
  });

  it('a failed call advances nothing and says so plainly', async () => {
    const reachWaypoint = jest.fn(async () => null);
    const { getByTestId, getByText, onReached } = renderContent(viewOf(), { chart: chartActions({ reachWaypoint }) as never });
    fireEvent.press(getByTestId('chart-mark-waypoint-cta'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    await waitFor(() => expect(getByTestId('chart-reach-error')).toBeTruthy());
    expect(getByText(/couldn’t mark this waypoint reached/)).toBeTruthy();
    expect(onReached).not.toHaveBeenCalled();
  });
});
