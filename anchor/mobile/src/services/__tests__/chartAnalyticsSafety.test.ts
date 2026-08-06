/**
 * Coverage for Workstream G's Chart analytics contract.
 *
 * The sanitizer is the privacy control standing between Chart screens and the
 * analytics provider. These pin its recursive behaviour, its fail-closed path,
 * and the shape of the Chart event catalog.
 *
 * Production call sites use the same typed boundary and stable operation keys;
 * this suite pins the shared sanitizer and deduplication contract beneath them.
 */

import {
  AnalyticsEvents,
  AnalyticsService,
  resetChartAnalyticsDeduplication,
  sanitizeAnalyticsProperties,
  sanitizeChartAnalyticsProperties,
  trackChartEventOnce,
} from '../AnalyticsService';

const chartEventNames = Object.entries(AnalyticsEvents)
  .filter(([key]) => /^(CHART_|COURSE_|MANUAL_COURSE_|WAYPOINT_|DESTINATION_|REFLECTION_)/.test(key))
  .map(([, value]) => value as string);

describe('Chart analytics safety (Workstream G)', () => {
  describe('property sanitizer', () => {
    it('removes user-authored text at the top level', () => {
      const safe = sanitizeAnalyticsProperties({
        waypoint_index: 2,
        destination_text: 'a private destination',
        reflection: 'private writing',
        notes: 'more private writing',
        body: 'still private',
      });

      expect(safe).toEqual({ waypoint_index: 2 });
    });

    it('removes sensitive keys recursively through nested objects', () => {
      const safe = sanitizeAnalyticsProperties({
        course: {
          waypoint_count: 3,
          destination_text: 'a private destination',
          nested: { deeper: { notes: 'private', state: 'REACHED' } },
        },
      });

      expect(safe).toEqual({
        course: { waypoint_count: 3, nested: { deeper: { state: 'REACHED' } } },
      });
      expect(JSON.stringify(safe)).not.toContain('private');
    });

    it('sanitizes objects inside arrays', () => {
      const safe = sanitizeAnalyticsProperties({
        waypoints: [
          { position: 1, title: 'a private waypoint title', state: 'REACHED' },
          { position: 2, notes: 'private', state: 'CURRENT' },
        ],
      });

      expect(safe).toEqual({
        waypoints: [
          { position: 1, state: 'REACHED' },
          { position: 2, state: 'CURRENT' },
        ],
      });
    });

    it('normalizes key casing and punctuation before matching', () => {
      const safe = sanitizeAnalyticsProperties({
        'Destination-Text': 'private',
        RAW_OUTPUT: 'private',
        'error.message': 'private',
        waypointIndex: 1,
      });

      expect(safe).toEqual({ waypointIndex: 1 });
    });

    it('fails closed rather than passing an unhandled value through', () => {
      const hostile = {
        get exploding(): unknown {
          throw new Error('nope');
        },
        destination_text: 'private',
      };

      expect(sanitizeAnalyticsProperties(hostile)).toEqual({});
    });

    it('survives a self-referencing object without leaking text', () => {
      const cyclic: Record<string, unknown> = { waypoint_index: 1, notes: 'private' };
      cyclic.self = cyclic;

      const safe = sanitizeAnalyticsProperties(cyclic);
      expect(JSON.stringify(safe ?? {})).not.toContain('private');
    });

    it('passes undefined through untouched', () => {
      expect(sanitizeAnalyticsProperties(undefined)).toBeUndefined();
    });
  });

  describe('event catalog', () => {
    it('uses lower snake_case names only', () => {
      expect(chartEventNames.length).toBeGreaterThan(0);
      for (const name of chartEventNames) {
        expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });

    it('has no duplicate names', () => {
      expect(new Set(chartEventNames).size).toBe(chartEventNames.length);
    });

    it('does not redefine the canonical Practice completion event', () => {
      // Chart practice must never double-count the canonical Practice funnel.
      expect(chartEventNames).not.toContain('practice_session_completed');
      expect(AnalyticsEvents.PRACTICE_SESSION_COMPLETED).toBe('practice_session_completed');
    });

    it('keeps the Chart property surface typed and fail-closed', () => {
      const canary = 'chart-privacy-canary';
      expect(
        sanitizeChartAnalyticsProperties({
          waypoint_state: 'CURRENT',
          waypoint_count: 3,
          destination_text: canary,
          planner_input: canary,
          arbitrary_text: canary,
          nested: { error_category: 'network' },
        }),
      ).toEqual({ waypoint_state: 'CURRENT', waypoint_count: 3 });
    });

    it('deduplicates by account, event, and stable operation key', () => {
      const track = jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);
      resetChartAnalyticsDeduplication();

      expect(trackChartEventOnce(AnalyticsEvents.WAYPOINT_COMPLETED, 'account-a', 'event-1', {
        waypoint_state: 'REACHED',
        server_confirmed: true,
      })).toBe(true);
      expect(trackChartEventOnce(AnalyticsEvents.WAYPOINT_COMPLETED, 'account-a', 'event-1', {
        waypoint_state: 'REACHED',
        server_confirmed: true,
      })).toBe(false);
      expect(trackChartEventOnce(AnalyticsEvents.WAYPOINT_COMPLETED, 'account-b', 'event-1', {
        waypoint_state: 'REACHED',
        server_confirmed: true,
      })).toBe(true);
      expect(track).toHaveBeenCalledTimes(2);
      expect(track.mock.calls[0][1]).toEqual({ waypoint_state: 'REACHED', server_confirmed: true });

      track.mockRestore();
    });
  });
});
