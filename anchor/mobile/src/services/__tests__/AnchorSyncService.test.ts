import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Anchor } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/config', () => ({
  ENABLE_LEGACY_SUPABASE_SYNC: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'supabase-anon-key',
}));

import AnchorSyncService from '../AnchorSyncService';

const createAnchor = (overrides?: Partial<Anchor>): Anchor => ({
  id: 'local-anchor-1',
  localId: 'local-anchor-1',
  userId: 'user-1',
  intentionText: 'Stay focused',
  category: 'career',
  distilledLetters: ['S', 'T', 'Y', 'F', 'C', 'S'],
  baseSigilSvg: '<svg></svg>',
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('AnchorSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock | undefined) = jest.fn();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('upserts anchors with explicit field mapping and returns the cloud uuid', async () => {
    const anchor = createAnchor();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'cloud-uuid-1',
          user_id: 'user-1',
          local_id: 'local-anchor-1',
          intention: 'Stay focused',
          category: 'career',
          distilled_letters: ['S', 'T', 'Y', 'F', 'C', 'S'],
          svg_data: '<svg></svg>',
          base_sigil_svg: '<svg></svg>',
          structure_variant: 'balanced',
          style_variant: 'balanced',
          is_charged: false,
          activation_count: 0,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ]),
    });

    const syncedAnchor = await AnchorSyncService.upsertAnchor(anchor, 'user-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/anchors?on_conflict=user_id,local_id&select=*'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(syncedAnchor.id).toBe('cloud-uuid-1');
    expect(syncedAnchor.localId).toBe('local-anchor-1');
  });

  it('deduplicates retry queue entries and flushes them successfully', async () => {
    const anchor = createAnchor();
    await AnchorSyncService.enqueueRetry(anchor, 'user-1');
    await AnchorSyncService.enqueueRetry(anchor, 'user-1');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'cloud-uuid-1',
          user_id: 'user-1',
          local_id: 'local-anchor-1',
          intention: 'Stay focused',
          category: 'career',
          distilled_letters: ['S', 'T', 'Y', 'F', 'C', 'S'],
          svg_data: '<svg></svg>',
          base_sigil_svg: '<svg></svg>',
          structure_variant: 'balanced',
          style_variant: 'balanced',
          is_charged: false,
          activation_count: 0,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ]),
    });

    const flushedAnchors = await AnchorSyncService.flushRetryQueue('user-1');

    expect(flushedAnchors).toHaveLength(1);
    expect(flushedAnchors[0].id).toBe('cloud-uuid-1');
    expect(await AsyncStorage.getItem('anchor-sync-retry-queue')).toBeNull();
  });

  it('retains local anchors during migration failures', async () => {
    const anchor = createAnchor();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      text: async () => 'sync failed',
    });

    const migratedAnchors = await AnchorSyncService.migrateAnchors([anchor], 'user-1');

    expect(migratedAnchors[0].id).toBe('local-anchor-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  describe('cancelQueuedSync', () => {
    it('removes queued retries only for the given anchor', async () => {
      const anchorA = createAnchor();
      const anchorB = createAnchor({ id: 'local-anchor-2', localId: 'local-anchor-2' });
      await AnchorSyncService.enqueueRetry(anchorA, 'user-1');
      await AnchorSyncService.enqueueRetry(anchorB, 'user-1');

      await AnchorSyncService.cancelQueuedSync(['local-anchor-1']);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            id: 'cloud-uuid-2',
            user_id: 'user-1',
            local_id: 'local-anchor-2',
            intention: 'Stay focused',
            category: 'career',
            distilled_letters: ['S', 'T', 'Y', 'F', 'C', 'S'],
            svg_data: '<svg></svg>',
            base_sigil_svg: '<svg></svg>',
            structure_variant: 'balanced',
            style_variant: 'balanced',
            is_charged: false,
            activation_count: 0,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ]),
      });

      const flushedAnchors = await AnchorSyncService.flushRetryQueue('user-1');

      expect(flushedAnchors).toHaveLength(1);
      expect(flushedAnchors[0].localId).toBe('local-anchor-2');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('markAnchorDeleted', () => {
    it('drops the queued retry and blocks the anchor from being re-enqueued', async () => {
      const anchor = createAnchor();
      await AnchorSyncService.enqueueRetry(anchor, 'user-1');

      await AnchorSyncService.markAnchorDeleted(['local-anchor-1']);

      // A late failure callback tries to queue the deleted anchor again.
      await AnchorSyncService.enqueueRetry(anchor, 'user-1');

      const flushedAnchors = await AnchorSyncService.flushRetryQueue('user-1');

      expect(flushedAnchors).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('drops tombstoned items at flush time even if they were queued earlier', async () => {
      const anchorA = createAnchor();
      const anchorB = createAnchor({ id: 'local-anchor-2', localId: 'local-anchor-2' });
      await AnchorSyncService.enqueueRetry(anchorA, 'user-1');
      await AnchorSyncService.enqueueRetry(anchorB, 'user-1');

      // Tombstone written without touching the queue (simulates a cancel that
      // raced with a concurrent enqueue).
      await AsyncStorage.setItem('anchor-sync-tombstones', JSON.stringify(['local-anchor-1']));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            id: 'cloud-uuid-2',
            user_id: 'user-1',
            local_id: 'local-anchor-2',
            intention: 'Stay focused',
            category: 'career',
            distilled_letters: ['S', 'T', 'Y', 'F', 'C', 'S'],
            svg_data: '<svg></svg>',
            base_sigil_svg: '<svg></svg>',
            structure_variant: 'balanced',
            style_variant: 'balanced',
            is_charged: false,
            activation_count: 0,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ]),
      });

      const flushedAnchors = await AnchorSyncService.flushRetryQueue('user-1');

      expect(flushedAnchors).toHaveLength(1);
      expect(flushedAnchors[0].localId).toBe('local-anchor-2');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
