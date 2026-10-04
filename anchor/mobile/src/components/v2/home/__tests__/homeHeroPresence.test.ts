import type { PracticeSessionRecord } from '@/types/practice';
import { anchorsPracticedToday, hasPracticedToday, hasHeroEntrancePlayed, heroWarmth, markHeroEntrancePlayed, resetHeroEntranceForTests } from '../homeHeroPresence';

const NOW = new Date(2026, 9, 4, 15, 30); // 4 Oct 2026, local mid-afternoon

function session(overrides: Partial<PracticeSessionRecord>): PracticeSessionRecord {
  return {
    id: 's1', accountId: 'acct', anchorId: 'a1', anchorLocalId: null, anchorServerId: null,
    practiceMode: 'focus', completedAt: new Date(2026, 9, 4, 8, 0).toISOString(),
    ...overrides,
  } as PracticeSessionRecord;
}

describe('anchorsPracticedToday', () => {
  it('collects every key of an Anchor practised on the local day', () => {
    const keys = anchorsPracticedToday([session({ anchorId: 'a1', anchorServerId: 'srv1', anchorLocalId: 'loc1' })], 'acct', NOW);
    expect([...keys].sort()).toEqual(['a1', 'loc1', 'srv1']);
  });

  it('ignores yesterday, other accounts, and malformed dates', () => {
    const keys = anchorsPracticedToday([
      session({ id: 'y', anchorId: 'yesterday', completedAt: new Date(2026, 9, 3, 23, 59).toISOString() }),
      session({ id: 'o', anchorId: 'other', accountId: 'someone-else' }),
      session({ id: 'b', anchorId: 'bad', completedAt: 'not a date' }),
    ], 'acct', NOW);
    expect(keys.size).toBe(0);
  });

  it('is empty without an account', () => {
    expect(anchorsPracticedToday([session({})], null, NOW).size).toBe(0);
  });

  it('matches an Anchor by id or by local id', () => {
    const keys = anchorsPracticedToday([session({ anchorId: null, anchorLocalId: 'loc9' })], 'acct', NOW);
    expect(hasPracticedToday(keys, { id: 'server-id', localId: 'loc9' })).toBe(true);
    expect(hasPracticedToday(keys, { id: 'server-id' })).toBe(false);
  });
});

describe('heroWarmth', () => {
  it('keeps an unmeasured Anchor at a quiet baseline rather than zero', () => {
    expect(heroWarmth(null)).toBeGreaterThan(0);
    expect(heroWarmth(undefined)).toBe(heroWarmth(null));
  });
  it('rises with Consistency and is clamped to 0..1', () => {
    expect(heroWarmth(0)).toBeLessThan(heroWarmth(50));
    expect(heroWarmth(50)).toBeLessThan(heroWarmth(100));
    expect(heroWarmth(100)).toBe(1);
    expect(heroWarmth(250)).toBe(1);
    expect(heroWarmth(-30)).toBe(heroWarmth(0));
  });
});

describe('hero entrance', () => {
  afterEach(resetHeroEntranceForTests);
  it('plays once per cold start', () => {
    expect(hasHeroEntrancePlayed()).toBe(false);
    markHeroEntrancePlayed();
    expect(hasHeroEntrancePlayed()).toBe(true);
  });
});
