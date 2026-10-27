import { act, renderHook, waitFor } from '@testing-library/react-native';
import { guidanceCoordinator } from '../guidanceRuntime';
import { useGuidanceHost, type GuidanceHostOptions } from '../useGuidanceHost';

jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (action: () => void) => { action(); return { cancel: jest.fn() }; } }));

type LayoutOptions = GuidanceHostOptions & { targetRevision: number };
const initial: LayoutOptions = {
  screenId: 'chart', accountId: 'measurement-isolated-qa', eligible: ['chart.next_move'],
  blocked: false, isFocused: true, targetRevision: 0,
};

it('forwards real target layout changes so an unmeasurable teaching can appear in the same mounted screen', async () => {
  const hook = renderHook(options => useGuidanceHost(options), { initialProps: initial });
  await waitFor(() => expect(hook.result.current.presentation?.id).toBe('chart.next_move'));
  const first = hook.result.current.presentation!;
  act(() => hook.result.current.dismiss('unmeasurable'));
  expect(hook.result.current.presentation).toBeNull();
  hook.rerender({ ...initial, targetRevision: 1 });
  await waitFor(() => expect(hook.result.current.presentation?.id).toBe('chart.next_move'));
  expect(hook.result.current.presentation?.token).not.toBe(first.token);
  expect(guidanceCoordinator.data().records['chart.next_move']).toBeUndefined();
  act(() => hook.result.current.markShown());
  expect(guidanceCoordinator.data().records['chart.next_move'].presentAttempts).toBe(1);
});

it('starts a new visit when a tab regains focus, so an interrupted tip can return without an app restart', async () => {
  const home: LayoutOptions = { screenId: 'home', accountId: 'visit-focus-qa', eligible: ['home.open_anchor'], blocked: false, isFocused: true, targetRevision: 0 };
  const hook = renderHook(options => useGuidanceHost(options), { initialProps: home });
  await waitFor(() => expect(hook.result.current.presentation?.id).toBe('home.open_anchor'));
  act(() => hook.result.current.dismiss('unmeasurable'));
  expect(hook.result.current.presentation).toBeNull();
  // Same visit, same target: nothing comes back.
  hook.rerender({ ...home });
  expect(hook.result.current.presentation).toBeNull();
  hook.rerender({ ...home, isFocused: false });
  hook.rerender({ ...home, isFocused: true });
  await waitFor(() => expect(hook.result.current.presentation?.id).toBe('home.open_anchor'));
});
