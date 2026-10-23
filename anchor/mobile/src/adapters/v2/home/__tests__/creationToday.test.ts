import { act, renderHook } from '@testing-library/react-native';
import { useV2HomeModel } from '../useV2HomeModel';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { invalidateV2RecommendationContext, rememberV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import type { V2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';
import { makeAnchor } from './fixtures';

jest.mock('@/hooks/v2/vision', () => ({ useV2Vision: () => ({ state: { state: 'none' }, refresh: jest.fn() }) }));
jest.mock('@/adapters/v2/practice', () => ({ fetchV2RecommendationContext: jest.fn(() => new Promise(() => undefined)) }));
jest.mock('@/services/AuthHydrationService', () => ({ __esModule: true, default: { hydrateAuthenticatedData: jest.fn() } }));

it('uses the newly selected Anchor recommendation and mode duration after creation, without the previous card leaking', async () => {
  useAuthStore.setState({ user: { id: 'creation-today-user' } as never });
  useCourseStore.setState({ accountId: 'creation-today-user', activeCourse: null, courses: [], initializationStatus: 'ready' });
  useAnchorStore.setState({ anchors: [makeAnchor({ id: 'new', localId: undefined, userId: 'creation-today-user' }), makeAnchor({ id: 'old', localId: undefined, userId: 'creation-today-user' })],
    currentAnchorId: 'old', isLoading: false, persistedHydrated: true, remoteAnchorState: 'confirmed' });
  invalidateV2RecommendationContext();
  const context = (anchorId: string, action: 'Focus' | 'Deep Prime'): V2RecommendationContext => ({
    anchorId, completionSignal: null, vision: { exists: false, seenToday: false },
    thread: { delta7d: null, delta7dStatus: 'UNAVAILABLE', status: 'UNAVAILABLE' }, recommendation: { action, reason: 'server' },
  });
  rememberV2RecommendationContext('old', context('old', 'Focus'));
  rememberV2RecommendationContext('new', context('new', 'Deep Prime'));
  const { result, unmount } = renderHook(() => useV2HomeModel());
  await act(async () => {});
  expect(result.current.today).toMatchObject({ state: 'ready', mode: 'focus', durationSeconds: useSettingsStore.getState().focusSessionDuration });
  act(() => useAnchorStore.setState({ currentAnchorId: 'new' }));
  expect(result.current.today).toMatchObject({ state: 'ready', mode: 'deep_prime', durationSeconds: useSettingsStore.getState().primeSessionDuration });
  expect(result.current.selectedAnchor?.id).toBe('new');
  unmount();
  invalidateV2RecommendationContext();
});

it('fills all five cached Thread Strength readings before selecting another Anchor', async () => {
  const owner = 'five-thread-user';
  useAuthStore.setState({ user: { id: owner } as never });
  const anchors = Array.from({ length: 7 }, (_, index) => makeAnchor({ id: `five-${index}`, localId: undefined, userId: owner, threadStrength: 0 }));
  useAnchorStore.setState({ anchors, currentAnchorId: 'five-0', isLoading: false, persistedHydrated: true, remoteAnchorState: 'confirmed' });
  invalidateV2RecommendationContext();
  const { result, unmount } = renderHook(() => useV2HomeModel());
  await act(async () => {});
  const ids = [0, 1, 6, 2, 5];
  act(() => ids.forEach(index => rememberV2RecommendationContext(`five-${index}`, {
    anchorId: `five-${index}`, completionSignal: null, vision: { exists: false, seenToday: false },
    thread: { strength: 20 + index, delta7d: index, delta7dStatus: 'AVAILABLE', status: 'AVAILABLE' },
    recommendation: { action: 'Focus', reason: 'server' },
  })));
  expect(result.current.selectedIndex).toBe(0);
  ids.forEach(index => expect(result.current.anchorList[index].thread).toMatchObject({ value: 20 + index, delta: index }));
  // Publishing display cache entries must not rewrite the user's Anchor vault.
  expect(useAnchorStore.getState().anchors.every(anchor => anchor.threadStrength === 0)).toBe(true);
  act(() => useAnchorStore.setState({ currentAnchorId: 'five-1' }));
  expect(result.current.thread?.value).toBe(21);
  expect(result.current.thread?.delta).toBe(1);
  unmount();
  invalidateV2RecommendationContext();
});
