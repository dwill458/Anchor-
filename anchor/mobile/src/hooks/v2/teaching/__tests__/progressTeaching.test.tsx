import { act, renderHook, waitFor } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { progressTeachingBeats } from '../progressTeaching';
import { useTeachingQueue } from '../useTeachingQueue';
import { resetTeachingSeenCache } from '../teachingSeen';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((action: any) => { action(); return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() }; });
beforeEach(resetTeachingSeenCache);
it('teaches hero and week on visit one, then rhythm and a rendered route on visit two', async () => {
  const props = { screenId: 'progress', accountId: null, eligible: progressTeachingBeats({ unmeasured: false, hasWeek: true, hasRhythm: true, hasRoute: true }), cap: 2, blocked: false, isFocused: true };
  const { result, rerender } = renderHook(p => useTeachingQueue(p), { initialProps: props });
  await waitFor(() => expect(result.current.steps).toEqual(['progress.thread', 'progress.week']));
  act(() => result.current.dismiss());
  rerender({ ...props, isFocused: false });
  rerender(props);
  await waitFor(() => expect(result.current.steps).toEqual(['progress.rhythm', 'progress.route']));
});
it('skips the unmeasured thread and absent route', () => {
  expect(progressTeachingBeats({ unmeasured: true, hasWeek: true, hasRhythm: true, hasRoute: false })).toEqual(['progress.week', 'progress.rhythm']);
});
