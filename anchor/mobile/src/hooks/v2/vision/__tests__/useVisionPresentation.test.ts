import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { VISION_PRESENTATION_STORAGE_KEY, mergeSlotAssignments, sanitizeSlots, useVisionPresentationStore } from '@/stores/v2/visionPresentationStore';
import { useVisionPresentation } from '../useVisionPresentation';

const tile = (id: string, index: number, extra: Partial<V2VisionTile> = {}): V2VisionTile =>
  ({ id, sceneId: id, imageUrl: `https://x.test/${id}.jpg`, prompt: null, sortOrder: index, isHero: index === 0, ...extra } as V2VisionTile);
const tiles = (...ids: string[]) => ids.map((id, index) => tile(id, index));
const reset = () => useVisionPresentationStore.setState({ byVision: {}, hydrated: true });
const flush = () => act(async () => { for (let i = 0; i < 5; i += 1) await new Promise(resolve => setImmediate(resolve)); });

// The suite's AsyncStorage is a bare mock; give it a disk so a restart can be simulated.
const disk = new Map<string, string>();
const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock };
beforeEach(() => {
  disk.clear();
  storage.getItem.mockImplementation(async (key: string) => disk.get(key) ?? null);
  storage.setItem.mockImplementation(async (key: string, value: string) => { disk.set(key, value); });
  storage.removeItem.mockImplementation(async (key: string) => { disk.delete(key); });
  reset();
});

describe('useVisionPresentation', () => {
  it('migrates an existing board without moving anything: photograph i sits in slot i', async () => {
    const { result } = renderHook(() => useVisionPresentation('v1', tiles('a', 'b', 'c')));
    await flush();
    expect(result.current.slotMap).toEqual(['a', 'b', 'c', null, null, null, null, null]);
  });
  it('pins what the rule placed, so a later change to other photographs cannot move it', async () => {
    const { result, rerender } = renderHook(({ list }) => useVisionPresentation('v1', list), { initialProps: { list: tiles('a', 'b', 'c') } });
    await flush();
    expect(useVisionPresentationStore.getState().byVision.v1.slots).toEqual({ a: 0, b: 1, c: 2 });
    // The photograph in the middle is removed: the others keep slots 0 and 2.
    rerender({ list: [tile('a', 0), tile('c', 1)] });
    await flush();
    expect(result.current.slotMap).toEqual(['a', null, 'c', null, null, null, null, null]);
  });
  it('a photograph added later takes the lowest free slot, and a chosen slot is kept exactly', async () => {
    const { result, rerender } = renderHook(({ list }) => useVisionPresentation('v1', list), { initialProps: { list: tiles('a', 'b') } });
    await flush();
    act(() => { useVisionPresentationStore.getState().placeScene('v1', 'chosen', 6); });
    rerender({ list: [...tiles('a', 'b'), tile('chosen', 2), tile('auto', 3)] });
    await flush();
    expect(result.current.slotMap[6]).toBe('chosen'); expect(result.current.slotMap[2]).toBe('auto');
    expect(result.current.slotMap.slice(0, 2)).toEqual(['a', 'b']);
  });
  it('keeps a committed arrangement through unmount and remount (navigation)', async () => {
    const first = renderHook(() => useVisionPresentation('v1', tiles('a', 'b', 'c')));
    await flush();
    act(() => { first.result.current.commitSlotMap([null, 'c', null, 'a', null, null, 'b', null]); });
    first.unmount();
    const second = renderHook(() => useVisionPresentation('v1', tiles('a', 'b', 'c')));
    await flush();
    expect(second.result.current.slotMap).toEqual([null, 'c', null, 'a', null, null, 'b', null]);
  });
  it('survives an app restart: the arrangement and each crop are read back from storage', async () => {
    const first = renderHook(() => useVisionPresentation('v1', tiles('a', 'b')));
    await flush();
    act(() => { first.result.current.commitSlotMap(['b', null, null, null, null, null, null, 'a']); first.result.current.setFocal('a', { x: 0.3, y: 0.12 }); });
    await flush();
    expect(JSON.parse(disk.get(VISION_PRESENTATION_STORAGE_KEY)!).state.byVision.v1.slots).toEqual({ b: 0, a: 7 });
    // A new process: memory is empty until the stored record is read.
    const saved = disk.get(VISION_PRESENTATION_STORAGE_KEY)!;
    useVisionPresentationStore.setState({ byVision: {}, hydrated: false });
    await flush();
    disk.set(VISION_PRESENTATION_STORAGE_KEY, saved); // clearing memory must not clear the disk
    await act(async () => { await useVisionPresentationStore.persist.rehydrate(); });
    const second = renderHook(() => useVisionPresentation('v1', tiles('a', 'b')));
    await flush();
    expect(second.result.current.slotMap).toEqual(['b', null, null, null, null, null, null, 'a']);
    expect(second.result.current.focals.a).toEqual({ x: 0.3, y: 0.12 });
  });
  it('a reorder of the saved sort order does not move photographs that have a slot', async () => {
    const { result, rerender } = renderHook(({ list }) => useVisionPresentation('v1', list), { initialProps: { list: tiles('a', 'b', 'c') } });
    await flush();
    rerender({ list: [tile('c', 0), tile('a', 1), tile('b', 2)] });
    await flush();
    expect(result.current.slotMap).toEqual(['a', 'b', 'c', null, null, null, null, null]);
  });
  it('uses what the server sent when this device has no record, and the device record over it', async () => {
    const list = [tile('a', 0, { slotIndex: 5 }), tile('b', 1, { slotIndex: 2, focal: { x: 0.9, y: 0.1 } })];
    const { result } = renderHook(() => useVisionPresentation('v1', list));
    await flush();
    expect(result.current.slotMap[5]).toBe('a'); expect(result.current.slotMap[2]).toBe('b'); expect(result.current.focals.b).toEqual({ x: 0.9, y: 0.1 });
    act(() => { result.current.setFocal('b', { x: 0.1, y: 0.1 }); });
    expect(result.current.focals.b).toEqual({ x: 0.1, y: 0.1 });
  });
  it('a stale record for a removed photograph never blocks its slot', async () => {
    const { result, rerender } = renderHook(({ list }) => useVisionPresentation('v1', list), { initialProps: { list: tiles('a', 'old') } });
    await flush();
    rerender({ list: tiles('a') }); await flush();
    act(() => { useVisionPresentationStore.getState().placeScene('v1', 'new', 1); });
    // 'old' still had slot 1 on record; the live photograph must win.
    act(() => { result.current.commitSlotMap(['a', 'new', null, null, null, null, null, null]); });
    rerender({ list: [tile('a', 0), tile('new', 1)] }); await flush();
    expect(result.current.slotMap[1]).toBe('new');
  });
  it('does nothing without a vision id', async () => {
    const { result } = renderHook(() => useVisionPresentation(null, tiles('a')));
    await flush();
    act(() => { result.current.commitSlotMap(['a', null, null, null, null, null, null, null]); });
    expect(useVisionPresentationStore.getState().byVision).toEqual({});
  });
});

describe('store rules', () => {
  it('replacing a photograph hands its slot to the replacement and drops its crop', () => {
    const store = useVisionPresentationStore.getState();
    store.setSlots('v1', { old: 4 }); store.setFocal('v1', 'old', { x: 0.2, y: 0.2 });
    useVisionPresentationStore.getState().inheritSlot('v1', 'old', 'new');
    expect(useVisionPresentationStore.getState().byVision.v1).toEqual({ slots: { new: 4 }, focals: {} });
  });
  it('refuses a chosen slot that another photograph holds', () => {
    useVisionPresentationStore.getState().setSlots('v1', { a: 3 });
    expect(useVisionPresentationStore.getState().placeScene('v1', 'b', 3)).toBe(false);
    expect(useVisionPresentationStore.getState().placeScene('v1', 'b', 9)).toBe(false);
    expect(useVisionPresentationStore.getState().placeScene('v1', 'b', 4)).toBe(true);
  });
  it('a placed photograph wins over a stale record of the same slot', () => {
    expect(mergeSlotAssignments({ gone: 2, keep: 5 }, { live: 2 })).toEqual({ live: 2, keep: 5 });
  });
  it('drops invalid and duplicate slots when reading storage', () => {
    expect(sanitizeSlots({ a: 1, b: 1, c: 99, d: -2, e: 1.5, f: 'x', g: 7 })).toEqual({ a: 1, g: 7 });
  });
  it('remembers only the most recently written visions', () => {
    for (let i = 0; i < 30; i += 1) useVisionPresentationStore.getState().setSlots(`v${i}`, { a: 0 });
    const ids = Object.keys(useVisionPresentationStore.getState().byVision);
    expect(ids).toHaveLength(24); expect(ids).toContain('v29'); expect(ids).not.toContain('v0');
  });
});
