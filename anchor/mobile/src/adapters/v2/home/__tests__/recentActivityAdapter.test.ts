import { toHomeRecentActivity } from '../recentActivityAdapter';
import type { PracticeSessionRecord } from '@/types/practice';

const record = (id: string, accountId: string, anchorId: string, completedAt: string, practiceMode: PracticeSessionRecord['practiceMode']) => ({
  id, accountId, anchorId, anchorLocalId: null, anchorServerId: null, completedAt, practiceMode, completedDurationSeconds: 30,
}) as PracticeSessionRecord;

describe('Home recent activity', () => {
  it('keeps only this account and Anchor, newest first, with Practice identity', () => {
    const sessions = [
      record('a-old', 'user-1', 'anchor-a', '2026-09-17T12:00:00.000Z', 'focus'),
      record('b', 'user-1', 'anchor-b', '2026-09-19T12:00:00.000Z', 'release'),
      record('other-account', 'user-2', 'anchor-a', '2026-09-20T12:00:00.000Z', 'visualize'),
      record('a-new', 'user-1', 'anchor-a', '2026-09-19T12:00:00.000Z', 'deep_prime'),
    ];
    const result = toHomeRecentActivity({ sessions, accountId: 'user-1', anchorId: 'anchor-a', now: new Date('2026-09-20T15:00:00.000Z') });
    expect(result.map((item) => item.id)).toEqual(['a-new', 'a-old']);
    expect(result[0].title).toBe('Deep Prime');
    expect(result[0].dayLabel).toBe('Yesterday');
  });
});
