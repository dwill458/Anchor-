/**
 * Widget data bridge — snapshot adapter tests.
 *
 * Covers the pure builders (history mapping, anchor resolution, snapshot
 * assembly) plus the widget deep-link matcher. The platform push paths
 * (requestWidgetUpdate / AnchorWidgetBridge) are exercised on-device.
 */

import {
  buildWidgetHistory,
  buildWidgetSnapshot,
  selectWidgetAnchorName,
} from '../widgetDataBridge';
import { isWidgetPracticeDeepLink } from '../WidgetDeepLinkHandler';
import { WIDGET_FALLBACK_ANCHOR_NAME, WIDGET_HISTORY_DAYS } from '../widgetTypes';
import { buildPrimingHistoryEntry, localDateString } from '@/utils/primingAnalytics';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';
import type { Anchor } from '@/types';

// Fixed local "now": Sunday 2026-07-05 at noon
const NOW = new Date(2026, 6, 5, 12, 0, 0);

function primeEntry(
  isoDate: string,
  type: 'activate' | 'reinforce',
  suffix = '0'
): PrimingHistoryEntry {
  const entry = buildPrimingHistoryEntry({
    id: `${isoDate}-${type}-${suffix}`,
    anchorId: 'anchor-1',
    type,
    completedAt: `${isoDate}T09:30:00.000`,
  });
  if (!entry) {
    throw new Error(`Failed to build priming entry fixture for ${isoDate}`);
  }
  return entry;
}

function makeAnchor(overrides: Partial<Anchor>): Anchor {
  return {
    id: 'anchor-1',
    userId: 'user-1',
    intentionText: 'Deep work every morning',
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides,
  } as unknown as Anchor;
}

describe('buildWidgetHistory', () => {
  it('produces one entry per day for the trailing window, oldest first, ending today', () => {
    const history = buildWidgetHistory([], NOW);

    expect(history).toHaveLength(WIDGET_HISTORY_DAYS);
    expect(history[WIDGET_HISTORY_DAYS - 1].date).toBe('2026-07-05');
    // 125 days before 2026-07-05
    expect(history[0].date).toBe('2026-03-02');
    expect(history.every((day) => day.level === 0 && !day.deep)).toBe(true);
  });

  it('maps per-day session counts to levels capped at 3', () => {
    const entries = [
      primeEntry('2026-07-05', 'activate'),
      primeEntry('2026-07-04', 'activate', 'a'),
      primeEntry('2026-07-04', 'activate', 'b'),
      primeEntry('2026-07-01', 'activate', 'a'),
      primeEntry('2026-07-01', 'activate', 'b'),
      primeEntry('2026-07-01', 'activate', 'c'),
      primeEntry('2026-07-01', 'activate', 'd'),
    ];
    const history = buildWidgetHistory(entries, NOW);
    const byDate = new Map(history.map((day) => [day.date, day]));

    expect(byDate.get('2026-07-05')).toEqual({ date: '2026-07-05', level: 1, deep: false });
    expect(byDate.get('2026-07-04')).toEqual({ date: '2026-07-04', level: 2, deep: false });
    expect(byDate.get('2026-07-01')).toEqual({ date: '2026-07-01', level: 3, deep: false });
    expect(byDate.get('2026-07-03')).toEqual({ date: '2026-07-03', level: 0, deep: false });
  });

  it('flags days containing a reinforce session as deep', () => {
    const entries = [
      primeEntry('2026-07-04', 'reinforce'),
      primeEntry('2026-07-04', 'activate', 'b'),
    ];
    const history = buildWidgetHistory(entries, NOW);
    const day = history.find((d) => d.date === '2026-07-04');

    expect(day).toEqual({ date: '2026-07-04', level: 2, deep: true });
  });

  it('ignores sessions older than the trailing window', () => {
    const history = buildWidgetHistory([primeEntry('2025-12-25', 'activate')], NOW);
    expect(history.every((day) => day.level === 0)).toBe(true);
  });
});

describe('selectWidgetAnchorName', () => {
  it('prefers the currently selected active anchor', () => {
    const anchors = [
      makeAnchor({ id: 'a', intentionText: 'First anchor' }),
      makeAnchor({ id: 'b', intentionText: 'Chosen anchor' }),
    ];
    expect(selectWidgetAnchorName(anchors, 'b')).toBe('Chosen anchor');
  });

  it('falls back to the most recent active anchor when selection is released', () => {
    const anchors = [
      makeAnchor({ id: 'a', intentionText: 'Released anchor', isReleased: true }),
      makeAnchor({ id: 'b', intentionText: 'Living anchor' }),
    ];
    expect(selectWidgetAnchorName(anchors, 'a')).toBe('Living anchor');
  });

  it('skips archived anchors and falls back to the default name when none remain', () => {
    const anchors = [
      makeAnchor({ id: 'a', intentionText: 'Archived', archivedAt: new Date() }),
    ];
    expect(selectWidgetAnchorName(anchors, undefined)).toBe(WIDGET_FALLBACK_ANCHOR_NAME);
    expect(selectWidgetAnchorName([], undefined)).toBe(WIDGET_FALLBACK_ANCHOR_NAME);
  });
});

describe('buildWidgetSnapshot', () => {
  const baseInputs = {
    anchors: [makeAnchor({ id: 'a', intentionText: 'Deep work every morning' })],
    currentAnchorId: 'a',
    lastGraceDayUsedAt: null,
    now: NOW,
  };

  it('marks primedToday only when lastPrimedAt is the local today', () => {
    const today = localDateString(NOW);
    const primed = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [primeEntry(today, 'activate')],
      lastPrimedAt: today,
    });
    expect(primed.primedToday).toBe(true);
    expect(primed.lastPrimedDate).toBe(today);
    expect(primed.streak).toBeGreaterThanOrEqual(1);

    const stale = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [primeEntry('2026-07-01', 'activate')],
      lastPrimedAt: '2026-07-01',
    });
    expect(stale.primedToday).toBe(false);
    expect(stale.lastPrimedDate).toBe('2026-07-01');
  });

  it('assembles the anchor name and full history window', () => {
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [],
      lastPrimedAt: null,
    });
    expect(snapshot.anchorName).toBe('Deep work every morning');
    expect(snapshot.history).toHaveLength(WIDGET_HISTORY_DAYS);
    expect(snapshot.streak).toBe(0);
  });
});

describe('isWidgetPracticeDeepLink', () => {
  it('matches the widget practice deep link', () => {
    expect(isWidgetPracticeDeepLink('anchor://practice')).toBe(true);
    expect(isWidgetPracticeDeepLink('anchor://practice/')).toBe(true);
    expect(isWidgetPracticeDeepLink('ANCHOR://PRACTICE')).toBe(true);
  });

  it('rejects other urls', () => {
    expect(isWidgetPracticeDeepLink(null)).toBe(false);
    expect(isWidgetPracticeDeepLink(undefined)).toBe(false);
    expect(isWidgetPracticeDeepLink('')).toBe(false);
    expect(isWidgetPracticeDeepLink('anchor://vault')).toBe(false);
    expect(isWidgetPracticeDeepLink('https://practice')).toBe(false);
    expect(isWidgetPracticeDeepLink('exp+anchor://practice')).toBe(false);
  });
});
