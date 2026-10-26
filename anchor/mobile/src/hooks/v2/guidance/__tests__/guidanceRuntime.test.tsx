import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Keyboard } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGuidanceSurfaceLocks } from '@/stores/v2/guidanceSurfaceLocks';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useCourseStore } from '@/stores/courseStore';
import { useGuidanceLifecycle } from '../useGuidanceLifecycle';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { guidanceCoordinator, replayGuidance } from '../guidanceRuntime';
import { V2DialogManager } from '@/components/v2/feedback/V2DialogManager';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
jest.mock('@/stores/encryptedPersistStorage', () => ({ readSecureValue: jest.fn(async () => null), writeSecureValue: jest.fn(async () => undefined), encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) } }));
jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; } }));
let sequence = 0;
beforeEach(() => { sequence++; useAuthStore.setState({ user: { id: `runtime-test-${sequence}` } as never }); useSettingsStore.setState({ showTips: true }); useMilestoneCelebrationStore.setState({ queue: [], holds: [] }); useCelebrationStore.getState().reset(); useGuidanceSurfaceLocks.setState({ keys: [] }); useCourseStore.setState({ initializationStatus: 'idle', activeCourse: null }); V2DialogManager.hide(); });
function useHost() { useGuidanceLifecycle(); const accountId = useAuthStore(state => state.user?.id ?? null); return useTeachingQueue({ accountId, screenId: 'home', eligible: ['home.today'], cap: 1, blocked: false, isFocused: true }); }
it('binds real auth transitions, sign-out and new account without stale outcomes', async () => {
 const h = renderHook(useHost); await waitFor(() => expect(h.result.current.ready).toBe(true)); const stale = h.result.current;
 act(() => useAuthStore.setState({ user: { id: 'runtime-switched' } as never })); await waitFor(() => expect(guidanceCoordinator.snapshot()?.account).toBe('runtime-switched'));
 act(() => { stale.markShown(); stale.dismiss(['home.today']); }); expect(guidanceCoordinator.data().records).toEqual({});
 act(() => useAuthStore.setState({ user: null })); await waitFor(() => expect(guidanceCoordinator.snapshot()?.account).toBe('guest'));
});
it('fails closed when encrypted hydration rejects', async () => {
 jest.mocked(encryptedPersistStorage.getItem).mockRejectedValueOnce(new Error('locked'));
 const h = renderHook(useHost); await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); expect(h.result.current.steps).toEqual([]);
});
it.each(['modal','dialog','celebration'])('yields an actual host to %s without holding the milestone presenter', async lock => {
 const h = renderHook(useHost); await waitFor(() => expect(h.result.current.ready).toBe(true)); act(() => h.result.current.markShown());
 act(() => { if (lock === 'modal') useGuidanceSurfaceLocks.getState().set('test',true); else if (lock === 'dialog') V2DialogManager.showAlert({ title: 'Test' }); else useMilestoneCelebrationStore.setState({ queue: [{ key: 'test' } as never] }); });
 expect(h.result.current.steps).toEqual([]); expect(guidanceCoordinator.data().records['today.recommended'].displayCount).toBe(0); expect(useMilestoneCelebrationStore.getState().holds).toEqual([]);
});
it('replay retains discovered history and leaves story flags outside the coordinator', async () => {
 const h = renderHook(useHost); await waitFor(() => expect(h.result.current.ready).toBe(true));
 act(() => guidanceCoordinator.discover('today.recommended')); await act(async () => replayGuidance(useAuthStore.getState().user!.id));
 expect(h.result.current.steps).toEqual([]); expect(guidanceCoordinator.data().records['today.recommended'].outcome).toBe('obsolete');
});
it('reads completed moves only from the bound account course history', async () => {
 const h = renderHook(useHost); await waitFor(() => expect(h.result.current.ready).toBe(true));
 act(() => useCourseStore.setState({ accountId: 'wrong-account', initializationStatus: 'ready', activeCourse: { moves: [{ status: 'COMPLETED' }] } as never }));
 expect(guidanceCoordinator.data().records['chart.next_move']).toBeUndefined();
 act(() => useCourseStore.setState({ accountId: useAuthStore.getState().user!.id }));
 await waitFor(() => expect(guidanceCoordinator.data().records['chart.next_move']?.outcome).toBe('obsolete'));
});
it('ignores a replay callback from the previous account', async () => {
 const h = renderHook(useHost); await waitFor(() => expect(h.result.current.ready).toBe(true)); const old = useAuthStore.getState().user!.id;
 act(() => useAuthStore.setState({ user: { id: 'replay-current-account' } as never })); await waitFor(() => expect(guidanceCoordinator.snapshot()?.account).toBe('replay-current-account'));
 await act(async () => replayGuidance(old)); expect(guidanceCoordinator.snapshot()?.account).toBe('replay-current-account');
});
it('does not import a legacy per-course mark again after an explicit Chart replay', async () => {
 const { prepareChartGuidance } = require('../guidanceRuntime');
 const h = renderHook(useHost); await waitFor(() => expect(h.result.current.ready).toBe(true)); const account = useAuthStore.getState().user!.id;
 await act(async () => replayGuidance(account, 'chart.next_move'));
 const storage = jest.mocked(encryptedPersistStorage.getItem); storage.mockClear();
 await act(async () => prepareChartGuidance(account, 'old-course'));
 expect(storage).not.toHaveBeenCalledWith(`anchor:v2:chart2:taught:${account}:old-course`);
 expect(guidanceCoordinator.data().records['chart.next_move']).toBeUndefined();
});


// Real coordinator/runtime/host integration for the completion-only scene line.
it('allows the completion host after celebration, persists one variant and rejects duplicates', async () => {
 const { useGuidanceHost } = require('../useGuidanceHost');
 const account = useAuthStore.getState().user!.id;
 useMilestoneCelebrationStore.setState({ queue: [{ key: 'queued' } as never] });
 const h = renderHook(() => useGuidanceHost({ screenId: 'practice-completion', accountId: account, contextKey: 'saved-session', variant: 'B', eligible: ['thread.glow'], isFocused: true, blocked: false }));
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
 expect(h.result.current.presentation).toBeNull();
 act(() => useMilestoneCelebrationStore.setState({ queue: [] }));
 await waitFor(() => expect(h.result.current.presentation?.id).toBe('thread.glow'));
 act(() => { h.result.current.markShown(); h.result.current.markShown(); });
 await waitFor(() => expect(guidanceCoordinator.data().records['thread.glow']?.displayCount).toBe(1), { timeout: 2000 });
 expect(guidanceCoordinator.data().records['thread.glow']).toMatchObject({ variant: 'B', presentAttempts: 1 });
 h.rerender({});
 expect(guidanceCoordinator.data().records['thread.glow'].presentAttempts).toBe(1);
 act(() => h.result.current.dismiss('close'));
 expect(guidanceCoordinator.data().records['thread.glow'].outcome).toBe('dismissed');
});
it('tips disabled and leaving a blocked completion never defer a lesson to Home', async () => {
 const { useGuidanceHost } = require('../useGuidanceHost');
 useSettingsStore.setState({ showTips: false });
 const account = useAuthStore.getState().user!.id;
 const h = renderHook(({ focused }) => useGuidanceHost({ screenId: 'practice-completion', accountId: account, contextKey: 'saved-session', eligible: ['thread.glow'], isFocused: focused, blocked: false }), { initialProps: { focused: true } });
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
 expect(h.result.current.presentation).toBeNull();
 h.rerender({ focused: false });
 act(() => useSettingsStore.setState({ showTips: true }));
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
 expect(h.result.current.presentation).toBeNull();
 h.unmount();
 expect(guidanceCoordinator.snapshot()).toBeNull();
});
