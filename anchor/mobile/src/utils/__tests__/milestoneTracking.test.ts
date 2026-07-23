import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  backfillMilestoneDates,
  checkAndRecordMilestones,
  getMilestoneLedger,
  getMilestoneLedgerStorageKey,
  getPendingMilestoneAwards,
  markMilestoneDismissed,
  markMilestoneShown,
  subscribeToMilestoneDates,
} from '../milestoneTracking';
import { writeSecureValue } from '@/stores/encryptedPersistStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

let scopeSequence = 0;
const nextScope = (label: string): string => `${label}-${scopeSequence++}`;

describe('milestoneTracking', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('discards unowned device-global dates and safely baselines the verified account', async () => {
    const scopeId = nextScope('legacy-account');
    await AsyncStorage.setItem(
      'anchor-milestone-dates',
      JSON.stringify({
        rank: { Initiate: '2026-05-01' },
        mark: { 'First Return Mark': '2026-05-03' },
      })
    );

    await expect(
      backfillMilestoneDates(
        { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
        { scopeId }
      )
    ).resolves.toBe('persisted');

    const ledger = await getMilestoneLedger(scopeId);
    expect(ledger.awards['rank.initiate']?.awardedAt).toBe('pre-launch');
    expect(ledger.awards['rank.practitioner']?.status).toBe('shown');
    expect(ledger.awards['mark.first_return']?.awardedAt).toBe('pre-launch');
    expect(ledger.outbox).toEqual([]);
    await expect(AsyncStorage.getItem('anchor-milestone-dates')).resolves.toBeNull();
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
  });

  it('records permanent award IDs and a durable presentation outbox', async () => {
    const scopeId = nextScope('record');
    const result = await checkAndRecordMilestones(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId, timezone: 'America/Chicago', sourceEventId: 'session-10' }
    );

    expect(result).toEqual({
      rank: ['Initiate', 'Practitioner'],
      mark: ['First Return Mark'],
      persistence: 'persisted',
    });

    const ledger = await getMilestoneLedger(scopeId);
    expect(ledger.version).toBe(2);
    expect(ledger.scopeId).toBe(scopeId);
    expect(ledger.awards['rank.initiate']).toMatchObject({
      id: 'rank.initiate',
      status: 'shown',
      sourceEventId: 'session-10',
    });
    expect(ledger.awards['rank.practitioner']).toMatchObject({
      id: 'rank.practitioner',
      status: 'pending',
      sourceEventId: 'session-10',
    });
    expect(ledger.outbox).toEqual(['rank.practitioner', 'mark.first_return']);
  });

  it('encodes colon-separated journal keys before writing to SecureStore', async () => {
    const scopeId = nextScope('secure-key');

    await checkAndRecordMilestones(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId }
    );

    const storedKeys = ((SecureStore.setItemAsync as jest.Mock).mock.calls as [string, string][]).map(
      ([key]) => key
    );
    expect(storedKeys.some((key) => key.includes(':'))).toBe(false);
    expect(storedKeys.every((key) => /^[A-Za-z0-9._-]+$/.test(key))).toBe(true);
  });

  it('serializes concurrent mutations without duplicating or losing awards', async () => {
    const scopeId = nextScope('concurrent');
    const [first, second] = await Promise.all([
      checkAndRecordMilestones(
        { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
        { scopeId }
      ),
      checkAndRecordMilestones(
        { totalPrimes: 50, practiceDays: 14, releasedAnchors: 1 },
        { scopeId }
      ),
    ]);

    expect([...first.rank, ...second.rank]).toEqual([
      'Initiate',
      'Practitioner',
      'Architect',
    ]);
    expect([...first.mark, ...second.mark]).toEqual([
      'First Return Mark',
      'Steady Thread Mark',
    ]);

    const ledger = await getMilestoneLedger(scopeId);
    expect(Object.keys(ledger.awards)).toHaveLength(5);
    expect(new Set(ledger.outbox).size).toBe(ledger.outbox.length);
  });

  it('does not rewrite an already-awarded milestone', async () => {
    const scopeId = nextScope('idempotent');
    const metrics = { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 };

    await checkAndRecordMilestones(metrics, { scopeId });
    const result = await checkAndRecordMilestones(metrics, { scopeId });

    expect(result).toEqual({ rank: [], mark: [], persistence: 'unchanged' });
    expect((await getMilestoneLedger(scopeId)).outbox).toEqual([
      'rank.practitioner',
      'mark.first_return',
    ]);
  });

  it('persists shown and dismissed delivery states', async () => {
    const scopeId = nextScope('delivery');
    await checkAndRecordMilestones(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId }
    );

    await markMilestoneShown(scopeId, 'rank.practitioner');
    await markMilestoneDismissed(scopeId, 'mark.first_return');

    const ledger = await getMilestoneLedger(scopeId);
    expect(ledger.awards['rank.practitioner']?.status).toBe('shown');
    expect(ledger.awards['rank.practitioner']?.shownAt).toBeDefined();
    expect(ledger.awards['mark.first_return']?.status).toBe('dismissed');
    expect(ledger.awards['mark.first_return']?.dismissedAt).toBeDefined();
    await expect(getPendingMilestoneAwards(scopeId)).resolves.toEqual([]);
  });

  it('backfills historical awards as already shown', async () => {
    const scopeId = nextScope('backfill');
    await backfillMilestoneDates(
      { totalPrimes: 50, practiceDays: 30, releasedAnchors: 1 },
      { scopeId }
    );

    const ledger = await getMilestoneLedger(scopeId);
    expect(ledger.awards['rank.architect']).toMatchObject({
      awardedAt: 'pre-launch',
      awardedLocalDate: 'pre-launch',
      status: 'shown',
    });
    expect(ledger.awards['mark.discipline']).toMatchObject({
      awardedAt: 'pre-launch',
      status: 'shown',
    });
    expect(ledger.outbox).toEqual([]);
  });

  it('applies the migration baseline once so later crossings can still be presented', async () => {
    const scopeId = nextScope('baseline-once');
    await backfillMilestoneDates(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId }
    );
    await backfillMilestoneDates(
      { totalPrimes: 50, practiceDays: 14, releasedAnchors: 1 },
      { scopeId }
    );

    expect((await getMilestoneLedger(scopeId)).awards['rank.architect']).toBeUndefined();

    const result = await checkAndRecordMilestones(
      { totalPrimes: 50, practiceDays: 14, releasedAnchors: 1 },
      { scopeId }
    );
    expect(result.rank).toEqual(['Architect']);
    expect((await getMilestoneLedger(scopeId)).awards['rank.architect']?.status).toBe(
      'pending'
    );
  });

  it('reports persistence failure and never presents an unpersisted award', async () => {
    const scopeId = nextScope('failure');
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('secure storage unavailable')
    );

    await expect(
      checkAndRecordMilestones(
        { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
        { scopeId }
      )
    ).resolves.toEqual({ rank: [], mark: [], persistence: 'failed' });
    await expect(getPendingMilestoneAwards(scopeId)).resolves.toEqual([]);
  });

  it('keeps the prior journal generation when a later acknowledgement write fails', async () => {
    const scopeId = nextScope('journal-rollback');
    await checkAndRecordMilestones(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId }
    );
    const before = await getMilestoneLedger(scopeId);
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('secure storage unavailable')
    );

    await expect(markMilestoneShown(scopeId, 'rank.practitioner')).rejects.toThrow(
      'secure storage unavailable'
    );

    const after = await getMilestoneLedger(scopeId);
    expect(after.revision).toBe(before.revision);
    expect(after.awards['rank.practitioner']?.status).toBe('pending');
    expect(after.outbox).toContain('rank.practitioner');
  });

  it('reports a failed baseline and recovers without replaying historical awards', async () => {
    const scopeId = nextScope('baseline-recovery');
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('secure storage unavailable')
    );

    await expect(
      backfillMilestoneDates(
        { totalPrimes: 50, practiceDays: 14, releasedAnchors: 1 },
        { scopeId }
      )
    ).resolves.toBe('failed');
    await expect(
      backfillMilestoneDates(
        { totalPrimes: 50, practiceDays: 14, releasedAnchors: 1 },
        { scopeId }
      )
    ).resolves.toBe('persisted');
    await expect(getPendingMilestoneAwards(scopeId)).resolves.toEqual([]);
  });

  it('keeps dismissed delivery terminal and timestamps stable', async () => {
    const scopeId = nextScope('terminal-delivery');
    await checkAndRecordMilestones(
      { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 },
      { scopeId }
    );
    await markMilestoneDismissed(scopeId, 'rank.practitioner');
    const dismissed = await getMilestoneLedger(scopeId);

    await markMilestoneShown(scopeId, 'rank.practitioner');
    await markMilestoneDismissed(scopeId, 'rank.practitioner');

    const after = await getMilestoneLedger(scopeId);
    expect(after.revision).toBe(dismissed.revision);
    expect(after.awards['rank.practitioner']?.status).toBe('dismissed');
    expect(after.awards['rank.practitioner']?.dismissedAt).toBe(
      dismissed.awards['rank.practitioner']?.dismissedAt
    );
  });

  it('preserves unknown same-version awards and original definition metadata', async () => {
    const scopeId = nextScope('forward-compatible');
    const baseKey = getMilestoneLedgerStorageKey(scopeId);
    await writeSecureValue(
      `${baseKey}:b`,
      JSON.stringify({
        version: 2,
        revision: 5,
        scopeId,
        awards: {
          'rank.practitioner': {
            id: 'rank.practitioner',
            definitionVersion: 17,
            category: 'rank',
            name: 'Practitioner Classic',
            awardedAt: '2026-01-01T00:00:00.000Z',
            awardedLocalDate: '2025-12-31',
            status: 'pending',
            presentation: {},
          },
          'rank.future_tier': { future: true },
        },
        outbox: ['rank.practitioner', 'rank.future_tier'],
      })
    );

    const before = await getMilestoneLedger(scopeId);
    expect(before.awards['rank.practitioner']?.definitionVersion).toBe(17);
    expect(before.awards['rank.practitioner']?.name).toBe('Practitioner Classic');
    expect(before.opaqueAwards?.['rank.future_tier']).toEqual({ future: true });

    await markMilestoneShown(scopeId, 'rank.practitioner');
    const after = await getMilestoneLedger(scopeId);
    expect(after.opaqueAwards?.['rank.future_tier']).toEqual({ future: true });
    expect(after.opaqueOutbox).toContain('rank.future_tier');
  });

  it('notifies subscribers only when the ledger changes', async () => {
    const scopeId = nextScope('subscription');
    const listener = jest.fn();
    const unsubscribe = subscribeToMilestoneDates(listener);
    const metrics = { totalPrimes: 10, practiceDays: 3, releasedAnchors: 0 };

    await checkAndRecordMilestones(metrics, { scopeId });
    await checkAndRecordMilestones(metrics, { scopeId });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await markMilestoneShown(scopeId, 'rank.practitioner');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
