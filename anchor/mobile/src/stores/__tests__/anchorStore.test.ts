/**
 * Anchor App - AnchorStore Tests
 *
 * Unit tests for Zustand anchor store
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAnchorStore } from '../anchorStore';
import { createMockAnchor, createMockAnchors } from '../../__tests__/utils/testUtils';

describe('anchorStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useAnchorStore());
    act(() => {
      result.current.clearAnchors();
      result.current.setError(null);
      result.current.setLoading(false);
    });
  });

  describe('Initial State', () => {
    it('should have empty anchors array', () => {
      const { result } = renderHook(() => useAnchorStore());
      expect(result.current.anchors).toEqual([]);
    });

    it('should start with zero total primes', () => {
      const { result } = renderHook(() => useAnchorStore());
      expect(result.current.totalPrimes).toBe(0);
    });

    it('should start with zero prime streak', () => {
      const { result } = renderHook(() => useAnchorStore());
      expect(result.current.primeStreak).toBe(0);
      expect(result.current.lastPrimedDate).toBeNull();
    });

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useAnchorStore());
      expect(result.current.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const { result } = renderHook(() => useAnchorStore());
      expect(result.current.error).toBeNull();
    });

    it('should have lastSyncedAt as null initially', () => {
      const { result } = renderHook(() => useAnchorStore());
      expect(result.current.lastSyncedAt).toBeNull();
    });
  });

  describe('setAnchors', () => {
    it('should set multiple anchors', () => {
      const { result } = renderHook(() => useAnchorStore());
      const mockAnchors = createMockAnchors(3);

      act(() => {
        result.current.setAnchors(mockAnchors);
      });

      expect(result.current.anchors).toHaveLength(3);
      expect(result.current.anchors).toEqual(mockAnchors);
    });

    it('recalculates total primes from anchors', () => {
      const { result } = renderHook(() => useAnchorStore());
      const mockAnchors = [
        createMockAnchor({ id: 'anchor-1', activationCount: 2 }),
        createMockAnchor({ id: 'anchor-2', activationCount: 5 }),
      ];

      act(() => {
        result.current.setAnchors(mockAnchors);
      });

      expect(result.current.totalPrimes).toBe(7);
    });

    it('should clear error when setting anchors', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setError('Some error');
        result.current.setAnchors(createMockAnchors(2));
      });

      expect(result.current.error).toBeNull();
    });

    it('should replace existing anchors', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors(createMockAnchors(3));
        result.current.setAnchors(createMockAnchors(1));
      });

      expect(result.current.anchors).toHaveLength(1);
    });
  });

  describe('addAnchor', () => {
    it('should add an anchor to the beginning of the array', () => {
      const { result } = renderHook(() => useAnchorStore());
      const mockAnchor = createMockAnchor({ id: 'new-anchor' });

      act(() => {
        result.current.setAnchors(createMockAnchors(2));
        result.current.addAnchor(mockAnchor);
      });

      expect(result.current.anchors).toHaveLength(3);
      expect(result.current.anchors[0].id).toBe('new-anchor');
    });

    it('should clear error when adding anchor', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setError('Some error');
        result.current.addAnchor(createMockAnchor());
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('updateAnchor', () => {
    it('should update an existing anchor', () => {
      const { result } = renderHook(() => useAnchorStore());
      const mockAnchor = createMockAnchor({ id: 'anchor-1', intentionText: 'Original' });

      act(() => {
        result.current.setAnchors([mockAnchor]);
        result.current.updateAnchor('anchor-1', { intentionText: 'Updated' });
      });

      expect(result.current.anchors[0].intentionText).toBe('Updated');
    });

    it('should not affect other anchors', () => {
      const { result } = renderHook(() => useAnchorStore());
      const anchors = [
        createMockAnchor({ id: 'anchor-1' }),
        createMockAnchor({ id: 'anchor-2' }),
      ];

      act(() => {
        result.current.setAnchors(anchors);
        result.current.updateAnchor('anchor-1', { isCharged: true });
      });

      expect(result.current.anchors[0].isCharged).toBe(true);
      expect(result.current.anchors[1].isCharged).toBe(false);
    });

    it('should set updatedAt when updating', () => {
      const { result } = renderHook(() => useAnchorStore());
      const mockAnchor = createMockAnchor({ id: 'anchor-1' });

      act(() => {
        result.current.setAnchors([mockAnchor]);
        result.current.updateAnchor('anchor-1', { isCharged: true });
      });

      expect(result.current.anchors[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should handle updating non-existent anchor gracefully', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors(createMockAnchors(2));
        result.current.updateAnchor('non-existent', { isCharged: true });
      });

      expect(result.current.anchors).toHaveLength(2);
    });

    it('promotes current anchor when chargedAt is updated', () => {
      const { result } = renderHook(() => useAnchorStore());
      const anchors = [
        createMockAnchor({ id: 'anchor-1' }),
        createMockAnchor({ id: 'anchor-2' }),
      ];

      act(() => {
        result.current.setAnchors(anchors);
        result.current.setCurrentAnchor('anchor-1');
        result.current.updateAnchor('anchor-2', { chargedAt: new Date(), isCharged: true });
      });

      expect(result.current.currentAnchorId).toBe('anchor-2');
    });

    it('promotes current anchor when lastActivatedAt is updated', () => {
      const { result } = renderHook(() => useAnchorStore());
      const anchors = [
        createMockAnchor({ id: 'anchor-1' }),
        createMockAnchor({ id: 'anchor-2' }),
      ];

      act(() => {
        result.current.setAnchors(anchors);
        result.current.setCurrentAnchor('anchor-1');
        result.current.updateAnchor('anchor-2', { lastActivatedAt: new Date() });
      });

      expect(result.current.currentAnchorId).toBe('anchor-2');
    });
  });

  describe('removeAnchor', () => {
    it('should remove an anchor by id', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors([
          createMockAnchor({ id: 'anchor-1' }),
          createMockAnchor({ id: 'anchor-2' }),
        ]);
        result.current.removeAnchor('anchor-1');
      });

      expect(result.current.anchors).toHaveLength(1);
      expect(result.current.anchors[0].id).toBe('anchor-2');
    });

    it('should handle removing non-existent anchor gracefully', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors(createMockAnchors(2));
        result.current.removeAnchor('non-existent');
      });

      expect(result.current.anchors).toHaveLength(2);
    });

    it('should clear error when removing anchor', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors([createMockAnchor({ id: 'anchor-1' })]);
        result.current.setError('Some error');
        result.current.removeAnchor('anchor-1');
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('incrementTotalPrimes', () => {
    it('increments lifetime prime count', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.incrementTotalPrimes();
        result.current.incrementTotalPrimes();
      });

      expect(result.current.totalPrimes).toBe(2);
    });
  });

  describe('recordPrimeSession', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('starts a streak on the first completed prime of an adjusted day', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-21T14:00:00.000Z'));
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.recordPrimeSession();
      });

      expect(result.current.primeStreak).toBe(1);
      expect(result.current.lastPrimedDate).toBe('2026-04-21');
    });

    it('does not increment the streak twice in the same adjusted day', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-21T14:00:00.000Z'));
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.recordPrimeSession();
        result.current.recordPrimeSession();
      });

      expect(result.current.primeStreak).toBe(1);
      expect(result.current.lastPrimedDate).toBe('2026-04-21');
    });

    it('increments the streak on consecutive adjusted days', () => {
      const { result } = renderHook(() => useAnchorStore());

      jest.useFakeTimers().setSystemTime(new Date('2026-04-21T14:00:00.000Z'));
      act(() => {
        result.current.recordPrimeSession();
      });

      jest.setSystemTime(new Date('2026-04-22T14:00:00.000Z'));
      act(() => {
        result.current.recordPrimeSession();
      });

      expect(result.current.primeStreak).toBe(2);
      expect(result.current.lastPrimedDate).toBe('2026-04-22');
    });

    it('resets the streak after a missed adjusted day', () => {
      const { result } = renderHook(() => useAnchorStore());

      jest.useFakeTimers().setSystemTime(new Date('2026-04-21T14:00:00.000Z'));
      act(() => {
        result.current.recordPrimeSession();
      });

      jest.setSystemTime(new Date('2026-04-23T14:00:00.000Z'));
      act(() => {
        result.current.recordPrimeSession();
      });

      expect(result.current.primeStreak).toBe(1);
      expect(result.current.lastPrimedDate).toBe('2026-04-23');
    });
  });

  describe('getAnchorById', () => {
    it('should return anchor by id', () => {
      const { result } = renderHook(() => useAnchorStore());
      const mockAnchor = createMockAnchor({ id: 'anchor-1', intentionText: 'Find me' });

      act(() => {
        result.current.setAnchors([mockAnchor]);
      });

      const foundAnchor = result.current.getAnchorById('anchor-1');
      expect(foundAnchor).toBeDefined();
      expect(foundAnchor?.intentionText).toBe('Find me');
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors(createMockAnchors(2));
      });

      const foundAnchor = result.current.getAnchorById('non-existent');
      expect(foundAnchor).toBeUndefined();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');
    });

    it('should clear error with null', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setError('Test error');
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('markSynced', () => {
    it('should set lastSyncedAt timestamp', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.markSynced();
      });

      expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
    });
  });

  describe('clearAnchors', () => {
    it('should clear all anchors and reset state', () => {
      const { result } = renderHook(() => useAnchorStore());

      act(() => {
        result.current.setAnchors(createMockAnchors(5));
        result.current.setError('Some error');
        result.current.markSynced();
        result.current.clearAnchors();
      });

      expect(result.current.anchors).toEqual([]);
      expect(result.current.primeStreak).toBe(0);
      expect(result.current.lastPrimedDate).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.lastSyncedAt).toBeNull();
    });
  });

  describe('evolvedFrom (local only)', () => {
    const FROM = { anchorId: 'old-1', intention: 'Publish my novel' };
    const seed = () => [
      createMockAnchor({ id: 'old-1', localId: 'old-1', intentionText: 'Publish my novel', isReleased: true }),
      createMockAnchor({ id: 'new-1', localId: 'new-1', intentionText: 'Finish my novel this year' }),
      createMockAnchor({ id: 'other', localId: 'other', intentionText: 'Another' }),
    ];
    const successorOf = (anchors: ReturnType<typeof seed>) => anchors.find((a) => a.id === 'new-1' || a.localId === 'new-1');

    it('is written on the successor only, without touching updatedAt or any other Anchor', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors(seed()); });
      const before = result.current.anchors.map((a) => ({ id: a.id, updatedAt: a.updatedAt.getTime() }));

      act(() => { result.current.linkEvolvedFrom('new-1', FROM); });

      expect(result.current.anchors.find((a) => a.id === 'new-1')?.evolvedFrom).toEqual(FROM);
      expect(result.current.anchors.filter((a) => a.evolvedFrom).map((a) => a.id)).toEqual(['new-1']);
      expect(result.current.anchors.map((a) => ({ id: a.id, updatedAt: a.updatedAt.getTime() }))).toEqual(before);
    });

    it('is idempotent: a repeat or a different source never rewrites or flips it', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors(seed()); });
      act(() => { result.current.linkEvolvedFrom('new-1', FROM); });
      const first = result.current.anchors.find((a) => a.id === 'new-1')?.evolvedFrom;

      act(() => { result.current.linkEvolvedFrom('new-1', FROM); });
      act(() => { result.current.linkEvolvedFrom('new-1', { anchorId: 'other', intention: 'Another' }); });

      expect(result.current.anchors.find((a) => a.id === 'new-1')?.evolvedFrom).toBe(first);
    });

    it('never lands on a released or archived Anchor, on the released Anchor itself, or on an unknown id', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors([...seed(), createMockAnchor({ id: 'gone', localId: 'gone', archivedAt: new Date() })]); });

      act(() => {
        result.current.linkEvolvedFrom('old-1', { anchorId: 'new-1', intention: 'x' }); // released
        result.current.linkEvolvedFrom('gone', FROM); // archived
        result.current.linkEvolvedFrom('other', { anchorId: 'other', intention: 'x' }); // itself
        result.current.linkEvolvedFrom('missing', FROM); // unknown
      });

      expect(result.current.anchors.some((a) => a.evolvedFrom)).toBe(false);
    });

    it('survives a full server refresh (setAnchors), matched by id or localId', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors(seed()); });
      act(() => { result.current.linkEvolvedFrom('new-1', FROM); });

      // The server copy: a cloud id, the local id kept as localId, no evolvedFrom.
      const refreshed = [
        createMockAnchor({ id: 'cloud-old', localId: 'old-1', isReleased: true }),
        createMockAnchor({ id: 'cloud-new', localId: 'new-1', intentionText: 'Finish my novel this year' }),
        createMockAnchor({ id: 'other', localId: 'other' }),
      ];
      act(() => { result.current.setAnchors(refreshed); });

      const successor = result.current.anchors.find((a) => a.localId === 'new-1');
      expect(successor?.id).toBe('cloud-new');
      expect(successor?.evolvedFrom).toEqual(FROM);
      expect(result.current.anchors.filter((a) => a.evolvedFrom)).toHaveLength(1);

      // And again, with the server copy keyed only by the local id as its id.
      act(() => { result.current.setAnchors([createMockAnchor({ id: 'new-1', intentionText: 'Finish my novel this year' })]); });
      expect(result.current.anchors[0].evolvedFrom).toEqual(FROM);
    });

    it('survives applySyncedAnchor', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors(seed()); });
      act(() => { result.current.linkEvolvedFrom('new-1', FROM); });

      act(() => {
        result.current.applySyncedAnchor('new-1', createMockAnchor({ id: 'cloud-new', localId: 'new-1', intentionText: 'Finish my novel this year' }));
      });

      const successor = result.current.anchors.find((a) => a.localId === 'new-1');
      expect(successor?.id).toBe('cloud-new');
      expect(successor?.evolvedFrom).toEqual(FROM);
    });

    it('an incoming server copy that does carry one is not overwritten by a stale local value', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors(seed()); });
      act(() => { result.current.linkEvolvedFrom('new-1', FROM); });
      const incoming = { anchorId: 'old-1', intention: 'Publish my novel (renamed)' };
      act(() => { result.current.setAnchors([createMockAnchor({ id: 'new-1', localId: 'new-1', evolvedFrom: incoming })]); });
      expect(successorOf(result.current.anchors as ReturnType<typeof seed>)?.evolvedFrom).toEqual(incoming);
    });

    it('everything behaves as before when no Anchor has one', () => {
      const { result } = renderHook(() => useAnchorStore());
      act(() => { result.current.setAnchors(seed()); });
      act(() => { result.current.applySyncedAnchor('new-1', createMockAnchor({ id: 'cloud-new', localId: 'new-1' })); });
      expect(result.current.anchors.some((a) => 'evolvedFrom' in a)).toBe(false);
    });
  });
});
