import { act, renderHook, waitFor } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { detailsTeachingBeats, DETAILS_BEATS_PER_VISIT } from '../detailsTeaching';
import { useTeachingQueue } from '../useTeachingQueue';
import { resetTeachingSeenCache } from '../teachingSeen';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((action: any) => { action(); return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() }; });
beforeEach(resetTeachingSeenCache);
it('caps at one per visit, Vision before Chart', async () => {
  const props = { screenId: 'details', accountId: null, eligible: detailsTeachingBeats(true, true), cap: DETAILS_BEATS_PER_VISIT, blocked: false, isFocused: true };
  const { result, rerender } = renderHook(p => useTeachingQueue(p), { initialProps: props });
  await waitFor(() => expect(result.current.steps).toEqual(['details.vision']));
  act(() => result.current.dismiss());
  rerender({ ...props, isFocused: false });
  rerender(props);
  await waitFor(() => expect(result.current.steps).toEqual(['details.chart']));
});
it('has no candidates for populated sections', () => {
  expect(detailsTeachingBeats(false, false)).toEqual([]);
  expect(detailsTeachingBeats(false, true)).toEqual(['details.chart']);
});
