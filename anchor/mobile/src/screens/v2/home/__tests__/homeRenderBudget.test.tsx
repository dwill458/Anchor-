/**
 * Render budget for a Home Anchor switch.
 *
 * Switching the hero Anchor used to re-render every section of Home TWICE: once
 * on the selection itself and again when Today's recommendation resolved. The
 * second pass landed on exactly the frames the carousel is settling, which is
 * where the Android hitch was visible. Sections that do not depend on the
 * selected Anchor must not render at all, and NOTHING may re-render the
 * carousel while it is animating its entrance.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';

const renders: Record<string, number> = {};
const bump = (key: string) => {
  renders[key] = (renders[key] ?? 0) + 1;
};
const take = () => {
  const snapshot = { ...renders };
  Object.keys(renders).forEach((key) => delete renders[key]);
  return snapshot;
};

// React Navigation hands back the same object across renders; a fresh one per
// call would change every handler that closes over it and mask the result.
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: {}, name: 'V2Home', key: 'k' }),
}));

jest.mock('@/components/v2/home/V2HomeAnchorCarousel', () => {
  const actual = jest.requireActual('@/components/v2/home/V2HomeAnchorCarousel');
  const R = require('react');
  return {
    ...actual,
    V2HomeAnchorCarousel: R.memo((props: Record<string, unknown>) => {
      bump('Carousel');
      return R.createElement(actual.V2HomeAnchorCarousel, props);
    }),
  };
});

/**
 * Each section is wrapped in its own `memo` so the counter fires only when
 * React would actually re-render it — i.e. when its props changed. Counting
 * inside a plain wrapper would report a render for every parent pass and
 * measure nothing.
 */
jest.mock('@/components/v2/home', () => {
  const actual = jest.requireActual('@/components/v2/home');
  const R = require('react');
  const wrap = (name: string, Component: React.ComponentType<never>) =>
    R.memo((props: Record<string, unknown>) => {
      bump(name);
      return R.createElement(Component, props);
    });
  return {
    ...actual,
    V2HomeHeader: wrap('Header', actual.V2HomeHeader),
    V2HomeHero: wrap('Hero', actual.V2HomeHero),
    V2HomeTodaySection: wrap('Today', actual.V2HomeTodaySection),
    V2HomeVisionSection: wrap('Vision', actual.V2HomeVisionSection),
    V2HomeChartSection: wrap('Chart', actual.V2HomeChartSection),
    V2HomeProgressSection: wrap('Progress', actual.V2HomeProgressSection),
    V2HomeCreamSplice: wrap('Splice', actual.V2HomeCreamSplice),
    V2HomeBrandMark: wrap('BrandMark', actual.V2HomeBrandMark),
  };
});

jest.mock('@/adapters/v2/home', () => ({
  ...jest.requireActual('@/adapters/v2/home'),
  useV2HomeModel: jest.fn(),
}));

import { V2HomeScreen } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, useV2HomeModel } from '@/adapters/v2/home';

const mockModel = useV2HomeModel as jest.Mock;

const INTENTS = {};
const NONE = { state: 'none' } as const;
const EMPTY = { state: 'empty' } as const;
const READY_TODAY = {
  state: 'ready',
  mode: 'focus',
  action: 'Focus',
  reason: 'daily_focus',
  completionSignal: null,
  threadDelta: null,
  threadDeltaStatus: 'UNAVAILABLE',
  durationSeconds: 30,
} as const;

const anchors = [makeAnchor({ id: 'a0' }), makeAnchor({ id: 'a1' })];

// Mirrors the identities `useV2HomeModel` memoises. Rebuilding these per call
// would measure the fixture's churn instead of the screen's.
const refreshers = {
  refreshVision: jest.fn(),
  refreshToday: jest.fn(),
  refreshChart: jest.fn(),
  refreshAnchors: jest.fn(),
};
const selectAnchor = jest.fn();
const anchorLists = anchors.map((_, selected) =>
  anchors.map((anchor, i) => ({ anchor, thread: toThreadPresentation(anchor), isSelected: i === selected })),
);
const threads = anchors.map((anchor) => toThreadPresentation(anchor));

const model = (selected: number, today: unknown) => ({
  greeting: 'Good morning',
  profileInitial: 'D',
  anchorState: 'ready',
  anchorError: null,
  hasAnchors: true,
  selectedAnchor: anchors[selected],
  thread: threads[selected],
  anchorList: anchorLists[selected],
  selectedIndex: selected,
  selectAnchor,
  vision: NONE,
  chart: NONE,
  progress: EMPTY,
  today,
  ...refreshers,
});

const renderHome = () =>
  render(
    <V2DailyShellIntentsProvider intents={INTENTS}>
      <V2HomeScreen />
    </V2DailyShellIntentsProvider>,
  );

it('does not re-render Home a second time when Today resolves after a switch', () => {
  mockModel.mockReturnValue(model(0, READY_TODAY));
  const view = renderHome();
  take();

  // 1. The switch itself. Today immediately goes back to resolving.
  mockModel.mockReturnValue(model(1, { state: 'loading' }));
  act(() => {
    view.rerender(
      <V2DailyShellIntentsProvider intents={INTENTS}>
        <V2HomeScreen />
      </V2DailyShellIntentsProvider>,
    );
  });
  const onSwitch = take();

  // Anchor-dependent sections re-derive, exactly once each.
  expect(onSwitch.Hero).toBe(1);
  expect(onSwitch.Carousel).toBe(1);
  expect(onSwitch.Today).toBe(1);
  // The greeting, the splice and the brand mark have nothing to do with the selected Anchor.
  expect(onSwitch.Header).toBeUndefined();
  expect(onSwitch.Splice).toBeUndefined();
  expect(onSwitch.BrandMark).toBeUndefined();

  // 2. Today's recommendation arrives. The carousel is mid-entrance here.
  mockModel.mockReturnValue(model(1, READY_TODAY));
  act(() => {
    view.rerender(
      <V2DailyShellIntentsProvider intents={INTENTS}>
        <V2HomeScreen />
      </V2DailyShellIntentsProvider>,
    );
  });
  const onSettle = take();

  expect(onSettle).toEqual({ Today: 1 });
});
