jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => true, useCreationReduceMotion: () => true }));

const mockFetch = jest.fn();
const mockHistory = jest.fn();
jest.mock('@/adapters/v2/weeklyRecap/weeklyRecapApi', () => {
  const actual = jest.requireActual('@/adapters/v2/weeklyRecap/weeklyRecapApi');
  return { ...actual, fetchWeeklyRecap: (...a: unknown[]) => mockFetch(...a), fetchWeeklyRecapHistory: (...a: unknown[]) => mockHistory(...a) };
});
const mockReadCache = jest.fn();
const mockWriteCache = jest.fn();
jest.mock('@/adapters/v2/weeklyRecap/weeklyRecapCache', () => ({ readCachedRecap: (...a: unknown[]) => mockReadCache(...a), writeCachedRecap: (...a: unknown[]) => mockWriteCache(...a) }));
const mockFeedback = jest.fn(async () => undefined);
const mockLegacyHistory = jest.fn(async () => [] as unknown[]);
jest.mock('@/adapters/v2/weeklyInsight/weeklyInsightApiAdapter', () => ({
  persistWeeklyInsightFeedback: (...a: unknown[]) => (mockFeedback as any)(...a),
  fetchWeeklyInsightHistory: () => mockLegacyHistory(),
}));
let mockAnchors: any[] = [];
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: (selector: (s: any) => unknown) => selector({ anchors: mockAnchors }) }));
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => ({ CircularAnchorRenderer: () => null }));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import fixture from '@/adapters/v2/weeklyRecap/__fixtures__/weeklyRecapV2.sample.json';
import { WeeklyRecapRequestError } from '@/adapters/v2/weeklyRecap/weeklyRecapApi';
import type { WeeklyRecap } from '@/adapters/v2/weeklyRecap/types';
import { V2WeeklyRecapScreen } from '../V2WeeklyRecapScreen';

const recap = fixture as unknown as WeeklyRecap;
const copy = (patch: Partial<WeeklyRecap> = {}): WeeklyRecap => ({ ...JSON.parse(JSON.stringify(recap)), ...patch });
const envelope = (r: WeeklyRecap, feedback: string | null = null) => ({ id: 'snap-1', recap: r, feedback, updatedAt: '' });
const anchor = (id: string, extra: object = {}) => ({ id, baseSigilSvg: '<svg/>', category: 'creativity', ...extra });
const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };

const open = async (props: object = {}) => {
  const view = render(<V2WeeklyRecapScreen navigation={navigation} {...props} />);
  await waitFor(() => expect(view.queryByTestId('v2-weekly-recap-loading')).toBeNull());
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAnchors = [anchor('a1')];
  mockReadCache.mockResolvedValue(null);
  mockFetch.mockResolvedValue(envelope(recap));
  mockHistory.mockResolvedValue({ items: [], nextCursor: null });
});

describe('a finalized recap', () => {
  it('tells the week as one story: opening, one hero, concise stats, a seven-day strip, highlights, reflection', async () => {
    const view = await open();
    expect(view.getByText('A milestone worth remembering.')).toBeTruthy();
    expect(view.getByTestId('recap-hero')).toBeTruthy();
    expect(view.getByText('Finish the first draft')).toBeTruthy();
    expect(view.getByText('1 move finished on the way')).toBeTruthy();
    expect(view.getByTestId('recap-stat-PRACTICE_DAYS')).toBeTruthy();
    expect(view.getByTestId('recap-stat-MOVES')).toBeTruthy();
    expect(view.getAllByTestId(/^recap-day-/)).toHaveLength(7);
    expect(view.getByTestId('recap-highlights')).toBeTruthy();
    expect(view.getByTestId('recap-reflection')).toBeTruthy();
    expect(view.queryByTestId('recap-provisional')).toBeNull();
    expect(mockWriteCache).toHaveBeenCalledWith(expect.objectContaining({ id: 'snap-1' }), true);
  });
  it('collects feedback against the final recap', async () => {
    const view = await open();
    fireEvent.press(view.getByLabelText('Rate Mostly'));
    await waitFor(() => expect(mockFeedback).toHaveBeenCalledWith('snap-1', 'Mostly'));
  });
  it('does not repeat itself: one hero, and the hero is not also a highlight', async () => {
    const view = await open();
    expect(view.getAllByText('Finish the first draft')).toHaveLength(1);
  });
});

describe('provisional recaps are labelled and not rated', () => {
  it.each([
    ['SYNCING', /Tuesday at noon/],
    ['WEEK_IN_PROGRESS', /so far/],
    ['INCOMPLETE_DATA', /could not be loaded/],
  ] as const)('%s', async (reason, text) => {
    mockFetch.mockResolvedValue(envelope(copy({ status: 'DRAFT', provisional: { isProvisional: true, reason } })));
    const view = await open();
    expect(view.getByTestId('recap-provisional').props.children).toMatch(text);
    expect(view.queryByTestId('recap-feedback')).toBeNull();
  });
});

describe('completed moves are shown as progress', () => {
  it('a week of moves with no waypoint reads as progress, not a quiet week', async () => {
    const r = copy({
      hero: { kind: 'MOVES_PROGRESS', dedupeKey: 'moves:2026-10-12', anchorId: 'a1', courseId: 'c1', title: '3 moves', dateKey: '2026-10-15', count: 3, labels: [] },
      opening: { headline: 'You kept your Chart moving.', summary: 'You finished 3 moves this week.' }, highlights: [],
    });
    mockFetch.mockResolvedValue(envelope(r));
    const view = await open();
    expect(view.getByText('3 moves finished')).toBeTruthy();
    expect(view.getByText('You finished 3 moves this week.')).toBeTruthy();
    expect(view.queryByText(/quiet/i)).toBeNull();
  });
});

describe('Anchors, context and navigation', () => {
  const twoAnchors = () => {
    const r = copy({ anchors: [{ anchorId: 'a1', practiceDays: 3, practices: 3, moves: 2, waypoints: 1 }, { anchorId: 'a2', practiceDays: 1, practices: 1, moves: 0, waypoints: 0 }] });
    r.refs.anchors.a2 = { intention: 'Learn piano', categoryKey: 'learning', isReleased: true };
    return r;
  };
  it('links only Anchors that exist on this device; others stay readable but inert', async () => {
    mockFetch.mockResolvedValue(envelope(twoAnchors()));
    const view = await open();
    expect(view.getByText(/Learn piano · Released/)).toBeTruthy();
    fireEvent.press(view.getByTestId('recap-anchor-a1'));
    expect(navigation.navigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a1' });
    navigation.navigate.mockClear();
    fireEvent.press(view.getByTestId('recap-anchor-a2'));
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(view.getByTestId('recap-anchor-a2').props.accessibilityRole).toBeUndefined();
  });
  it('opens Anchor Details for a released Anchor that is still on the device', async () => {
    mockAnchors = [anchor('a1'), anchor('a2', { isReleased: true, archivedAt: new Date() })];
    mockFetch.mockResolvedValue(envelope(twoAnchors()));
    const view = await open();
    fireEvent.press(view.getByTestId('recap-anchor-a2'));
    expect(navigation.navigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a2' });
  });
  it('an archived (deleted, not released) Anchor is not a link', async () => {
    mockAnchors = [anchor('a1'), anchor('a2', { archivedAt: new Date() })];
    mockFetch.mockResolvedValue(envelope(twoAnchors()));
    const view = await open();
    fireEvent.press(view.getByTestId('recap-anchor-a2'));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
  it('keeps Anchor context from Progress by highlighting that Anchor, while the recap stays global', async () => {
    mockFetch.mockResolvedValue(envelope(twoAnchors()));
    const view = await open({ route: { params: { anchorId: 'a2' } } });
    expect(view.getByTestId('recap-anchor-a1')).toBeTruthy();
    expect(view.getByTestId('recap-anchor-a2')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith('latest');
  });
  it('offers one live next step that opens the Chart for chart progress', async () => {
    const view = await open();
    fireEvent.press(view.getByTestId('recap-next-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'a1' });
  });
  it('offers no next step when the Anchor cannot be opened', async () => {
    mockAnchors = [];
    const view = await open();
    expect(view.queryByTestId('recap-next-action')).toBeNull();
  });
});

describe('offline, errors, empty, disabled', () => {
  it('shows the saved copy when offline', async () => {
    mockReadCache.mockResolvedValue(envelope(recap));
    mockFetch.mockRejectedValue(new WeeklyRecapRequestError('offline', 'offline'));
    const view = await open();
    await waitFor(() => expect(view.getByTestId('recap-offline')).toBeTruthy());
    expect(view.getByText('A milestone worth remembering.')).toBeTruthy();
  });
  it('shows a retry, not fake content, when there is nothing saved and the network fails', async () => {
    mockFetch.mockRejectedValueOnce(new WeeklyRecapRequestError('offline', 'offline'));
    const view = render(<V2WeeklyRecapScreen navigation={navigation} />);
    await waitFor(() => expect(view.getByTestId('v2-weekly-recap-error')).toBeTruthy());
    mockFetch.mockResolvedValueOnce(envelope(recap));
    await act(async () => { fireEvent.press(view.getByTestId('v2-weekly-recap-retry')); });
    await waitFor(() => expect(view.getByTestId('v2-weekly-recap')).toBeTruthy());
  });
  it('shows the first-week empty state when there is no history', async () => {
    mockFetch.mockResolvedValue(null);
    const view = render(<V2WeeklyRecapScreen navigation={navigation} />);
    await waitFor(() => expect(view.getByTestId('v2-weekly-recap-empty')).toBeTruthy());
  });
  it('hands over to the legacy screen when the server has the feature off', async () => {
    mockFetch.mockRejectedValue(new WeeklyRecapRequestError('disabled', 'off'));
    const onDisabled = jest.fn();
    render(<V2WeeklyRecapScreen navigation={navigation} onDisabled={onDisabled} />);
    await waitFor(() => expect(onDisabled).toHaveBeenCalled());
  });
});

describe('history keeps every earlier week reachable', () => {
  it('lists 2.0 weeks and earlier legacy snapshots; legacy opens the legacy screen by id', async () => {
    mockHistory.mockResolvedValue({ items: [{ id: 'h1', weekKey: '2026-10-05', label: 'Oct 5 – 11', status: 'FINAL', heroKind: 'STEADY', headline: 'Small steps. Real movement.', provisional: false, schemaVersion: 2 }], nextCursor: null });
    mockLegacyHistory.mockResolvedValue([{ id: 'old-1', weekLabel: 'Sep 28 – Oct 4', headline: 'Old headline' }]);
    const view = await open();
    fireEvent.press(view.getByTestId('v2-weekly-recap-history'));
    await waitFor(() => expect(view.getByTestId('recap-history-2026-10-05')).toBeTruthy());
    await waitFor(() => expect(view.getByTestId('recap-legacy-old-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('recap-legacy-old-1'));
    expect(navigation.navigate).toHaveBeenCalledWith('V2WeeklyInsight', { snapshotId: 'old-1' });
    fireEvent.press(view.getByTestId('v2-weekly-recap-history'));
    await waitFor(() => view.getByTestId('recap-history-2026-10-05'));
    mockFetch.mockClear();
    fireEvent.press(view.getByTestId('recap-history-2026-10-05'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('2026-10-05'));
  });
});
