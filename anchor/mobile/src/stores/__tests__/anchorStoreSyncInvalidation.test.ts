/**
 * Anchor App - Anchor Store Sync Invalidation Tests
 *
 * Regression coverage for the release-1.1 watchlist item: deleting or burning
 * an anchor must invalidate queued sync retries so a later queue flush cannot
 * resurrect the anchor or return a burned anchor to the active vault.
 */

import { renderHook, act } from '@testing-library/react-native';
import type { Anchor } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/config', () => ({
  ...jest.requireActual('@/config'),
  ENABLE_LEGACY_SUPABASE_SYNC: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'supabase-anon-key',
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      isAuthenticated: true,
      user: { id: 'user-1' },
    })),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAnchorStore } from '../anchorStore';
import { writeSecureValue } from '../encryptedPersistStorage';
import AnchorSyncService from '@/services/AnchorSyncService';

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

const createSupabaseRecord = (localId: string, overrides?: Record<string, unknown>) => ({
  id: `cloud-uuid-${localId}`,
  user_id: 'user-1',
  local_id: localId,
  intention: 'Stay focused',
  category: 'career',
  distilled_letters: ['S', 'T', 'Y', 'F', 'C', 'S'],
  svg_data: '<svg></svg>',
  base_sigil_svg: '<svg></svg>',
  structure_variant: 'balanced',
  style_variant: 'balanced',
  is_charged: false,
  is_released: false,
  activation_count: 0,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const okResponse = (records: unknown[]) => ({
  ok: true,
  json: async () => records,
});

// Fire-and-forget sync callbacks (enqueueRetry etc.) resolve within a
// macrotask turn; waiting on a zero timeout lets them settle.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('anchorStore sync invalidation', () => {
  beforeEach(async () => {
    (global.fetch as jest.Mock | undefined) = jest.fn();
    await AsyncStorage.clear();
    await writeSecureValue('anchor-sync-retry-queue', JSON.stringify([]));

    const { result } = renderHook(() => useAnchorStore());
    act(() => {
      result.current.clearAnchors();
    });
  });

  it('does not resurrect a deleted anchor when the retry queue flushes', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchor = createAnchor();

    // Create while offline: the upsert fails and a retry is queued.
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    act(() => {
      result.current.addAnchor(anchor);
    });
    await settle();
    expect(result.current.anchors).toHaveLength(1);

    // User deletes the anchor before the retry ever succeeds.
    act(() => {
      result.current.removeAnchor('local-anchor-1');
    });
    await settle();
    expect(result.current.anchors).toHaveLength(0);

    // Back online: flushing the queue must not bring the anchor back.
    (global.fetch as jest.Mock).mockResolvedValue(okResponse([createSupabaseRecord('local-anchor-1')]));
    await act(async () => {
      await result.current.flushPendingSync();
    });

    expect(result.current.anchors).toHaveLength(0);
    // Only the initial failed upsert hit the network — the queued retry was cancelled.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('blocks a late failure callback from re-queueing a deleted anchor', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchor = createAnchor();

    act(() => {
      result.current.setAnchors([anchor]);
      result.current.removeAnchor('local-anchor-1');
    });
    await settle();

    // Simulate an in-flight sync failing after the delete and trying to queue a retry.
    await AnchorSyncService.enqueueRetry(anchor, 'user-1');

    (global.fetch as jest.Mock).mockResolvedValue(okResponse([createSupabaseRecord('local-anchor-1')]));
    await act(async () => {
      await result.current.flushPendingSync();
    });

    expect(result.current.anchors).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not return a burned anchor to the active vault when the queue flushes', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchor = createAnchor();

    act(() => {
      result.current.setAnchors([anchor]);
    });

    // An update fails while offline, queueing a pre-burn snapshot.
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    act(() => {
      result.current.updateAnchor('local-anchor-1', { isCharged: true });
    });
    await settle();

    // The anchor is burned/released; the queued pre-burn snapshot must be cancelled.
    act(() => {
      result.current.releaseAnchor('local-anchor-1');
    });
    await settle();

    (global.fetch as jest.Mock).mockResolvedValue(okResponse([createSupabaseRecord('local-anchor-1')]));
    await act(async () => {
      await result.current.flushPendingSync();
    });

    // Only the initial failed upsert hit the network.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.getAnchorById('local-anchor-1')?.isReleased).toBe(true);
    expect(result.current.getActiveAnchors()).toHaveLength(0);
  });

  it('keeps a burned anchor released even if a stale snapshot slips into the queue', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchor = createAnchor();

    act(() => {
      result.current.setAnchors([anchor]);
      result.current.releaseAnchor('local-anchor-1');
    });
    await settle();

    // Simulate a race: a pre-burn snapshot is enqueued after the cancel ran.
    await AnchorSyncService.enqueueRetry(anchor, 'user-1');

    (global.fetch as jest.Mock).mockResolvedValue(
      okResponse([createSupabaseRecord('local-anchor-1', { is_released: false })])
    );
    await act(async () => {
      await result.current.flushPendingSync();
    });

    // The stale snapshot synced upstream but must not un-release the anchor locally.
    expect(result.current.getAnchorById('local-anchor-1')?.isReleased).toBe(true);
    expect(result.current.getActiveAnchors()).toHaveLength(0);
  });

  it('does not cancel queued retries for unrelated anchors', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchorA = createAnchor();
    const anchorB = createAnchor({ id: 'local-anchor-2', localId: 'local-anchor-2' });

    // Both anchors fail to sync while offline and are queued. The creates are
    // staggered so each retry is enqueued sequentially.
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    act(() => {
      result.current.addAnchor(anchorA);
    });
    await settle();
    act(() => {
      result.current.addAnchor(anchorB);
    });
    await settle();

    act(() => {
      result.current.removeAnchor('local-anchor-1');
    });
    await settle();

    (global.fetch as jest.Mock).mockResolvedValue(okResponse([createSupabaseRecord('local-anchor-2')]));
    await act(async () => {
      await result.current.flushPendingSync();
    });

    // Anchor B synced and was promoted to its cloud id; anchor A stayed deleted.
    expect(result.current.anchors).toHaveLength(1);
    expect(result.current.anchors[0].localId).toBe('local-anchor-2');
    expect(result.current.anchors[0].id).toBe('cloud-uuid-local-anchor-2');
    expect(result.current.getAnchorById('local-anchor-1')).toBeUndefined();
  });

  it('does not resurrect a deleted anchor when an in-flight sync succeeds late', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchor = createAnchor();

    act(() => {
      result.current.setAnchors([anchor]);
      result.current.removeAnchor('local-anchor-1');
    });
    await settle();

    // A sync that started before the delete resolves afterwards.
    act(() => {
      result.current.applySyncedAnchor('local-anchor-1', createAnchor({ id: 'cloud-uuid-1' }));
    });

    expect(result.current.anchors).toHaveLength(0);
  });

  it('preserves released state when an in-flight sync resolves with a pre-burn snapshot', async () => {
    const { result } = renderHook(() => useAnchorStore());
    const anchor = createAnchor();

    act(() => {
      result.current.setAnchors([anchor]);
      result.current.releaseAnchor('local-anchor-1');
    });
    await settle();

    act(() => {
      result.current.applySyncedAnchor(
        'local-anchor-1',
        createAnchor({ id: 'cloud-uuid-1', isReleased: false })
      );
    });

    const synced = result.current.getAnchorById('cloud-uuid-1');
    expect(synced?.isReleased).toBe(true);
    expect(result.current.getActiveAnchors()).toHaveLength(0);
  });
});
