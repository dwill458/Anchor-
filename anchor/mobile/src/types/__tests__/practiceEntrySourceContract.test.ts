/**
 * Mobile half of the frozen `practiceEntrySource` contract proof.
 *
 * `chart_waypoint_detail` was frozen by Workstream A on the server
 * (`backend/src/types/chart.ts`, the POST /api/practice/sessions Zod enum, and
 * the Workstream A migration). Workstream E mirrors it here. The literal list
 * below is duplicated verbatim in
 * `backend/src/api/routes/__tests__/practiceEntrySourceContract.test.ts`, so a
 * one-sided change fails on the other side.
 */

import type { PracticeEntrySource } from '@/types/practice';
import { isChartPracticeContext, isChartPracticeEntrySource } from '@/types/practice';

const FROZEN_PRACTICE_ENTRY_SOURCES = [
  'practice_hero',
  'practice_deep_prime_card',
  'practice_focus_card',
  'practice_visualize_card',
  'practice_release_card',
  'anchor_detail',
  'sanctuary_prime_anchor',
  'widget',
  'shortcut',
  'evolve',
  'chart',
  'chart_waypoint_detail',
] as const;

describe('mobile practiceEntrySource matches the frozen backend contract', () => {
  it('exposes exactly the frozen union members', () => {
    // A union member added or removed on the mobile side without the same
    // change on the server fails to type-check here.
    const exhaustive: Record<PracticeEntrySource, true> = {
      practice_hero: true,
      practice_deep_prime_card: true,
      practice_focus_card: true,
      practice_visualize_card: true,
      practice_release_card: true,
      anchor_detail: true,
      sanctuary_prime_anchor: true,
      widget: true,
      shortcut: true,
      evolve: true,
      chart: true,
      chart_waypoint_detail: true,
    };

    expect(Object.keys(exhaustive).sort()).toEqual([...FROZEN_PRACTICE_ENTRY_SOURCES].sort());
  });

  it('only carries the frozen Chart entry sources', () => {
    const chartSources = FROZEN_PRACTICE_ENTRY_SOURCES.filter((source) =>
      source.startsWith('chart'),
    );
    expect(chartSources).toEqual(['chart', 'chart_waypoint_detail']);
  });

  it('accepts the frozen value as a Chart entry source', () => {
    expect(isChartPracticeEntrySource('chart_waypoint_detail')).toBe(true);
    expect(isChartPracticeEntrySource('chart')).toBe(true);
  });

  it('accepts only a well-formed Chart practice context', () => {
    expect(
      isChartPracticeContext({ courseId: 'course-1', waypointId: 'waypoint-1', courseVersion: 1 }),
    ).toBe(true);
    // courseVersion is load-bearing: it is what a later completion sends as
    // expectedCourseVersion, so a context without it is not usable.
    expect(isChartPracticeContext({ courseId: 'course-1', waypointId: 'waypoint-1' })).toBe(false);
  });

  it('rejects near-duplicate or unknown Chart entry sources', () => {
    // 'chart' is excluded here — it is a real frozen source, asserted above.
    for (const source of [
      'chart_waypoint_details',
      'chart_waypoint',
      'chart-waypoint-detail',
      'CHART_WAYPOINT_DETAIL',
      '',
      null,
      undefined,
    ]) {
      expect(isChartPracticeEntrySource(source as never)).toBe(false);
    }
  });
});
