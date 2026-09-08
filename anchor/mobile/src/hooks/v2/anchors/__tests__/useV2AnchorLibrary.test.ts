import { act, renderHook } from '@testing-library/react-native';
import { useAnchorStore } from '@/stores/anchorStore';
import { useV2AnchorLibrary } from '../useV2AnchorLibrary';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

beforeEach(() => {
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
});

describe('useV2AnchorLibrary', () => {
  it('lists active Anchors and marks the selected one', () => {
    const a = makeAnchor({ id: 'a', updatedAt: new Date('2026-09-03') });
    const b = makeAnchor({ id: 'b', updatedAt: new Date('2026-09-05') });
    useAnchorStore.setState({ anchors: [a, b], currentAnchorId: 'a' });

    const { result } = renderHook(() => useV2AnchorLibrary());
    expect(result.current.entries.map((e) => e.anchor.id)).toEqual(['b', 'a']); // recency
    expect(result.current.entries.find((e) => e.anchor.id === 'a')?.isSelected).toBe(true);
    expect(result.current.activeCount).toBe(2);
    expect(result.current.hasReleased).toBe(false);
  });

  it('only surfaces a Released section when real released data exists', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'active' })],
    });
    const { result, rerender } = renderHook(() => useV2AnchorLibrary());
    expect(result.current.hasReleased).toBe(false);

    act(() => {
      useAnchorStore.setState({
        anchors: [
          makeAnchor({ id: 'active' }),
          makeAnchor({ id: 'gone', isReleased: true, releasedAt: new Date('2026-08-01') }),
        ],
      });
    });
    rerender({});
    expect(result.current.hasReleased).toBe(true);
    expect(result.current.releasedCount).toBe(1);
  });

  it('filters by all / active / released', () => {
    useAnchorStore.setState({
      anchors: [
        makeAnchor({ id: 'active' }),
        makeAnchor({ id: 'released', isReleased: true, releasedAt: new Date() }),
      ],
    });
    const { result } = renderHook(() => useV2AnchorLibrary());
    expect(result.current.entries).toHaveLength(2);

    act(() => result.current.setFilter('active'));
    expect(result.current.entries.map((e) => e.anchor.id)).toEqual(['active']);

    act(() => result.current.setFilter('released'));
    expect(result.current.entries.map((e) => e.anchor.id)).toEqual(['released']);
  });

  it('never invents released history when none exists', () => {
    useAnchorStore.setState({ anchors: [makeAnchor(), makeAnchor(), makeAnchor()] });
    const { result } = renderHook(() => useV2AnchorLibrary());
    act(() => result.current.setFilter('released'));
    expect(result.current.entries).toEqual([]);
  });
});
