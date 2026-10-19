import { act, renderHook, waitFor } from '@testing-library/react-native';
import { homeTeachingBeats } from '../homeTeaching';
import { useTeachingQueue } from '../useTeachingQueue';
import { resetTeachingSeenCache } from '../teachingSeen';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; } }));
beforeEach(resetTeachingSeenCache);
async function visit(hasVision: boolean, hasChart: boolean, expected: string[]) {
  const hook = renderHook(() => useTeachingQueue({ screenId: 'home', accountId: null, eligible: homeTeachingBeats({ hasAnchor: true, hasVision, hasChart }), cap: 2, blocked: false, isFocused: true }));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  expect(hook.result.current.steps).toEqual(expected);
  act(() => hook.result.current.dismiss());
  hook.unmount();
}
it('anchor-only teaches Today and Progress, then adding Vision and Chart teaches only their new features', async () => {
  await visit(false, false, ['home.today', 'home.progress']);
  await visit(false, false, []);
  await visit(true, false, ['home.vision', 'home.thread']);
  await visit(true, true, ['home.chart']);
});
it('everything-at-once teaches Today and Vision, then Chart and Thread', async () => {
  await visit(true, true, ['home.today', 'home.vision']);
  await visit(true, true, ['home.chart', 'home.thread']);
});
it('never teaches Thread without Vision, or together with Progress', () => {
  expect(homeTeachingBeats({ hasAnchor: true, hasVision: false, hasChart: true })).not.toContain('home.thread');
  expect(homeTeachingBeats({ hasAnchor: true, hasVision: true, hasChart: true })).not.toContain('home.progress');
  expect(homeTeachingBeats({ hasAnchor: false, hasVision: false, hasChart: false })).toEqual([]);
});
