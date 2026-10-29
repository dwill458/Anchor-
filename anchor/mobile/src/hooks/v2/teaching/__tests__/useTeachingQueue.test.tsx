import { act, renderHook, waitFor } from '@testing-library/react-native';
import { guidanceRecords } from '@/stores/v2/guidanceRecords';
import { useTeachingQueue } from '../useTeachingQueue';
import { bindGuidanceAccount, guidanceCoordinator } from '@/hooks/v2/guidance/guidanceRuntime';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSettingsStore } from '@/stores/settingsStore';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; } }));
type Options = Parameters<typeof useTeachingQueue>[0];
const initial: Options = { screenId: 'home', accountId: null, eligible: ['home.today'], cap: 2, blocked: false, isFocused: true };
beforeEach(async () => {
  useMilestoneCelebrationStore.setState({ queue: [], holds: [] }); useCelebrationStore.getState().reset(); useSettingsStore.setState({ showTips: true });
  await bindGuidanceAccount('guest');
  const fresh = { records: {}, discovery: {} };
  guidanceRecords.save('guest', fresh); await guidanceRecords.flush();
  guidanceCoordinator.bind('test-reset', null); guidanceCoordinator.bind('guest', fresh);
});
it('selects one current approved beat and never records a selected step as displayed', async () => {
 const hook = renderHook(() => useTeachingQueue({ ...initial, eligible: ['home.today','home.progress'] }));
 await waitFor(() => expect(hook.result.current.steps).toEqual(['home.today']));
 expect(guidanceCoordinator.data().records).toEqual({});
 act(() => hook.result.current.markShown());
 expect(guidanceCoordinator.data().records['today.recommended']).toMatchObject({ presentAttempts: 1, displayCount: 0 });
});
it('ignores retired eligibility instead of reviving obsolete batches', async () => {
 const hook = renderHook(() => useTeachingQueue({ ...initial, eligible: ['home.vision','home.chart','progress.week'] }));
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); expect(hook.result.current.steps).toEqual([]);
});
it('waits for readiness and tears down without recording on blur', async () => {
 const hook = renderHook(props => useTeachingQueue(props), { initialProps: { ...initial, blocked: true } });
 expect(hook.result.current.steps).toEqual([]); hook.rerender(initial);
 await waitFor(() => expect(hook.result.current.steps).toEqual(['home.today']));
 hook.rerender({ ...initial, isFocused: false }); expect(hook.result.current.steps).toEqual([]); expect(guidanceCoordinator.data().records).toEqual({});
});
it('does not restart an interrupted presentation during the same visit', async () => {
 const hook = renderHook(props => useTeachingQueue(props), { initialProps: initial });
 await waitFor(() => expect(hook.result.current.ready).toBe(true)); hook.rerender({ ...initial, blocked: true }); hook.rerender(initial);
 expect(hook.result.current.steps).toEqual([]);
});
it('rechecks live eligibility and context instead of freezing a stale batch', async () => {
 const hook = renderHook(props => useTeachingQueue(props), { initialProps: initial }); await waitFor(() => expect(hook.result.current.ready).toBe(true));
 hook.rerender({ ...initial, eligible: [] }); expect(hook.result.current.steps).toEqual([]);
});
it('dismisses only the visible teaching and separates acknowledgment from dwell', async () => {
 const hook = renderHook(() => useTeachingQueue(initial)); await waitFor(() => expect(hook.result.current.ready).toBe(true));
 act(() => hook.result.current.markShown()); act(() => hook.result.current.dismiss(['home.today','home.progress'], 'complete'));
 expect(guidanceCoordinator.data().records['today.recommended']).toMatchObject({ outcome: 'acknowledged', displayCount: 0 });
 expect(guidanceCoordinator.data().records['home.progress']).toBeUndefined();
});
it('shares one owner across simultaneous eligible hosts', async () => {
 const hooks = renderHook(() => ({ home: useTeachingQueue(initial), vision: useTeachingQueue({ ...initial, screenId: 'vision', eligible: ['vision.second'] }) }));
 await waitFor(() => expect(hooks.result.current.home.ready || hooks.result.current.vision.ready).toBe(true));
 expect([hooks.result.current.home, hooks.result.current.vision].filter(host => host.ready)).toHaveLength(1);
});
it('uses one shared session budget while keeping the whisper exempt', async () => {
 const home = renderHook(() => useTeachingQueue(initial)); await waitFor(() => expect(home.result.current.ready).toBe(true)); act(() => home.result.current.markShown()); act(() => home.result.current.dismiss([], 'scrim')); home.unmount();
 const vision = renderHook(() => useTeachingQueue({ ...initial, screenId: 'vision', eligible: ['vision.second'] }));
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); expect(vision.result.current.ready).toBe(false); vision.unmount();
 const whisper = renderHook(() => useTeachingQueue({ ...initial, screenId: 'vision', eligible: ['vision.first'] })); await waitFor(() => expect(whisper.result.current.ready).toBe(true));
});
it('switches account without accepting old presentation callbacks', async () => {
 const hook = renderHook(props => useTeachingQueue(props), { initialProps: initial }); await waitFor(() => expect(hook.result.current.ready).toBe(true));
 const old = hook.result.current; hook.rerender({ ...initial, accountId: 'other' });
 await waitFor(() => expect(hook.result.current.ready).toBe(true)); act(() => { old.markShown(); old.dismiss(['home.today']); });
 expect(guidanceCoordinator.data().records).toEqual({});
});
it('respects Show tips and cancels before dwell on a global lock', async () => {
 const hook = renderHook(() => useTeachingQueue(initial)); await waitFor(() => expect(hook.result.current.ready).toBe(true));
 act(() => { hook.result.current.markShown(); useSettingsStore.setState({ showTips: false }); });
 expect(hook.result.current.steps).toEqual([]); expect(guidanceCoordinator.data().records['today.recommended'].displayCount).toBe(0);
});
it('cancels delayed hydration callbacks when unmounted', async () => {
 const hook = renderHook(() => useTeachingQueue({ ...initial, accountId: 'slow-new-account' })); hook.unmount();
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); expect(guidanceCoordinator.snapshot()).toBeNull();
});
it('treats whisper timeout as a system end rather than a user dismissal', async () => {
 const h = renderHook(() => useTeachingQueue({ ...initial, screenId: 'vision', eligible: ['vision.first'] })); await waitFor(() => expect(h.result.current.ready).toBe(true));
 act(() => h.result.current.markShown()); act(() => h.result.current.dismiss([], 'timeout'));
 expect(guidanceCoordinator.data().records['vision.first_photo'].outcome).toBeUndefined(); expect(h.result.current.steps).toEqual([]);
});
