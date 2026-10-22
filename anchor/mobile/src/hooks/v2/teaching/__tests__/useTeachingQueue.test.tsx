import { act, renderHook, waitFor } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { useTeachingQueue } from '../useTeachingQueue';
import { getTeachingSeen, resetTeachingSeenCache } from '../teachingSeen';
import { canStartCoachSequence, recordCoachSequence, resetTeachingSession, MAX_COACH_SEQUENCES_PER_SESSION } from '../teachingSession';
import type { BeatId } from '@/constants/v2/teachingCopy';

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('@/utils/scheduleAfterInteractions', () => ({
  scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; },
}));

type QueueOptions = Parameters<typeof useTeachingQueue>[0];
const initial: QueueOptions = { screenId: 'home', accountId: null, eligible: ['home.today', 'home.progress', 'home.chart'], cap: 2, blocked: false, isFocused: true };

beforeEach(() => {
  resetTeachingSeenCache();
  resetTeachingSession();
});

it('takes first N unseen, freezes streaming eligibility, and saves the entire dismissed batch', async () => {
  const { result, rerender, unmount } = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(result.current.steps).toEqual(['home.today', 'home.progress']));
  rerender({ ...initial, eligible: ['home.vision'] });
  expect(result.current.steps).toEqual(['home.today', 'home.progress']);
  act(() => result.current.dismiss());
  expect(await getTeachingSeen(null, 'home.progress')).toBe(true);
  unmount();
  const second = renderHook(() => useTeachingQueue({ ...initial, eligible: ['home.today', 'home.progress'] }));
  await waitFor(() => expect(second.result.current.ready).toBe(true));
  expect(second.result.current.steps).toEqual([]);
});

it('waits while blocked and interrupts without marking or restarting this visit', async () => {
  const { result, rerender } = renderHook(props => useTeachingQueue(props), { initialProps: { ...initial, blocked: true } });
  expect(result.current.steps).toEqual([]);
  rerender(initial);
  await waitFor(() => expect(result.current.steps).toHaveLength(2));
  rerender({ ...initial, blocked: true });
  act(() => result.current.dismiss());
  expect(await getTeachingSeen(null, 'home.today')).toBe(false);
  rerender(initial);
  expect(result.current.steps).toEqual([]);
  rerender({ ...initial, isFocused: false });
  rerender(initial);
  await waitFor(() => expect(result.current.steps).toHaveLength(2));
});

it('does not commit an old account batch after an account switch', async () => {
  const { result, rerender } = renderHook(props => useTeachingQueue(props), { initialProps: { ...initial, accountId: 'a' } });
  await waitFor(() => expect(result.current.steps).toHaveLength(2));
  const staleDismiss = result.current.dismiss;
  rerender({ ...initial, accountId: 'b', blocked: false });
  await waitFor(() => expect(result.current.steps).toHaveLength(2));
  act(staleDismiss);
  expect(await getTeachingSeen('b', 'home.today')).toBe(false);
});

it('marks presented beat seen on present and never re-decides it on next focus', async () => {
  const { result, rerender } = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => result.current.markShown('home.today'));
  expect(await getTeachingSeen(null, 'home.today')).toBe(true);
  expect(await getTeachingSeen(null, 'home.progress')).toBe(false);

  rerender({ ...initial, isFocused: false });
  rerender(initial);
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.steps).toEqual(['home.progress', 'home.chart']);
});

it('does not mark a decided beat if interrupted before presentation', async () => {
  const { result, rerender } = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(result.current.steps).toEqual(['home.today', 'home.progress']));
  rerender({ ...initial, blocked: true });
  expect(await getTeachingSeen(null, 'home.today')).toBe(false);
  expect(await getTeachingSeen(null, 'home.progress')).toBe(false);
});

it('leaves presented beat seen and unpresented remainder unseen when blocked mid-sequence', async () => {
  const { result, rerender } = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => result.current.markShown('home.today'));
  expect(await getTeachingSeen(null, 'home.today')).toBe(true);
  expect(await getTeachingSeen(null, 'home.progress')).toBe(false);

  rerender({ ...initial, blocked: true });
  expect(await getTeachingSeen(null, 'home.today')).toBe(true);
  expect(await getTeachingSeen(null, 'home.progress')).toBe(false);
});

it('does not write when markShown is called while blocked or on a stale session', async () => {
  const { result, rerender } = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(result.current.steps).toEqual(['home.today', 'home.progress']));

  rerender({ ...initial, blocked: true });
  act(() => result.current.markShown('home.today'));
  expect(await getTeachingSeen(null, 'home.today')).toBe(false);

  rerender({ ...initial, blocked: false, accountId: 'user-1' });
  await waitFor(() => expect(result.current.steps).toEqual(['home.today', 'home.progress']));
  const staleMarkShown = result.current.markShown;
  rerender({ ...initial, blocked: false, accountId: 'user-2' });
  act(() => staleMarkShown('home.today'));
  expect(await getTeachingSeen('user-1', 'home.today')).toBe(false);
  expect(await getTeachingSeen('user-2', 'home.today')).toBe(false);
});

it('anchor switching on Details and Practice: presenting a beat, switching anchor, and refocusing shows nothing', async () => {
  // Details screen
  const detailsProps: QueueOptions = { screenId: 'details', accountId: null, eligible: ['details.vision'], cap: 1, blocked: false, isFocused: true };
  const details = renderHook(props => useTeachingQueue(props), { initialProps: detailsProps });
  await waitFor(() => expect(details.result.current.steps).toEqual(['details.vision']));
  act(() => details.result.current.markShown('details.vision'));
  expect(await getTeachingSeen(null, 'details.vision')).toBe(true);
  // Anchor switch: blocked flips true then false
  details.rerender({ ...detailsProps, blocked: true });
  details.rerender({ ...detailsProps, blocked: false });
  // Refocus
  details.rerender({ ...detailsProps, isFocused: false });
  details.rerender({ ...detailsProps, isFocused: true });
  await waitFor(() => expect(details.result.current.ready).toBe(true));
  expect(details.result.current.steps).toEqual([]);
  details.unmount();

  resetTeachingSession();

  // Practice screen
  const practiceProps: QueueOptions = { screenId: 'practice', accountId: null, eligible: ['practice.today'], cap: 2, blocked: false, isFocused: true };
  const practice = renderHook(props => useTeachingQueue(props), { initialProps: practiceProps });
  await waitFor(() => expect(practice.result.current.steps).toEqual(['practice.today']));
  act(() => practice.result.current.markShown('practice.today'));
  expect(await getTeachingSeen(null, 'practice.today')).toBe(true);
  // Anchor switch: blocked flips true then false
  practice.rerender({ ...practiceProps, blocked: true });
  practice.rerender({ ...practiceProps, blocked: false });
  // Refocus
  practice.rerender({ ...practiceProps, isFocused: false });
  practice.rerender({ ...practiceProps, isFocused: true });
  await waitFor(() => expect(practice.result.current.ready).toBe(true));
  expect(practice.result.current.steps).toEqual([]);
});

it('session cap: with MAX = 1, Home presents, then Practice, Progress and Details decide nothing in the same session', async () => {
  expect(MAX_COACH_SEQUENCES_PER_SESSION).toBe(1);
  const home = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(home.result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => home.result.current.markShown('home.today'));
  expect(canStartCoachSequence('home')).toBe(true);
  expect(canStartCoachSequence('practice')).toBe(false);

  // In the same session, Practice, Progress, Details decide nothing (batch empty, ready false)
  const practice = renderHook(() => useTeachingQueue({ screenId: 'practice', accountId: null, eligible: ['practice.today'], cap: 2, blocked: false, isFocused: true }));
  expect(practice.result.current.steps).toEqual([]);
  expect(practice.result.current.ready).toBe(false);

  const progress = renderHook(() => useTeachingQueue({ screenId: 'progress', accountId: null, eligible: ['progress.rhythm'], cap: 2, blocked: false, isFocused: true }));
  expect(progress.result.current.steps).toEqual([]);
  expect(progress.result.current.ready).toBe(false);

  const details = renderHook(() => useTeachingQueue({ screenId: 'details', accountId: null, eligible: ['details.vision'], cap: 1, blocked: false, isFocused: true }));
  expect(details.result.current.steps).toEqual([]);
  expect(details.result.current.ready).toBe(false);
});

it('session cap: Vision whisper still appears, vision.second counts as coach sequence', async () => {
  // Session cap consumed by Home
  const home = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(home.result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => home.result.current.markShown('home.today'));
  home.unmount();

  // Vision whisper still appears
  const whisper = renderHook(() => useTeachingQueue({ screenId: 'vision', accountId: null, eligible: ['vision.first'], cap: 2, blocked: false, isFocused: true }));
  await waitFor(() => expect(whisper.result.current.steps).toEqual(['vision.first']));
  expect(whisper.result.current.ready).toBe(true);
  whisper.unmount();

  // New session: vision.second counts as a coach sequence
  resetTeachingSession();
  const visionSecond = renderHook(() => useTeachingQueue({ screenId: 'vision', accountId: null, eligible: ['vision.second'], cap: 2, blocked: false, isFocused: true }));
  await waitFor(() => expect(visionSecond.result.current.steps).toEqual(['vision.second']));
  act(() => visionSecond.result.current.markShown('vision.second'));
  expect(canStartCoachSequence('vision')).toBe(true);
  expect(canStartCoachSequence('home')).toBe(false);

  const homeAfterVision = renderHook(() => useTeachingQueue({ screenId: 'home', accountId: null, eligible: ['home.chart'], cap: 2, blocked: false, isFocused: true }));
  expect(homeAfterVision.result.current.steps).toEqual([]);
  expect(homeAfterVision.result.current.ready).toBe(false);
});

it('session cap: unmeasurable skip does not consume the slot', async () => {
  const home = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(home.result.current.steps).toEqual(['home.today', 'home.progress']));
  // Target unmeasurable: markShown is NOT called; screen dismisses unmeasurable
  act(() => home.result.current.dismiss([]));
  home.unmount();

  // Slot was NOT consumed
  expect(canStartCoachSequence('practice')).toBe(true);
  const practice = renderHook(() => useTeachingQueue({ screenId: 'practice', accountId: null, eligible: ['practice.today'], cap: 2, blocked: false, isFocused: true }));
  await waitFor(() => expect(practice.result.current.steps).toEqual(['practice.today']));
  expect(practice.result.current.ready).toBe(true);
});

it('session cap: resetTeachingSession and replayAppTeaching event reopen it', async () => {
  const home = renderHook(props => useTeachingQueue(props), { initialProps: initial });
  await waitFor(() => expect(home.result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => home.result.current.markShown('home.today'));
  expect(canStartCoachSequence('practice')).toBe(false);

  // Reset directly
  act(() => resetTeachingSession());
  expect(canStartCoachSequence('practice')).toBe(true);

  // Consume again
  recordCoachSequence('practice');
  expect(canStartCoachSequence('home')).toBe(false);

  // Reset via replayAppTeaching event
  act(() => { DeviceEventEmitter.emit('replayAppTeaching'); });
  expect(canStartCoachSequence('home')).toBe(true);
});

it('session cap holds with no account (guest) and with an account', async () => {
  // Guest
  const guestHome = renderHook(() => useTeachingQueue({ ...initial, accountId: null }));
  await waitFor(() => expect(guestHome.result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => guestHome.result.current.markShown('home.today'));
  const guestPractice = renderHook(() => useTeachingQueue({ screenId: 'practice', accountId: null, eligible: ['practice.today'], cap: 2, blocked: false, isFocused: true }));
  expect(guestPractice.result.current.steps).toEqual([]);
  guestHome.unmount();
  guestPractice.unmount();

  // Account
  resetTeachingSession();
  const accountHome = renderHook(() => useTeachingQueue({ ...initial, accountId: 'acc-42' }));
  await waitFor(() => expect(accountHome.result.current.steps).toEqual(['home.today', 'home.progress']));
  act(() => accountHome.result.current.markShown('home.today'));
  const accountPractice = renderHook(() => useTeachingQueue({ screenId: 'practice', accountId: 'acc-42', eligible: ['practice.today'], cap: 2, blocked: false, isFocused: true }));
  expect(accountPractice.result.current.steps).toEqual([]);
});
