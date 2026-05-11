/**
 * Anchor App - AnchorStore Tests
 *
 * Unit tests for Zustand anchor store
 */

import { renderHook, act } from '@testing-library/react-hooks';
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
      expect(result.current.error).toBeNull();
      expect(result.current.lastSyncedAt).toBeNull();
    });
  });
});
