import { renderHook } from '@testing-library/react-native';
import { useV2HomeModel } from '../useV2HomeModel';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { makeAnchor } from './fixtures';

jest.mock('@/hooks/v2/vision', () => ({
  useV2Vision: () => ({ state: { state: 'none' }, refresh: jest.fn() }),
}));
jest.mock('@/adapters/v2/practice', () => ({
  fetchV2RecommendationContext: jest.fn(() => new Promise(() => undefined)),
}));
jest.mock('@/services/AuthHydrationService', () => ({
  __esModule: true,
  default: { hydrateAuthenticatedData: jest.fn() },
}));

/**
 * `localId` is optional on `Anchor`, so most server-synced Anchors have none.
 * Resolving the selected Anchor by comparing `localId === localId` therefore
 * matched every such Anchor, pinning the hero carousel to index 0 while the
 * shared store's selection moved underneath it.
 */
describe('useV2HomeModel selection identity', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'D' } as never });
    useCourseStore.setState({ accountId: 'user-1', activeCourse: null, courses: [], initializationStatus: 'ready' });
    useAnchorStore.setState({
      anchors: [
        makeAnchor({ id: 'a', localId: undefined, intentionText: 'First' }),
        makeAnchor({ id: 'b', localId: undefined, intentionText: 'Second' }),
        makeAnchor({ id: 'c', localId: undefined, intentionText: 'Third' }),
      ],
      currentAnchorId: 'a',
      isLoading: false,
    });
  });

  it('marks exactly one Anchor as selected when none of them carry a localId', () => {
    const { result } = renderHook(() => useV2HomeModel());
    expect(result.current.anchorList.filter((item) => item.isSelected)).toHaveLength(1);
    expect(result.current.selectedIndex).toBe(0);
  });

  it('tracks the shared store selection instead of freezing on the first Anchor', () => {
    useAnchorStore.setState({ currentAnchorId: 'c' });
    const { result } = renderHook(() => useV2HomeModel());
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedAnchor?.id).toBe('c');
    expect(result.current.anchorList[2].isSelected).toBe(true);
    expect(result.current.anchorList[0].isSelected).toBe(false);
  });

  it('keeps the hero Anchor and the dependent context on the same Anchor', () => {
    useAnchorStore.setState({ currentAnchorId: 'b' });
    const { result } = renderHook(() => useV2HomeModel());
    // The Anchor the carousel renders as active and the Anchor every dependent
    // module reads from must be the same object, or Home would show one
    // Anchor's artwork beside another Anchor's Today/Vision/Chart.
    expect(result.current.anchorList[result.current.selectedIndex].anchor).toBe(result.current.selectedAnchor);
  });

  it('reports no selection when the account has no Anchors', () => {
    useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
    const { result } = renderHook(() => useV2HomeModel());
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedAnchor).toBeNull();
  });
});
