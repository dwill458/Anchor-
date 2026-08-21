const mockFetchCourseDetail = jest.fn();
const mockLinkAnchor = jest.fn();
const mockBindCourseAccount = jest.fn();
const mockSetFeatureFlags = jest.fn();
const mockClearAnchorCreation = jest.fn();
const mockMarkAnchorLinked = jest.fn();

let mockUser: any;
let mockJourneyState: any;
let mockCourseState: any;

jest.mock('@/stores/authStore', () => {
  const useAuthStore: any = jest.fn();
  useAuthStore.getState = () => ({ user: mockUser });
  return { useAuthStore };
});

jest.mock('@/stores/courseStore', () => {
  const useCourseStore: any = jest.fn();
  useCourseStore.getState = () => mockCourseState;
  return { useCourseStore };
});

jest.mock('@/stores/chartJourneyStore', () => {
  const useChartJourneyStore: any = jest.fn();
  useChartJourneyStore.getState = () => mockJourneyState;
  return {
    useChartJourneyStore,
    getFreshChartAnchorHandoff: (accountId: string) =>
      mockJourneyState.accountId === accountId ? mockJourneyState.anchorCreationHandoff : null,
  };
});

jest.mock('@/types/chart', () => {
  const actual = jest.requireActual('@/types/chart');
  return {
    ...actual,
    canViewChart: (flags: any, capabilities: any) =>
      flags?.chart_enabled === true && capabilities?.canViewChart === true,
  };
});

import { completeChartAnchorCreation } from '../ChartAnchorHandoffService';

const handoff = {
  courseId: 'course-1',
  waypointId: 'waypoint-1',
  anchorCreateIdempotencyKey: 'anchor-create-1',
  anchorCreateIntentSignature: null,
  linkIdempotencyKey: 'link-intent-1',
  originatingCourseVersion: 3,
  observedAnchorLinkId: null,
  observedAnchorId: null,
  startedAt: '2026-08-21T12:00:00.000Z',
  anchorId: null,
  linkedCourseVersion: null,
};

const currentWaypoint = {
  id: 'waypoint-1',
  state: 'CURRENT',
  anchorLink: null,
};

function activeCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    status: 'ACTIVE',
    version: 3,
    currentWaypointId: 'waypoint-1',
    waypoints: [currentWaypoint],
    ...overrides,
  };
}

describe('ChartAnchorHandoffService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'account-a',
      chartFlags: { chart_enabled: true },
      chartCapabilities: { canViewChart: true, canEditCourse: true },
    };
    mockJourneyState = {
      accountId: 'account-a',
      anchorCreationHandoff: { ...handoff },
      clearAnchorCreation: mockClearAnchorCreation.mockImplementation(() => {
        mockJourneyState.anchorCreationHandoff = null;
      }),
      markAnchorLinked: mockMarkAnchorLinked,
    };
    mockCourseState = {
      errorCode: null,
      bindAccount: mockBindCourseAccount,
      setFeatureFlags: mockSetFeatureFlags,
      fetchCourseDetail: mockFetchCourseDetail.mockResolvedValue(activeCourse()),
      linkAnchor: mockLinkAnchor.mockResolvedValue(activeCourse({ version: 4 })),
    };
  });

  it('refetches authoritative state and links with the persisted logical-intent key', async () => {
    const result = await completeChartAnchorCreation('anchor-1');

    expect(result).toEqual({
      status: 'linked',
      chartContext: { courseId: 'course-1', waypointId: 'waypoint-1', courseVersion: 4 },
    });
    expect(mockLinkAnchor).toHaveBeenCalledWith('course-1', expect.objectContaining({
      idempotencyKey: 'link-intent-1',
      expectedCourseVersion: 3,
      anchorId: 'anchor-1',
      waypointId: 'waypoint-1',
    }));
    expect(mockMarkAnchorLinked).toHaveBeenCalledWith('anchor-1', 4);
  });

  it('treats an already-linked Anchor as a committed lost-response retry', async () => {
    mockFetchCourseDetail.mockResolvedValue(activeCourse({
      version: 4,
      waypoints: [{
        ...currentWaypoint,
        anchorLink: { id: 'link-1', anchorId: 'anchor-1', anchorAvailable: true },
      }],
    }));

    const result = await completeChartAnchorCreation('anchor-1');

    expect(result.status).toBe('linked');
    expect(mockLinkAnchor).not.toHaveBeenCalled();
    expect(mockMarkAnchorLinked).toHaveBeenCalledWith('anchor-1', 4);
  });

  it('keeps the same request key across transient retries', async () => {
    mockCourseState.errorCode = 'NETWORK_ERROR';
    mockLinkAnchor.mockResolvedValue(null);

    expect((await completeChartAnchorCreation('anchor-1')).status).toBe('unavailable');
    expect((await completeChartAnchorCreation('anchor-1')).status).toBe('unavailable');

    expect(mockLinkAnchor).toHaveBeenCalledTimes(2);
    expect(mockLinkAnchor.mock.calls[0][1].idempotencyKey).toBe('link-intent-1');
    expect(mockLinkAnchor.mock.calls[1][1].idempotencyKey).toBe('link-intent-1');
    expect(mockClearAnchorCreation).not.toHaveBeenCalled();
  });

  it('rejects stale Waypoint context and clears only its own handoff', async () => {
    mockFetchCourseDetail.mockResolvedValue(activeCourse({ currentWaypointId: 'waypoint-2' }));

    expect((await completeChartAnchorCreation('anchor-1')).status).toBe('stale');
    expect(mockLinkAnchor).not.toHaveBeenCalled();
    expect(mockClearAnchorCreation).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an Anchor link changed by another device during creation', async () => {
    mockFetchCourseDetail.mockResolvedValue(activeCourse({
      version: 4,
      waypoints: [{
        ...currentWaypoint,
        anchorLink: { id: 'newer-link', anchorId: 'anchor-from-other-device', anchorAvailable: true },
      }],
    }));

    expect((await completeChartAnchorCreation('anchor-1')).status).toBe('stale');
    expect(mockLinkAnchor).not.toHaveBeenCalled();
    expect(mockClearAnchorCreation).toHaveBeenCalledTimes(1);
  });

  it('cannot mutate or clear the next account after an account switch during refetch', async () => {
    let resolveFetch!: (course: any) => void;
    mockFetchCourseDetail.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const pending = completeChartAnchorCreation('anchor-1');
    mockUser = { id: 'account-b' };
    mockJourneyState = {
      accountId: 'account-b',
      anchorCreationHandoff: { ...handoff, linkIdempotencyKey: 'account-b-link' },
      clearAnchorCreation: mockClearAnchorCreation,
      markAnchorLinked: mockMarkAnchorLinked,
    };
    resolveFetch(activeCourse());

    expect(await pending).toEqual({ status: 'none' });
    expect(mockLinkAnchor).not.toHaveBeenCalled();
    expect(mockClearAnchorCreation).not.toHaveBeenCalled();
    expect(mockMarkAnchorLinked).not.toHaveBeenCalled();
  });
});
