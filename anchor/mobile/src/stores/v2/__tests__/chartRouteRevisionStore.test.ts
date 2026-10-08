import fs from 'fs';
import path from 'path';
import { CHART_ROUTE_REVISION_TTL_MS, isRouteRevisionFresh, useChartRouteRevisionStore } from '../chartRouteRevisionStore';

beforeEach(() => useChartRouteRevisionStore.setState({ pending: null, lastNonce: 0 }));

describe('chartRouteRevisionStore', () => {
  it('signals with a fresh nonce each time, and only the latest signal is pending', () => {
    const store = useChartRouteRevisionStore.getState();
    const first = store.signal('anchor-1', 'course-1');
    const second = store.signal('anchor-1', 'course-1');
    expect(second).toBe(first + 1);
    expect(useChartRouteRevisionStore.getState().pending).toMatchObject({ nonce: second, anchorId: 'anchor-1', courseId: 'course-1' });
  });

  it('is consumed once: the second caller (and a stale nonce) gets nothing', () => {
    const store = useChartRouteRevisionStore.getState();
    const first = store.signal('anchor-1', 'course-1');
    const second = store.signal('anchor-1', 'course-1');
    expect(useChartRouteRevisionStore.getState().consume(first)).toBe(false);
    expect(useChartRouteRevisionStore.getState().consume(second)).toBe(true);
    expect(useChartRouteRevisionStore.getState().consume(second)).toBe(false);
    expect(useChartRouteRevisionStore.getState().pending).toBeNull();
  });

  it('goes stale after the TTL, so a Chart opened long afterwards never replays an old revision', () => {
    useChartRouteRevisionStore.getState().signal('anchor-1', 'course-1');
    const pending = useChartRouteRevisionStore.getState().pending!;
    expect(isRouteRevisionFresh(pending, pending.at + CHART_ROUTE_REVISION_TTL_MS)).toBe(true);
    expect(isRouteRevisionFresh(pending, pending.at + CHART_ROUTE_REVISION_TTL_MS + 1)).toBe(false);
  });

  it('is signalled from Adjust Route only: the creation flow, which reuses the route editor, never touches it', () => {
    const root = path.resolve(__dirname, '../../..');
    const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
    expect(read('components/v2/chart/ChartCreationFlow.tsx')).not.toMatch(/chartRouteRevision/);
    expect(read('components/v2/chart/ChartRouteEditor.tsx')).not.toMatch(/chartRouteRevision/);
    expect(read('screens/v2/chart/V2ChartAdjustScreen.tsx')).toMatch(/useChartRouteRevisionStore\.getState\(\)\.signal\(/);
  });
});
