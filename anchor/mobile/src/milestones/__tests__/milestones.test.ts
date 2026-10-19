import * as fs from 'fs';
import * as path from 'path';
import {
  FAMILY_LABEL,
  MILESTONE_SPECS,
  describeEarnedValue,
  getMilestoneSpec,
} from '../registry';
import { buildMilestoneItems, mergeMilestoneRecords, uncelebrated, type MilestoneRecord } from '../milestoneModel';

const record = (definitionId: string, earnedAt: string, over: Partial<MilestoneRecord> = {}): MilestoneRecord => ({
  id: `id-${definitionId}`,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata: {},
  celebratedAt: null,
  ...over,
});

describe('registry parity with the server', () => {
  const serverFile = path.resolve(__dirname, '../../../../../backend/src/services/v2/milestones/registry.ts');

  it('defines exactly the milestone ids the server can award', () => {
    const source = fs.readFileSync(serverFile, 'utf8');
    const serverIds = [...source.matchAll(/\{ id: '([a-z0-9.]+)', family:/g)].map((m) => m[1]);
    expect(serverIds.length).toBeGreaterThan(0);
    expect(MILESTONE_SPECS.map((s) => s.id).sort()).toEqual([...serverIds].sort());
  });

  it('agrees with the server on each milestone family', () => {
    const source = fs.readFileSync(serverFile, 'utf8');
    for (const [, id, family] of source.matchAll(/\{ id: '([a-z0-9.]+)', family: '(\w+)'/g)) {
      expect(getMilestoneSpec(id)?.family).toBe(family);
    }
  });

  it('uses the app Thread stage thresholds in the unlock copy', () => {
    expect(['strength.building', 'strength.established', 'strength.integrated', 'strength.reinforced', 'strength.full'].map(
      (id) => getMilestoneSpec(id)!.unlock,
    )).toEqual([
      'Reach 25 Thread Strength.',
      'Reach 50 Thread Strength.',
      'Reach 75 Thread Strength.',
      'Reach 90 Thread Strength.',
      'Reach 100 Thread Strength.',
    ]);
  });
});

describe('registry content', () => {
  it('has unique ids, a label for each family, and never-awarding replay on every milestone', () => {
    expect(new Set(MILESTONE_SPECS.map((s) => s.id)).size).toBe(MILESTONE_SPECS.length);
    for (const spec of MILESTONE_SPECS) {
      expect(FAMILY_LABEL[spec.family]).toBeTruthy();
      expect(spec.replay).toEqual({ allowed: true, awarding: false });
      expect(spec.unlock.length).toBeGreaterThan(0);
      expect(spec.celebration.durationMs).toBeGreaterThan(2500);
    }
  });

  it('only strength artwork wears the category colour', () => {
    for (const spec of MILESTONE_SPECS) expect(spec.art.usesCategoryColor).toBe(spec.family === 'strength');
  });

  it('describes recorded values without inventing any', () => {
    const strength = getMilestoneSpec('strength.established')!;
    expect(describeEarnedValue(strength, { strength: 52 })).toBe('Thread Strength was 52 when you reached it.');
    expect(describeEarnedValue(strength, {})).toBeNull();
    expect(describeEarnedValue(strength, null)).toBeNull();
    expect(describeEarnedValue(getMilestoneSpec('commitment.minutes.100')!, { minutes: 100 })).toBe('Passed 100 total minutes.');
    expect(describeEarnedValue(getMilestoneSpec('journey.goal')!, {})).toBeNull();
  });
});

describe('mergeMilestoneRecords', () => {
  it('never drops an earned milestone a read omitted', () => {
    const cached = [record('strength.building', '2026-09-01T00:00:00Z'), record('commitment.practices.1', '2026-08-01T00:00:00Z')];
    const server = [record('strength.building', '2026-09-01T00:00:00Z')];
    expect(mergeMilestoneRecords(cached, server).map((r) => r.definitionId)).toEqual([
      'strength.building',
      'commitment.practices.1',
    ]);
  });

  it('lets the server win on a shared milestone, including its celebrated receipt', () => {
    const cached = [record('strength.building', '2026-09-01T00:00:00Z')];
    const server = [record('strength.building', '2026-09-01T00:00:00Z', { celebratedAt: '2026-09-01T00:01:00Z' })];
    expect(mergeMilestoneRecords(cached, server)[0].celebratedAt).toBe('2026-09-01T00:01:00Z');
  });
});

describe('buildMilestoneItems', () => {
  const records = [
    record('commitment.practices.1', '2026-08-01T00:00:00Z'),
    record('strength.established', '2026-10-01T00:00:00Z'),
  ];

  it('lists earned newest first, then locked in definition order, and never marks locked as earned', () => {
    const items = buildMilestoneItems(records);
    expect(items.slice(0, 2).map((i) => i.spec.id)).toEqual(['strength.established', 'commitment.practices.1']);
    expect(items.slice(0, 2).every((i) => i.state === 'earned' && i.record)).toBe(true);
    const locked = items.slice(2);
    expect(locked.length).toBe(MILESTONE_SPECS.length - 2);
    expect(locked.every((i) => i.state === 'locked' && i.record === null)).toBe(true);
  });

  it('filters by family', () => {
    const strengthOnly = buildMilestoneItems(records, 'strength');
    expect(strengthOnly.every((i) => i.spec.family === 'strength')).toBe(true);
    expect(strengthOnly[0].state).toBe('earned');
    expect(strengthOnly).toHaveLength(5);
  });

  it('can omit locked milestones for the Progress shelf', () => {
    expect(buildMilestoneItems(records, 'all', { includeLocked: false })).toHaveLength(2);
    expect(buildMilestoneItems([], 'all', { includeLocked: false })).toEqual([]);
  });

  it('skips a record from a newer app version rather than inventing copy for it', () => {
    const items = buildMilestoneItems([record('future.thing', '2026-10-01T00:00:00Z')], 'all', { includeLocked: false });
    expect(items).toEqual([]);
  });
});

describe('uncelebrated', () => {
  it('returns unsettled milestones oldest first so simultaneous unlocks queue in order', () => {
    const list = uncelebrated([
      record('strength.established', '2026-10-02T00:00:00Z'),
      record('commitment.practices.1', '2026-10-01T00:00:00Z'),
      record('strength.building', '2026-10-03T00:00:00Z', { celebratedAt: '2026-10-03T00:01:00Z' }),
      record('future.thing', '2026-10-01T00:00:00Z'),
    ]);
    expect(list.map((r) => r.definitionId)).toEqual(['commitment.practices.1', 'strength.established']);
  });
});
