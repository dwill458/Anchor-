import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { V2ProgressScreen } from '../V2ProgressScreen';
import { useV2Progress } from '@/hooks/v2/progress';
import { toV2ProgressModel } from '@/adapters/v2/progress';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import type {
  V2ProgressAnchorOption,
  V2ProgressModel,
  V2ProgressRange,
  V2ProgressRouteSummary,
} from '@/adapters/v2/progress';

jest.mock('@/hooks/v2/progress');
const mockUseV2Progress = useV2Progress as jest.MockedFunction<typeof useV2Progress>;

type HookReturn = ReturnType<typeof useV2Progress>;

describe('V2ProgressScreen', () => {
  const mockModel: V2ProgressModel = {
    anchorId: 'anchor-progress-1',
    intention: 'Build lasting clarity and momentum',
    category: 'Creativity',
    threadStrength: 65,
    unmeasured: false,
    qualitativeLabel: 'Established',
    highestEvolutionStage: 'Established',
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
        title: 'Established reached',
        copy: 'Your Anchor reached its permanent structural stage: Established.',
        why: 'Meaningful reinforcement held across time.',
        significance: 'HIGH',
        occurredAt: '2026-08-10T09:00:00.000Z',
        formattedDate: 'Aug 10',
        formattedTime: '9:00 AM',
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        stageName: 'Established',
        sourceDomain: 'THREAD_ENGINE',
      },
    ],
  };

  const route: V2ProgressRouteSummary = {
    currentIndex: 1,
    total: 3,
    currentTitle: 'Secure the first paying client',
    currentMetric: { display: '340 / 1,000', percentLabel: '34%', fraction: 0.34 },
    reachedCount: 1,
    isFinished: false,
    waypoints: [
      { id: 'w1', number: 1, metric: null, title: 'Offer defined', state: 'completed', isDestination: false },
      { id: 'w2', number: 2, metric: null, title: 'Secure the first paying client', state: 'current', isDestination: false },
      { id: 'w3', number: 3, metric: null, title: 'Replace my salary', state: 'upcoming', isDestination: true },
    ],
  };

  /** A model built by the real adapter, so the new sections carry consistent data. */
  const evidenceModel = (over: Partial<V2ProgressModel> = {}): V2ProgressModel => {
    const now = new Date();
    const base = toV2ProgressModel(
      {
        id: 'anchor-progress-1',
        userId: 'u1',
        intentionText: 'Build lasting clarity and momentum',
        category: 'creativity',
        threadStrength: 65,
        createdAt: new Date(now.getTime() - 20 * 86_400_000),
        updatedAt: now,
      } as any,
      [],
      [],
      { weekHistory: [true, false, false, false, false, false, false], now },
    ) as V2ProgressModel;
    return { ...base, ...mockModel, ...over, rhythm: base.rhythm, heatmap: base.heatmap, week: base.week, streak: base.streak };
  };

  const hookReturn = (over: Partial<HookReturn> = {}): HookReturn => ({
    model: mockModel,
    loading: false,
    error: null,
    selectedEvent: null,
    setSelectedEvent: jest.fn(),
    refresh: jest.fn(),
    range: 'Month',
    setRange: jest.fn(),
    anchors: [],
    selectAnchor: jest.fn(),
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when loading without model', () => {
    mockUseV2Progress.mockReturnValue(hookReturn({ model: null, loading: true }));

    const { getByTestId, getByText } = render(<V2ProgressScreen anchorId="anchor-1" />);
    expect(getByTestId('v2-progress-screen-loading')).toBeTruthy();
    expect(getByText('Gathering your progress...')).toBeTruthy();
  });

  it('renders progress hero, mix card, and timeline without The Weave', () => {
    mockUseV2Progress.mockReturnValue(hookReturn());

    const { getByTestId, getByText, getAllByText, queryByText } = render(
      <V2ProgressScreen anchorId="anchor-progress-1" />,
    );

    // Renders intention & Thread Strength
    expect(getByText('Build lasting clarity and momentum')).toBeTruthy();
    expect(getByText('65')).toBeTruthy();
    expect(getByText(/thread.strength/i)).toBeTruthy();
    expect(queryByText(/consistency/i)).toBeNull();
    expect(getAllByText('Established').length).toBeGreaterThanOrEqual(1);

    // Renders the mix card: total and per-mode counts
    expect(getByTestId('v2-progress-screen-summary')).toBeTruthy();
    expect(getByText('10 total')).toBeTruthy();
    expect(getByText('Deep Prime')).toBeTruthy();
    expect(queryByText('Deep Focus')).toBeNull();

    // Renders thread events
    expect(getByTestId('v2-progress-screen-timeline')).toBeTruthy();
    expect(getByText('Prototype Validated')).toBeTruthy();
    expect(getByText('Established reached')).toBeTruthy();

    // Critical assertion: The Weave must NOT exist
    expect(queryByText(/the weave/i)).toBeNull();
  });

  it('does not fabricate thread delta when no Thread Strength change was recorded', () => {
    mockUseV2Progress.mockReturnValue(hookReturn({ selectedEvent: mockModel.events[0] }));

    const { getByTestId, queryByTestId } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
    expect(getByTestId('v2-progress-screen-event-detail')).toBeTruthy();
    expect(queryByTestId('v2-progress-screen-event-detail-range')).toBeNull();
  });

  it('shows before and after only when the practice record persisted a range', () => {
    const withRange = {
      ...mockModel.events[0],
      authoritativeThreadRange: [63, 68] as [number, number],
    };
    mockUseV2Progress.mockReturnValue(hookReturn({ selectedEvent: withRange }));

    const { getByText, queryByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
    expect(getByText('63')).toBeTruthy();
    expect(getByText('68')).toBeTruthy();
  });

  it('opens the Chart from the route card with the Anchor id', () => {
    mockUseV2Progress.mockReturnValue(hookReturn({ model: { ...mockModel, route } }));
    const onNavigateToChart = jest.fn();

    const { getByTestId, getByText } = render(
      <V2ProgressScreen anchorId="anchor-progress-1" onNavigateToChart={onNavigateToChart} />,
    );
    expect(getByText('WAYPOINT 2 OF 3')).toBeTruthy();
    expect(getByText('340 / 1,000')).toBeTruthy();
    expect(getByText('34%')).toBeTruthy();
    expect(getByTestId('v2-progress-screen-route-map')).toBeTruthy();

    fireEvent.press(getByTestId('v2-progress-screen-route-card'));
    expect(onNavigateToChart).toHaveBeenCalledWith('anchor-progress-1');
  });

  it('hides the route card when the Anchor has no course', () => {
    mockUseV2Progress.mockReturnValue(hookReturn({ model: { ...mockModel, route: null } }));
    const { queryByTestId, queryByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
    expect(queryByTestId('v2-progress-screen-route')).toBeNull();
    expect(queryByText('Your route')).toBeNull();
  });

  describe('rhythm range', () => {
    it('changes the rhythm body when the range toggles', () => {
      mockUseV2Progress.mockImplementation(() => {
        const [range, setRange] = React.useState<V2ProgressRange>('Month');
        return hookReturn({ model: evidenceModel(), range, setRange });
      });

      const { getByTestId, queryByTestId, getByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
      expect(getByTestId('v2-progress-screen-rhythm-month')).toBeTruthy();
      expect(queryByTestId('v2-progress-screen-rhythm-week')).toBeNull();

      fireEvent.press(getByText('Week'));
      expect(getByTestId('v2-progress-screen-rhythm-week')).toBeTruthy();
      expect(queryByTestId('v2-progress-screen-rhythm-month')).toBeNull();

      fireEvent.press(getByText('Year'));
      expect(getByTestId('v2-progress-screen-rhythm-year')).toBeTruthy();
    });

    it('shows practices, minutes and Moves for every range', () => {
      mockUseV2Progress.mockImplementation(() => {
        const [range, setRange] = React.useState<V2ProgressRange>('Month');
        return hookReturn({ model: evidenceModel(), range, setRange });
      });
      const { getByText, queryByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
      for (const range of ['Month', 'Week', 'Year']) {
        fireEvent.press(getByText(range));
        expect(getByText('PRACTICES')).toBeTruthy();
        expect(getByText('MINUTES')).toBeTruthy();
        expect(getByText('MOVES')).toBeTruthy();
      }
      expect(queryByText('Best run')).toBeNull();
    });
  });

  describe('new Anchor (unmeasured)', () => {
    const unmeasured = (): V2ProgressModel => ({
      ...evidenceModel(),
      threadStrength: null,
      unmeasured: true,
      qualitativeLabel: 'Not established',
      highestEvolutionStage: 'Unestablished',
      practiceSummary: { ...mockModel.practiceSummary, totalSessions: 0, totalDurationSeconds: 0 },
      events: [{ ...mockModel.events[0], id: 'created', type: 'ANCHOR_CREATED', title: 'Anchor created' }],
      week: { days: [false, false, false, false, false, false, false], todayIndex: 0 },
      route: null,
    });

    it('shows the waiting hero, empty pips and ghost cards', () => {
      mockUseV2Progress.mockReturnValue(hookReturn({ model: unmeasured() }));
      const { getByText, getByTestId, queryByTestId } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);

      expect(getByText('—')).toBeTruthy();
      expect(getByText('Your thread is waiting.')).toBeTruthy();
      expect(getByText('Complete your first practice and this starts to measure. Nothing is scored until then.')).toBeTruthy();
      for (let n = 1; n <= 5; n += 1) {
        const pip = getByTestId(`v2-progress-screen-hero-pip-${n}`);
        expect(JSON.stringify(pip.props.style)).not.toContain('"backgroundColor":"#C9A24B"');
      }

      expect(getByText('Your rhythm will draw itself here.')).toBeTruthy();
      expect(getByText('Nothing on your route yet.')).toBeTruthy();
      expect(getByText('Your course log starts with your first practice.')).toBeTruthy();
      expect(queryByTestId('v2-progress-screen-summary')).toBeNull();
      expect(getByTestId('v2-progress-screen-week')).toBeTruthy();
    });
  });

  describe('anchor switcher', () => {
    const anchors: V2ProgressAnchorOption[] = [
      { id: 'a1', category: 'Career', intention: 'Build a business', anchor: makeAnchor({ id: 'a1' }) },
      { id: 'a2', category: 'Health', intention: 'My body is strong', anchor: makeAnchor({ id: 'a2' }) },
    ];

    it('changes the hero to the chosen Anchor', () => {
      mockUseV2Progress.mockImplementation(() => {
        const [id, setId] = React.useState('a1');
        const model: V2ProgressModel =
          id === 'a1'
            ? { ...evidenceModel(), anchorId: 'a1', category: 'Career', intention: 'Build a business' }
            : { ...evidenceModel(), anchorId: 'a2', category: 'Health', intention: 'My body is strong', threadStrength: 41 };
        return hookReturn({ model, anchors, selectAnchor: setId });
      });

      const { getByTestId, getByText } = render(<V2ProgressScreen />);
      // The open sheet lists both Anchors too, so read the hero itself.
      const hero = () => within(getByTestId('v2-progress-screen-hero'));
      expect(hero().getByText('Build a business')).toBeTruthy();

      fireEvent.press(getByTestId('v2-progress-screen-anchor-switcher'));
      fireEvent.press(getByTestId('v2-progress-screen-anchor-sheet-item-a2'));

      expect(hero().getByText('My body is strong')).toBeTruthy();
      expect(hero().queryByText('Build a business')).toBeNull();
      expect(getByText('Soft, but still here.')).toBeTruthy();
    });

    it('does not offer a switcher with only one Anchor', () => {
      mockUseV2Progress.mockReturnValue(hookReturn({ anchors: [anchors[0]] }));
      const { getByTestId } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
      expect(getByTestId('v2-progress-screen-anchor-switcher').props.accessibilityRole).toBeUndefined();
    });
  });

  describe('Weekly Insight card', () => {
    const insight = { headline: 'Your rhythm strengthened this week.', support: 'You practiced on 5 days and completed 2 real-world moves.' };

    it('is hidden when the Anchor has no insight yet', () => {
      mockUseV2Progress.mockReturnValue(hookReturn({ model: { ...mockModel, insight: null } }));
      const { queryByTestId, queryByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
      expect(queryByTestId('v2-progress-screen-weekly-insight')).toBeNull();
      expect(queryByText('WEEKLY INSIGHT')).toBeNull();
    });

    it('reads the week without a handler and is not pressable', () => {
      mockUseV2Progress.mockReturnValue(hookReturn({ model: { ...mockModel, insight } }));
      const { getByTestId, getByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
      expect(getByText(insight.headline)).toBeTruthy();
      expect(getByText(insight.support)).toBeTruthy();
      expect(getByTestId('v2-progress-screen-weekly-insight').props.accessibilityRole).toBeUndefined();
    });

    it('navigates when the host passes a handler', () => {
      mockUseV2Progress.mockReturnValue(hookReturn({ model: { ...mockModel, insight } }));
      const onNavigateToWeeklyInsight = jest.fn();
      const { getByTestId } = render(
        <V2ProgressScreen anchorId="anchor-progress-1" onNavigateToWeeklyInsight={onNavigateToWeeklyInsight} />,
      );
      fireEvent.press(getByTestId('v2-progress-screen-weekly-insight'));
      expect(onNavigateToWeeklyInsight).toHaveBeenCalledWith('anchor-progress-1');
    });
  });

  describe('reflections', () => {
    it('does not draw a reflections card; it is not part of the redesigned screen', () => {
      const now = new Date();
      mockUseV2Progress.mockReturnValue(
        hookReturn({
          model: { ...mockModel, reflections: [{ id: 'r1', word: 'Steady', occurredAt: now.toISOString() }] },
        }),
      );
      const { queryByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
      expect(queryByText('In your words')).toBeNull();
    });
  });

  it('groups history by local day and expands earlier events', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...mockModel.events[0],
      id: `evt-many-${i}`,
      title: `Event ${i}`,
      occurredAt: new Date(2026, 8, 20 - i, 10).toISOString(),
    }));
    mockUseV2Progress.mockReturnValue(hookReturn({ model: { ...mockModel, events: many } }));

    const { getByText, queryByText } = render(<V2ProgressScreen anchorId="anchor-progress-1" />);
    expect(getByText('Event 5')).toBeTruthy();
    expect(queryByText('Event 6')).toBeNull();

    fireEvent.press(getByText('Show earlier'));
    expect(getByText('Event 6')).toBeTruthy();
    expect(queryByText('Show earlier')).toBeNull();
  });
});
