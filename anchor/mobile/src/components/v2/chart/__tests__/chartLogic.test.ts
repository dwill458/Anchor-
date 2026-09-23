import {
  CHART_LANDSCAPES,
  CHART_ROUTE_CONTROL_POINTS,
  CHART_WINDOWS,
  chartArtFor,
  chartFrame,
  pointAt,
  routeLength,
  routePathData,
  toFramePoint,
  waypointFractions,
} from '../chartRouteGeometry';
import { moveItem } from '../ChartRouteEditor';
import { manualOutline, toDraft } from '../ChartCreationFlow';
import { journeyRows } from '../ChartDestinationReached';
import { travelledFraction } from '../ChartActiveView';
import { classifyChartError, ChartRequestError } from '@/services/v2/chartV2Api';
import { ApiClientError } from '@/services/ApiClient';
import { draftFromCourse, draftFromProposal } from '@/screens/v2/chart/V2ChartAdjustScreen';
import { toChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { ChartProposal } from '@/services/v2/chartV2Api';
import type { CourseDetail } from '@/types/chart';

jest.mock('@/assets/chart/chart-landscape-night.jpg', () => 1, { virtual: true });

const art = { width: 896, height: 1200 };

describe('shared route geometry', () => {
  it('uses one trail for every category', () => {
    const categories = Object.keys(CHART_LANDSCAPES);
    expect(categories).toHaveLength(12);
    expect(new Set(categories.map((key) => CHART_LANDSCAPES[key])).size).toBe(1);
    expect(chartArtFor('Career')).toBe(chartArtFor('unknown-category'));
  });

  it('runs from START (lower left) to the destination (upper right)', () => {
    const start = pointAt(0, art);
    const end = pointAt(1, art);
    expect(start).toEqual(CHART_ROUTE_CONTROL_POINTS[0]);
    expect(end.x).toBeCloseTo(CHART_ROUTE_CONTROL_POINTS[CHART_ROUTE_CONTROL_POINTS.length - 1].x, 5);
    expect(start.y).toBeGreaterThan(end.y);
    expect(start.x).toBeLessThan(end.x);
  });

  it('places N waypoints evenly by arc length with the destination last', () => {
    expect(waypointFractions(0)).toEqual([]);
    expect(waypointFractions(4)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(waypointFractions(8)[7]).toBe(1);
  });

  it('maps route points into a cropped window', () => {
    const frame = chartFrame(390, { ...art, source: 1, tintable: true }, CHART_WINDOWS.hero);
    expect(frame.height).toBeCloseTo((CHART_WINDOWS.hero.bottom - CHART_WINDOWS.hero.top) * frame.imageHeight, 5);
    const end = toFramePoint(pointAt(1, art), frame);
    expect(end.y).toBeGreaterThan(0);
    expect(end.y).toBeLessThan(frame.height);
    expect(routePathData(frame, art, 0.5, 0.5)).toBe('');
    expect(routePathData(frame, art)).toMatch(/^M[\d.]+ [\d.]+ L/);
    expect(routeLength(frame, art, 0, 0.5)).toBeCloseTo(routeLength(frame, art) / 2, 5);
  });
});

describe('route editing', () => {
  it('moves an item and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    const same = ['a', 'b'];
    expect(moveItem(same, 0, 5)).toBe(same);
  });

  it('builds a plain outline for manual creation, ending at the intention', () => {
    const outline = manualOutline('Anchor has ten thousand users.');
    expect(outline).toHaveLength(3);
    expect(outline[0].title).toBe('');
    expect(outline[2].title).toBe('Anchor has ten thousand users');
  });
});

function proposal(titles: string[]): ChartProposal {
  return {
    proposalId: 'p1',
    kind: 'ADJUST',
    anchorId: 'a1',
    courseId: 'c1',
    baseCourseVersion: 3,
    destination: 'Reach 10,000 active users',
    complexity: 'MODERATE',
    waypoints: titles.map((title, index) => ({
      clientKey: `k${index}`,
      title,
      rationale: null,
      kind: 'MILESTONE',
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
    })),
    suggestedOneMove: null,
    guidance: null,
    generation: { source: 'ai', fallbackUsed: false, needsNaming: false },
    createdAt: '',
    expiresAt: '',
  };
}

const liveCourse = {
  id: 'c1',
  status: 'ACTIVE',
  version: 3,
  currentWaypointId: 'w2',
  waypoints: [
    { id: 'w1', position: 100, title: 'Validate acquisition', state: 'REACHED', reachedAt: '2026-06-01', cancelledAt: null, description: null },
    { id: 'w2', position: 200, title: 'Reach 1,000 users', state: 'CURRENT', reachedAt: null, cancelledAt: null, description: null },
    { id: 'w3', position: 300, title: 'Reach 10,000 users', state: 'UPCOMING', reachedAt: null, cancelledAt: null, description: null },
  ],
} as unknown as CourseDetail;

describe('route adjustment drafts', () => {
  it('locks reached history and keeps ids for waypoints the revision keeps', () => {
    const draft = draftFromProposal(liveCourse, proposal(['Reach 1,000 users', 'Retention holds at 40%', 'Reach 10,000 users']));
    expect(draft.map((item) => [item.title, item.id ?? null, Boolean(item.locked)])).toEqual([
      ['Validate acquisition', 'w1', true],
      ['Reach 1,000 users', 'w2', false],
      ['Retention holds at 40%', null, false],
      ['Reach 10,000 users', 'w3', false],
    ]);
  });

  it('never lets a revision duplicate a reached waypoint', () => {
    const draft = draftFromProposal(liveCourse, proposal(['Validate acquisition', 'Reach 10,000 users']));
    expect(draft.filter((item) => item.title === 'Validate acquisition')).toHaveLength(1);
  });

  it('starts manual editing from the live route', () => {
    expect(draftFromCourse(liveCourse).map((item) => item.locked)).toEqual([true, false, false]);
  });

  it('turns a proposal into an editable draft', () => {
    expect(toDraft(proposal(['A', 'B'])).map((item) => item.key)).toEqual(['k0', 'k1']);
  });
});

describe('journey summary', () => {
  it('reports only real counts and omits unknown practice counts', () => {
    const view = toChartViewModel(
      { ...liveCourse, status: 'COMPLETED', currentWaypointId: null, plottedAt: '2026-05-31T12:00:00Z', completedAt: '2026-12-14T12:00:00Z', moves: [] } as unknown as CourseDetail,
      null
    );
    const rows = journeyRows(view);
    expect(rows.map((row) => row.label)).toEqual(['Created', 'Reached', 'Waypoints', 'Moves completed']);
    expect(rows.find((row) => row.label === 'Waypoints')?.value).toBe('3');
  });

  it('places the Anchor at the last reached waypoint', () => {
    expect(travelledFraction({ reachedCount: 0, total: 4, isFinished: false })).toBe(0);
    expect(travelledFraction({ reachedCount: 2, total: 4, isFinished: false })).toBe(0.5);
    expect(travelledFraction({ reachedCount: 3, total: 4, isFinished: true })).toBe(1);
  });
});

describe('chart error classification', () => {
  it('never exposes provider or technical detail — only a category', () => {
    expect(classifyChartError(new Error('Network error. Please check your connection.')).kind).toBe('offline');
    expect(classifyChartError(new ApiClientError('x', 'FEATURE_DISABLED', 403)).kind).toBe('disabled');
    expect(classifyChartError(new ApiClientError('x', 'ROUTE_REWRITE_CONFIRMATION_REQUIRED', 409)).kind).toBe('confirmation_required');
    expect(classifyChartError(new ApiClientError('x', 'COURSE_VERSION_CONFLICT', 409)).kind).toBe('conflict');
    expect(classifyChartError(new ApiClientError('x', 'CHART_ADJUST_UNAVAILABLE', 503)).kind).toBe('unavailable');
    expect(classifyChartError(new ApiClientError('x', 'CHART_PLAN_RATE_LIMITED', 429)).kind).toBe('rate_limited');
    expect(classifyChartError(new ApiClientError('x', 'ANCHOR_UNAVAILABLE', 409)).kind).toBe('anchor_released');
    expect(classifyChartError('weird').kind).toBe('unknown');
    const already = new ChartRequestError('offline', undefined);
    expect(classifyChartError(already)).toBe(already);
  });
});
