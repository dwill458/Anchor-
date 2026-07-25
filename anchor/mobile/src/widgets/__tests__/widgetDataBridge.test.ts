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
  normalizeWidgetPracticeType,
  selectWidgetAnchorName,
} from '../widgetDataBridge';
import { getWidgetPrimeAnchorId, isWidgetPracticeDeepLink } from '../WidgetDeepLinkHandler';
import {
  buildWidgetPrimeDeepLink,
  WIDGET_FALLBACK_ANCHOR_NAME,
  WIDGET_HISTORY_DAYS,
} from '../widgetTypes';
import { buildPrimingHistoryEntry, localDateString } from '@/utils/primingAnalytics';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';
import type { Anchor } from '@/types';

// Fixed local "now": Sunday 2026-07-05 at noon
const NOW = new Date(2026, 6, 5, 12, 0, 0);

function primeEntry(
  isoDate: string,
  type: 'activate' | 'reinforce',
  suffix = '0',
  anchorId = 'anchor-1'
): PrimingHistoryEntry {
  const entry = buildPrimingHistoryEntry({
    id: `${isoDate}-${type}-${anchorId}-${suffix}`,
    anchorId,
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

    expect(byDate.get('2026-07-05')).toEqual({ date: '2026-07-05', level: 1, deep: false, mode: 'focus' });
    expect(byDate.get('2026-07-04')).toEqual({ date: '2026-07-04', level: 2, deep: false, mode: 'focus' });
    expect(byDate.get('2026-07-01')).toEqual({ date: '2026-07-01', level: 3, deep: false, mode: 'focus' });
    expect(byDate.get('2026-07-03')).toEqual({ date: '2026-07-03', level: 0, deep: false });
  });

  it('flags days containing a reinforce session as deep', () => {
    const entries = [
      { ...primeEntry('2026-07-04', 'reinforce'), completedAt: '2026-07-04T10:30:00.000' },
      primeEntry('2026-07-04', 'activate', 'b'),
    ];
    const history = buildWidgetHistory(entries, NOW);
    const day = history.find((d) => d.date === '2026-07-04');

    expect(day).toEqual({ date: '2026-07-04', level: 2, deep: true, mode: 'deep_prime' });
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
    anchors: [
      makeAnchor({
        id: 'a',
        intentionText: 'Deep work every morning',
        baseSigilSvg: '<svg viewBox="0 0 100 100"><path stroke="currentColor" /></svg>',
      }),
    ],
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
    expect(snapshot.anchorId).toBe('a');
    expect(snapshot.sigilSvg).toContain('currentColor');
    expect(snapshot.artworkSource).toBe('base_svg');
    expect(snapshot.artworkVersion).toContain('user-1:a:');
    expect(snapshot.history).toHaveLength(WIDGET_HISTORY_DAYS);
    expect(snapshot.streak).toBe(0);
  });

  it('prefers the final reinforced SVG and changes the artwork version when it changes', () => {
    const first = buildWidgetSnapshot({
      ...baseInputs,
      anchors: [makeAnchor({
        id: 'a',
        baseSigilSvg: '<svg viewBox="0 0 10 10"><path id="base" /></svg>',
        reinforcedSigilSvg: '<svg viewBox="0 0 10 10"><path id="final" /></svg>',
      })],
      primingHistory: [],
      lastPrimedAt: null,
    });
    const changed = buildWidgetSnapshot({
      ...baseInputs,
      anchors: [makeAnchor({
        id: 'a',
        baseSigilSvg: '<svg viewBox="0 0 10 10"><path id="base" /></svg>',
        reinforcedSigilSvg: '<svg viewBox="0 0 10 10"><path id="final-v2" /></svg>',
      })],
      primingHistory: [],
      lastPrimedAt: null,
    });

    expect(first.sigilSvg).toContain('final');
    expect(first.sigilSvg).not.toContain('base');
    expect(first.artworkSource).toBe('reinforced_svg');
    expect(changed.artworkVersion).not.toBe(first.artworkVersion);
  });

  it('prefers a finalized enhanced image while retaining its saved SVG as a graceful fallback', () => {
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      anchors: [makeAnchor({
        id: 'a',
        reinforcedSigilSvg: '<svg viewBox="0 0 10 10"><path id="final" /></svg>',
        enhancedImageUrl: 'https://example.com/final-anchor.png',
      })],
      primingHistory: [],
      lastPrimedAt: null,
    });

    expect(snapshot.artworkSource).toBe('enhanced_image');
    expect(snapshot.artworkImageUri).toBe('https://example.com/final-anchor.png');
    expect(snapshot.sigilSvg).toContain('final');
  });

  it('treats Visualize and legacy aliases as independent practice types', () => {
    expect(normalizeWidgetPracticeType('focus_session')).toBe('focus');
    expect(normalizeWidgetPracticeType('deepPrime')).toBe('deep_prime');
    expect(normalizeWidgetPracticeType('visualization')).toBe('visualize');
    expect(normalizeWidgetPracticeType('visualize_mode')).toBe('visualize');

    const visualize = {
      ...primeEntry('2026-07-05', 'activate'),
      id: 'visualize-session',
      type: 'visualization',
      practiceMode: 'visualize',
      completedAt: '2026-07-05T10:30:00.000',
    } as unknown as PrimingHistoryEntry;
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [primeEntry('2026-07-05', 'activate'), visualize],
      lastPrimedAt: '2026-07-05',
    });

    expect(snapshot.totalSessions).toBe(2);
    expect(snapshot.focusSessions).toBe(1);
    expect(snapshot.visualizeSessions).toBe(1);
    expect(snapshot.currentWeek.find((day) => day.date === '2026-07-05')).toMatchObject({
      hasFocus: true,
      hasVisualize: true,
    });
    expect(snapshot.history[snapshot.history.length - 1]).toMatchObject({ level: 2, mode: 'visualize' });
  });

  it('mirrors Thread Strength summary values into the large-widget snapshot', () => {
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [
        primeEntry('2026-07-02', 'activate'),
        primeEntry('2026-07-03', 'reinforce'),
        primeEntry('2026-07-04', 'activate'),
        primeEntry('2026-07-05', 'activate'),
      ],
      lastPrimedAt: '2026-07-05',
      threadStrength: 39,
      threadStrengthSensitivity: 'strict',
    });

    expect(snapshot.threadStrength).toBe(39);
    expect(snapshot.totalSessions).toBe(4);
    expect(snapshot.focusSessions).toBe(3);
    expect(snapshot.deepPrimeSessions).toBe(1);
    expect(snapshot.deepPrimePercent).toBe(25);
    expect(snapshot.longestStreak).toBe(4);
    expect(snapshot.sensitivityLabel).toBe('Strict');
    expect(snapshot.currentWeek.find((day) => day.date === '2026-07-05')).toMatchObject({
      isToday: true,
      hasFocus: true,
    });
  });

  it('scopes the medium-widget anchor metrics to the selected anchor only', () => {
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [
        // Selected anchor "a": 2-day thread, one deep prime
        primeEntry('2026-07-04', 'activate', '0', 'a'),
        primeEntry('2026-07-05', 'activate', '0', 'a'),
        primeEntry('2026-07-05', 'reinforce', '0', 'a'),
        // Another anchor's sessions must not leak into the anchor metrics
        primeEntry('2026-07-01', 'activate', '0', 'other'),
        primeEntry('2026-07-02', 'activate', '0', 'other'),
        primeEntry('2026-07-05', 'activate', '0', 'other'),
      ],
      lastPrimedAt: '2026-07-05',
    });

    expect(snapshot.anchorTotalSessions).toBe(3);
    expect(snapshot.anchorDayStreak).toBe(2);
    expect(snapshot.anchorDeepPrimeSessions).toBe(1);
    // Practice-wide totals still count everything
    expect(snapshot.totalSessions).toBe(6);
  });

  it('keeps the anchor day thread alive when the last session was yesterday', () => {
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [
        primeEntry('2026-07-03', 'activate', '0', 'a'),
        primeEntry('2026-07-04', 'activate', '0', 'a'),
      ],
      lastPrimedAt: '2026-07-04',
    });
    expect(snapshot.anchorDayStreak).toBe(2);

    const broken = buildWidgetSnapshot({
      ...baseInputs,
      primingHistory: [primeEntry('2026-07-03', 'activate', '0', 'a')],
      lastPrimedAt: '2026-07-03',
    });
    expect(broken.anchorDayStreak).toBe(0);
  });

  it('zeroes anchor metrics when no active anchor exists', () => {
    const snapshot = buildWidgetSnapshot({
      ...baseInputs,
      anchors: [],
      currentAnchorId: undefined,
      primingHistory: [primeEntry('2026-07-05', 'activate')],
      lastPrimedAt: '2026-07-05',
    });
    expect(snapshot.anchorTotalSessions).toBe(0);
    expect(snapshot.anchorDayStreak).toBe(0);
    expect(snapshot.anchorDeepPrimeSessions).toBe(0);
  });
});

describe('widget prime deep link', () => {
  it('preserves the selected anchor id in the 2×2 widget target', () => {
    const url = buildWidgetPrimeDeepLink('anchor/with spaces');
    expect(url).toBe('anchor://prime?anchorId=anchor%2Fwith%20spaces');
    expect(getWidgetPrimeAnchorId(url)).toBe('anchor/with spaces');
    expect(getWidgetPrimeAnchorId('anchor://practice')).toBeNull();
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
