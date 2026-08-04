/**
 * Coverage for Workstream G's Chart analytics contract.
 *
 * The sanitizer is the privacy control standing between Chart screens and the
 * analytics provider. These pin its recursive behaviour, its fail-closed path,
 * and the shape of the Chart event catalog.
 *
 * Note the catalog is currently declarative: no Chart event has a call site
 * yet. The last test pins that, so wiring one becomes a deliberate change that
 * has to bring its own property review rather than arriving unnoticed.
 */

import fs from 'fs';
import path from 'path';
import { AnalyticsEvents, sanitizeAnalyticsProperties } from '../AnalyticsService';

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

    it('is not wired to any emitter yet, so no Chart event can fire', () => {
      // If this fails, a Chart event gained a call site: review its properties
      // against the frozen catalog and replace this with emission tests.
      const root = path.resolve(__dirname, '..', '..');
      const offenders: string[] = [];

      const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== '__tests__') walk(full);
            continue;
          }
          if (!/\.tsx?$/.test(entry.name)) continue;
          if (full.endsWith(path.join('services', 'AnalyticsService.ts'))) continue;
          const text = fs.readFileSync(full, 'utf8');
          if (/AnalyticsEvents\.(CHART_|COURSE_|MANUAL_COURSE_|WAYPOINT_|DESTINATION_|REFLECTION_)/.test(text)) {
            offenders.push(path.relative(root, full));
          }
        }
      };

      walk(root);
      expect(offenders).toEqual([]);
    });
  });
});
