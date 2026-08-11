import type { PracticeSessionRecord } from '@/types/practice';
import { buildWeaveData, eventMatchesAnchor } from './weaveData';

const event = (overrides: Partial<PracticeSessionRecord>): PracticeSessionRecord => ({
  id: 'session-1', accountId: 'account-1', anchorId: 'anchor-1', anchorLocalId: null, anchorServerId: null,
  practiceMode: 'focus', plannedDurationSeconds: 30, completedDurationSeconds: 30,
  completionStatus: 'completed', startedAt: '2026-08-09T12:00:00Z', completedAt: '2026-08-09T12:00:30Z',
  localDateKey: '2026-08-09', timeZone: 'America/Chicago', utcOffsetMinutesAtCompletion: -300,
  completionSource: 'practice_screen', schemaVersion: 1, legacyType: null, guidanceVoice: 'female',
  backgroundAudio: 'ambient', sceneSnapshot: null, nextAction: null, clientVersion: null, syncState: 'failed',
  ...overrides,
});

describe('The Weave canonical projection', () => {
  it('keeps queued/failed canonical sessions and buckets an Anchor by every known ID', () => {
    const local = event({ id: 'local', anchorId: null, anchorLocalId: 'local-anchor', localDateKey: '2026-08-08' });
    const server = event({ id: 'server', anchorId: 'other', anchorServerId: 'local-anchor', practiceMode: 'deep_prime', localDateKey: '2026-08-06', completedAt: '2026-08-06T12:00:00Z' });
    const result = buildWeaveData({
      history: [local, server],
      accountId: 'account-1',
      scope: { kind: 'anchor', anchorId: 'local-anchor' },
      range: '12w',
      now: new Date('2026-08-10T12:00:00Z'),
    });

    expect(eventMatchesAnchor(local, 'local-anchor')).toBe(true);
    expect(eventMatchesAnchor(server, ['server-anchor', 'local-anchor'])).toBe(true);
    expect(result.metrics.sessions).toBe(2);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((node) => node.mode)).toEqual(['deep_prime', 'focus']);
  });

  it('matches both sides of a synced Anchor local/server identity pair', () => {
    const syncedOnly = event({ anchorId: 'server-anchor', anchorLocalId: null, anchorServerId: 'server-anchor' });
    const result = buildWeaveData({
      history: [syncedOnly], accountId: 'account-1',
      scope: { kind: 'anchor', anchorId: 'server-anchor' },
      anchorAliases: ['server-anchor', 'local-anchor'], range: '12w', now: new Date('2026-08-10T12:00:00Z'),
    });

    expect(result.metrics.sessions).toBe(1);
    expect(eventMatchesAnchor(syncedOnly, ['local-anchor', 'server-anchor'])).toBe(true);
  });

  it('aggregates multiple sessions from one mode/time bucket into one accessible node', () => {
    const result = buildWeaveData({
      history: [
        event({ id: 'a', localDateKey: '2026-08-08' }),
        event({ id: 'b', localDateKey: '2026-08-09', completedAt: '2026-08-09T13:00:00Z' }),
      ],
      accountId: 'account-1', scope: { kind: 'all' }, range: '12w', now: new Date('2026-08-10T12:00:00Z'),
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({ sessionCount: 2, durationSeconds: 60 });
  });
});
