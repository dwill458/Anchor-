/**
 * Regression suite for H-004 — Chart rollback must not destroy user data.
 *
 * The shipped rollback script dropped the Chart tables unconditionally under a
 * header that read as production-capable, so an operator improvising during an
 * incident would permanently delete every Reflection body. Re-applying the
 * migration afterwards restores nothing.
 *
 * Two halves are proven here:
 *   - the destructive SQL is fail-closed and clearly labelled disposable-only,
 *     and no runbook points production at it;
 *   - the supported production rollback is flag composition, which changes no
 *     rows and leaves Sanctuary and Practice fully available.
 *
 * Data preservation against a real database is proven separately by
 * `scripts/verify-chart-rollback.js` (see docs/runbooks/CHART_ROLLBACK.md).
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const migrations = path.join(repoRoot, 'backend', 'prisma', 'migrations');
const productionRollback = path.join(
  migrations,
  'ROLLBACK_20260802000000_add_chart_backend_foundation.sql'
);
const devRollback = path.join(
  migrations,
  'DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql'
);
const runbook = path.join(repoRoot, 'docs', 'runbooks', 'CHART_ROLLBACK.md');

const read = (file: string) => fs.readFileSync(file, 'utf8');

const OPT_IN = "'i_understand_this_permanently_deletes_chart_data'";

describe('Chart rollback safety (H-004)', () => {
  describe('the production rollback script', () => {
    const sql = read(productionRollback);

    it('drops nothing', () => {
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/DROP\s+COLUMN/i);
      expect(sql).not.toMatch(/DELETE\s+FROM/i);
    });

    it('fails closed on a default invocation', () => {
      expect(sql).toMatch(/RAISE\s+EXCEPTION/i);
    });

    it('redirects the operator to the flag-based procedure', () => {
      expect(sql).toContain('docs/runbooks/CHART_ROLLBACK.md');
    });
  });

  describe('the disposable-development script', () => {
    const sql = read(devRollback);

    it('is named and headed as disposable-only', () => {
      expect(path.basename(devRollback)).toMatch(/^DEV_ONLY_DESTRUCTIVE_ROLLBACK_/);
      const header = sql.slice(0, sql.indexOf('DO $$'));
      expect(header).toMatch(/DISPOSABLE DEVELOPMENT DATABASES ONLY/i);
      expect(header).toMatch(/NEVER RUN THIS IN PRODUCTION/i);
    });

    it('states the loss is permanent and irreversible', () => {
      const header = sql.slice(0, sql.indexOf('DO $$'));
      expect(header).toMatch(/PERMANENTLY DELETED/i);
      expect(header).toMatch(/IRREVERSIBLE/i);
      expect(header).toMatch(/restores nothing|recovers none/i);
    });

    it('aborts before any destructive statement unless the session opts in', () => {
      const guardEnd = sql.indexOf('$$;');
      const firstDrop = sql.search(/DROP\s+TABLE/i);
      expect(guardEnd).toBeGreaterThan(-1);
      expect(firstDrop).toBeGreaterThan(guardEnd);

      const guard = sql.slice(0, guardEnd);
      expect(guard).toContain("current_setting('anchor.chart_destructive_rollback', true)");
      expect(guard).toContain('IS DISTINCT FROM');
      expect(guard).toContain(OPT_IN);
      expect(guard).toMatch(/RAISE\s+EXCEPTION/i);
    });

    it('warns loudly on the opted-in path', () => {
      expect(sql).toMatch(/RAISE\s+WARNING/i);
      expect(sql).toMatch(/permanently deleted and cannot be recovered/i);
    });

    it('still removes the migration record so the migration can be reapplied', () => {
      expect(sql).toContain('_prisma_migrations');
      expect(sql).toContain('20260802000000_add_chart_backend_foundation');
    });
  });

  describe('the runbooks', () => {
    it('documents the flag-based procedure as authoritative', () => {
      const doc = read(runbook);
      for (const variable of [
        'ENABLE_CHART_AI_PLANNER',
        'ENABLE_CHART_REFLECTIONS',
        'ENABLE_CHART_WRITE',
        'CHART_ROLLOUT_PERCENT',
        'ENABLE_CHART',
        'CHART_KILL_SWITCH',
      ]) {
        expect(doc).toContain(variable);
      }
      expect(doc).toMatch(/deletes nothing/i);
      expect(doc).toMatch(/## 3\. Verification queries/);
      expect(doc).toMatch(/## 4\. Recovery/);
    });

    it('never instructs an operator to run destructive SQL against production', () => {
      const docsDir = path.join(repoRoot, 'docs');
      const offenders: string[] = [];

      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!entry.name.endsWith('.md')) continue;
          const text = read(full);
          if (!/DEV_ONLY_DESTRUCTIVE_ROLLBACK|ROLLBACK_20260802000000/.test(text)) continue;
          // A mention is fine only where it is framed as disposable/refusing.
          if (!/disposable|refuses|never|DEV_ONLY/i.test(text)) offenders.push(full);
        }
      };

      walk(docsDir);
      expect(offenders).toEqual([]);
    });
  });

  describe('flag-based withdrawal', () => {
    const loadFlags = (overrides: Record<string, string>) => {
      jest.resetModules();
      const previous = { ...process.env };
      Object.assign(process.env, overrides);
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('../chartFlags') as typeof import('../chartFlags');
      } finally {
        process.env = previous;
      }
    };

    const allOn = {
      ENABLE_CHART: 'true',
      ENABLE_CHART_WRITE: 'true',
      ENABLE_CHART_REFLECTIONS: 'true',
      ENABLE_CHART_AI_PLANNER: 'true',
      CHART_ROLLOUT_PERCENT: '100',
      CHART_KILL_SWITCH: 'false',
    };

    it('is off by default, so deploying the migration exposes nothing', () => {
      const { getChartFeatureFlags, isAccountInChartRollout } = loadFlags({
        ENABLE_CHART: '',
        ENABLE_CHART_WRITE: '',
        ENABLE_CHART_REFLECTIONS: '',
        ENABLE_CHART_AI_PLANNER: '',
        CHART_ROLLOUT_PERCENT: '',
        CHART_KILL_SWITCH: '',
      });
      expect(Object.values(getChartFeatureFlags()).every((value) => value === false)).toBe(true);
      expect(isAccountInChartRollout('account-1')).toBe(false);
    });

    it('withdraws generation without withdrawing the rest', () => {
      const { getChartFeatureFlags } = loadFlags({ ...allOn, ENABLE_CHART_AI_PLANNER: 'false' });
      const flags = getChartFeatureFlags();
      expect(flags.chart_ai_planner_enabled).toBe(false);
      expect(flags.chart_enabled).toBe(true);
      expect(flags.chart_reflections_enabled).toBe(true);
    });

    it('withdraws reflection writes without withdrawing Chart reads', () => {
      const { getChartFeatureFlags } = loadFlags({ ...allOn, ENABLE_CHART_REFLECTIONS: 'false' });
      const flags = getChartFeatureFlags();
      expect(flags.chart_reflections_enabled).toBe(false);
      expect(flags.chart_enabled).toBe(true);
    });

    it('stops new exposure at rollout zero without disabling resolved accounts', () => {
      const { isAccountInChartRollout, getChartFeatureFlags } = loadFlags({
        ...allOn,
        CHART_ROLLOUT_PERCENT: '0',
      });
      expect(isAccountInChartRollout('account-1')).toBe(false);
      expect(getChartFeatureFlags().chart_enabled).toBe(true);
    });

    it('makes Chart unavailable entirely when ENABLE_CHART is off', () => {
      const { getChartFeatureFlags, requireChartEnabled } = loadFlags({
        ...allOn,
        ENABLE_CHART: 'false',
      });
      expect(Object.values(getChartFeatureFlags()).every((value) => value === false)).toBe(true);
      expect(() => requireChartEnabled()).toThrow(
        expect.objectContaining({ code: 'FEATURE_DISABLED' })
      );
    });

    it('lets the kill switch override every other flag and the rollout', () => {
      const { getChartFeatureFlags, isAccountInChartRollout } = loadFlags({
        ...allOn,
        CHART_KILL_SWITCH: 'true',
      });
      expect(Object.values(getChartFeatureFlags()).every((value) => value === false)).toBe(true);
      expect(isAccountInChartRollout('account-1')).toBe(false);
    });

    it('restores the same accounts and flags when re-enabled', () => {
      const before = loadFlags(allOn);
      const bucketed = ['a', 'b', 'c', 'd', 'e'].filter((id) =>
        before.isAccountInChartRollout(`account-${id}`)
      );

      const off = loadFlags({ ...allOn, CHART_KILL_SWITCH: 'true' });
      expect(off.getChartFeatureFlags().chart_enabled).toBe(false);

      const after = loadFlags(allOn);
      expect(after.getChartFeatureFlags()).toEqual(before.getChartFeatureFlags());
      // Bucketing is a deterministic hash of the account id, so the cohort is
      // restored rather than reshuffled.
      expect(
        ['a', 'b', 'c', 'd', 'e'].filter((id) => after.isAccountInChartRollout(`account-${id}`))
      ).toEqual(bucketed);
    });
  });
});
