jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual, runOnJS: (fn: unknown) => fn, withRepeat: (value: unknown) => value, withSequence: (...values: unknown[]) => values[values.length - 1], withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; } };
});
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { ChartActiveView } from '../../ChartActiveView';
import * as sequences from '../../map/chartMapSequences';
import { resetChartHighWaterCache } from '@/hooks/v2/chart/chartHighWater';
import { resetChartLastOpenedCache, setChartOpenedClockOffsetForDev } from '@/hooks/v2/chart/chartLastOpened';
import { resetChartWeatherHandoff, setChartWeatherHandoff } from '../../map/chartWeatherHandoff';
import { chartActions, course, viewOf } from './chartPanelFixtures';

import { loadFogImages } from '../../map/ChartMapLand';
import { loadCloudTiles } from '../../map/chartCloudTiles';
import { buildRouteTable } from '../../map/chartMapGeometry';

const mockSound = {
  open: jest.fn(), ink: jest.fn(), flag: jest.fn(), note: jest.fn(), check: jest.fn(),
  stamp: jest.fn(), wind: jest.fn(), hush: jest.fn(), summit: jest.fn(), duck: jest.fn(),
  startAir: jest.fn(), stopAir: jest.fn(),
};
jest.mock('../../useChartSound', () => ({ useChartSound: () => mockSound }));

jest.mock('@/services/notifications/chartNotifications', () => ({
  syncChartNotifications: jest.fn(async () => undefined),
}));

// Each test opens its Chart on a fresh day: a mark left by an earlier test would otherwise make this open a
// same-day "later" one (the open now waits long enough for the stored day to load).
let testDay = 0;
beforeEach(() => {
  testDay += 2;
  setChartOpenedClockOffsetForDev(testDay * 24 * 60 * 60 * 1000);
});
// The device warms the map (fog field, cloud tiles) before a Chart opens; the open waits for the map's first frame.
beforeAll(async () => {
  await Promise.all([loadFogImages(buildRouteTable()), loadCloudTiles()]);
});

const DAY = 24 * 60 * 60 * 1000;
const current = course();

function renderChart(entrance: 'reveal' | 'open') {
  return render(
    <ChartActiveView
      view={viewOf(current)}
      course={current}
      identity={{ intention: 'Anchor has ten thousand users', category: 'desire' }}
      anchorArt={null}
      vision={null}
      stale={false}
      busyKey={null}
      reducedMotion={false}
      celebration={null}
      onCelebrationDone={() => undefined}
      onBack={() => undefined}
      chartActions={chartActions() as never}
      onCompleteMove={async () => true}
      onOpenVision={() => undefined}
      onOpenLog={() => undefined}
      onAdjust={() => undefined}
      actionError={null}
      entrance={entrance}
    />
  );
}

async function settle(ms = 300) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  Object.values(mockSound).forEach(fn => fn.mockClear());
  resetChartHighWaterCache();
  resetChartLastOpenedCache();
  resetChartWeatherHandoff();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('ChartActiveView — "Explore your Chart" hand-off', () => {
  it('stops the entrance bed after the opening settles while Chart remains mounted', async () => {
    const screen = renderChart('open');
    await waitFor(() => expect(mockSound.startAir).toHaveBeenCalled(), { timeout: 4000 });
    await waitFor(() => expect(mockSound.stopAir).toHaveBeenCalled(), { timeout: 4000 });
    expect(screen.getByTestId('chart-active')).toBeTruthy();
    screen.unmount();
  });

  it('does not start an entrance bed during the already-settled creation handoff', async () => {
    const open = jest.spyOn(sequences, 'openSequence');
    const screen = renderChart('reveal');
    await waitFor(() => expect(open).toHaveBeenCalled(), { timeout: 4000 });
    expect(mockSound.startAir).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('inherits the parted cover and the standing flag, but inks only real progress (the route never retreats)', async () => {
    setChartWeatherHandoff({ coverArc: 900, inkArc: 900 });
    const open = jest.spyOn(sequences, 'openSequence');
    const reveal = renderChart('reveal');
    await waitFor(() => expect(open).toHaveBeenCalled(), { timeout: 4000 });
    await settle(100);
    const ctx = open.mock.calls[0][0];
    expect(ctx.revealTo).toBeLessThan(900);
    expect(ctx.coverTo).toBe(900);
    expect(ctx.fadeIn).toBe(false);
    expect(ctx.reducedMotion).toBe(true);
    expect(ctx.anim.flagOpacity.value).toBe(1);
    const revealInk = ctx.anim.revealArc.value;
    expect(revealInk).toBe(ctx.revealTo);
    reveal.unmount();

    // The same Chart opened on the next day (first open of the day): identical ink to the reveal's last frame.
    setChartOpenedClockOffsetForDev((testDay + 1) * DAY);
    open.mockClear();
    const later = jest.spyOn(sequences, 'laterSequence');
    const nextDay = renderChart('open');
    await waitFor(() => expect(open).toHaveBeenCalled(), { timeout: 4000 });
    await settle(1600);
    expect(later).not.toHaveBeenCalled();
    const next = open.mock.calls[0][0];
    expect(next.revealTo).toBe(revealInk);
    expect(next.anim.revealArc.value).toBe(revealInk);
    nextDay.unmount();
  });

  it('a normal open ignores any earlier creation hand-off', async () => {
    setChartWeatherHandoff({ coverArc: 900 });
    const spy = jest.spyOn(sequences, 'openSequence');
    const screen = renderChart('open');
    await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 4000 });
    const ctx = spy.mock.calls[0][0];
    expect(ctx.revealTo).toBeLessThan(900);
    expect(ctx.coverTo).toBeUndefined();
    // No entrance fades the map in from paper any more (the frame-one veil covers it).
    expect(ctx.fadeIn).toBe(false);
    screen.unmount();
  });
});
