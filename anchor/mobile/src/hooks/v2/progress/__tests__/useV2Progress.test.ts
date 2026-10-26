import { act, renderHook } from '@testing-library/react-native';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { useV2Progress } from '../useV2Progress';

jest.mock('@/hooks/v2/chart/useAnchorCourseLog', () => ({
  useAnchorCourseLog: () => ({ entries: [], loading: false, refresh: jest.fn(), hasChart: false }),
}));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({
  useAnchorChart: () => ({ data: null }),
}));

const reflectingEntry = (id: string, anchorId: string, reflectionWord?: string) => ({
  id,
  anchorId,
  type: 'activate' as const,
  mode: 'silent' as const,
  durationSeconds: 30,
  reflectionWord,
  completedAt: new Date().toISOString(),
});

beforeEach(() => {
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
  useSessionStore.getState().reset();
});

describe('useV2Progress', () => {
  it('defaults the rhythm range to Week and changes it', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const { result } = renderHook(() => useV2Progress());
    expect(result.current.range).toBe('Week');
    act(() => result.current.setRange('Year'));
    expect(result.current.range).toBe('Year');
  });

  it('lists only non-archived Anchors for the switcher', () => {
    useAnchorStore.setState({
      anchors: [
        makeAnchor({ id: 'live', category: 'career' as any, intentionText: 'Build a business' }),
        makeAnchor({ id: 'gone', archivedAt: new Date('2026-09-01') }),
      ],
      currentAnchorId: 'live',
    });
    const { result } = renderHook(() => useV2Progress());
    expect(result.current.anchors).toHaveLength(1);
    expect(result.current.anchors[0]).toMatchObject({ id: 'live', category: 'career', intention: 'Build a business' });
    expect(result.current.anchors[0].anchor.id).toBe('live');
  });

  it('views another Anchor locally without changing the current Anchor', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'First' }), makeAnchor({ id: 'b', intentionText: 'Second' })],
      currentAnchorId: 'a',
    });
    const { result } = renderHook(() => useV2Progress());
    expect(result.current.model?.intention).toBe('First');

    act(() => result.current.selectAnchor('b'));
    expect(result.current.model?.anchorId).toBe('b');
    expect(result.current.model?.intention).toBe('Second');
    expect(useAnchorStore.getState().currentAnchorId).toBe('a');
  });

  it('honours the anchorId option over the current Anchor', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a' }), makeAnchor({ id: 'b' })],
      currentAnchorId: 'a',
    });
    const { result } = renderHook(() => useV2Progress({ anchorId: 'b' }));
    expect(result.current.model?.anchorId).toBe('b');
  });

  it('reads the week from the session store and builds the evidence fields', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const week = [true, true, true, true, true, true, true];
    useSessionStore.setState({ weekHistory: week, weekHistoryKey: '1999-W01' }); // a stale week
    const { result } = renderHook(() => useV2Progress());
    expect(result.current.model?.week?.days).toEqual([false, false, false, false, false, false, false]);
    expect(result.current.model?.heatmap?.Month).toHaveLength(35);
    expect(result.current.model?.route).toBeNull();
  });

  it('uses saved reflection words for this Anchor only, and nothing otherwise', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const { result, rerender } = renderHook(() => useV2Progress());
    expect(result.current.model?.reflections).toEqual([]);

    act(() => {
      useSessionStore.setState({
        sessionLog: [reflectingEntry('s1', 'a', 'Steady'), reflectingEntry('s2', 'other', 'Clear'), reflectingEntry('s3', 'a')],
      });
    });
    rerender({});
    expect(result.current.model?.reflections?.map((r) => r.word)).toEqual(['Steady']);
  });
});
