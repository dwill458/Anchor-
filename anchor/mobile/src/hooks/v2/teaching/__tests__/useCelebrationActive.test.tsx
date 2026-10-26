import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCelebrationActive } from '../useCelebrationActive';
import { useTeachingQueue } from '../useTeachingQueue';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { resetTeachingSeenCache } from '../teachingSeen';
import { resetTeachingSession } from '../teachingSession';
import fs from 'fs';
import path from 'path';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; } }));
beforeEach(() => {
  useMilestoneCelebrationStore.setState({ queue: [], holds: [] });
  useCelebrationStore.getState().reset();
  resetTeachingSeenCache(); resetTeachingSession();
});
function useQueue() {
  return useTeachingQueue({ screenId: 'home', accountId: null, eligible: ['home.today'], cap: 1, isFocused: true, blocked: useCelebrationActive() });
}
it('waits while a milestone is queued, then shows only after it ends', async () => {
  useMilestoneCelebrationStore.setState({ queue: [{ key: 'test' } as never] });
  const hook = renderHook(useQueue);
  expect(hook.result.current.steps).toEqual([]);
  act(() => useMilestoneCelebrationStore.getState().shift('test'));
  await waitFor(() => expect(hook.result.current.steps).toEqual(['home.today']));
});
it('hides visible teaching immediately when a milestone arrives, without holding it', async () => {
  const hook = renderHook(useQueue);
  await waitFor(() => expect(hook.result.current.steps).toEqual(['home.today']));
  act(() => useMilestoneCelebrationStore.setState({ queue: [{ key: 'test' } as never] }));
  expect(hook.result.current.steps).toEqual([]);
  expect(useMilestoneCelebrationStore.getState().holds).toEqual([]);
});
it('also yields to scenes owned by the existing celebration coordinator', () => {
  const hook = renderHook(useCelebrationActive);
  expect(hook.result.current).toBe(false);
  act(() => { useCelebrationStore.getState().request(2, 'scene'); });
  expect(hook.result.current).toBe(true);
  act(() => useCelebrationStore.getState().finish('scene'));
  expect(hook.result.current).toBe(false);
});
it('teaching modules never import a celebration hold', () => {
  for (const directory of ['hooks/v2/teaching', 'components/v2/teaching']) {
    for (const name of fs.readdirSync(path.join(__dirname, '../../../..', directory))) {
      if (!/\.tsx?$/.test(name)) continue;
      expect(fs.readFileSync(path.join(__dirname, '../../../..', directory, name), 'utf8')).not.toContain('useMilestonePresentationHold');
    }
  }
});
it.each([
  'screens/v2/home/V2HomeScreen.tsx', 'screens/v2/practice/V2PracticeScreen.tsx',
  'screens/v2/progress/V2ProgressScreen.tsx', 'components/v2/vision/V2SavedVision.tsx',
  'components/v2/chart/ChartActiveView.tsx',
])('wires celebration blocking in %s', file => {
  const source = fs.readFileSync(path.join(__dirname, '../../../..', file), 'utf8');
  expect(source).toContain('useCelebrationActive()');
  expect(source).toMatch(/(?:homeIsIdle = !celebrationActive|blocked: celebrationActive|visionTeachingBlocked = celebrationActive|visible=\{teachingVisible && !celebrationActive\})/);
});
