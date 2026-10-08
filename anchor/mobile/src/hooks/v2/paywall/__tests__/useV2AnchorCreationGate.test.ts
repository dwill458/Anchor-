import { renderHook } from '@testing-library/react-native';

jest.mock('../useV2TrialState', () => ({
  __esModule: true,
  useV2TrialState: () => mockTrialSnapshot,
}));

let mockTrialSnapshot = { hasEntitlement: false } as { hasEntitlement: boolean };

import { useAnchorStore } from '@/stores/anchorStore';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { useV2AnchorCreationGate } from '../useV2AnchorCreationGate';

beforeEach(() => {
  mockTrialSnapshot = { hasEntitlement: false };
  useAnchorStore.setState({ anchors: [] });
});

describe('useV2AnchorCreationGate', () => {
  it('allows the first Anchor and stays out of onboarding', () => {
    const { result } = renderHook(() => useV2AnchorCreationGate());
    expect(result.current.result).toEqual({ allowed: true, paywallContext: null });
    expect(result.current.evaluate({ isOnboarding: true })).toEqual({ allowed: true, paywallContext: null });
  });

  it('raises SECOND_ANCHOR once one active Anchor already exists', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    const { result } = renderHook(() => useV2AnchorCreationGate());
    expect(result.current.result).toEqual({ allowed: false, paywallContext: 'SECOND_ANCHOR' });
    // Onboarding is still never gated.
    expect(result.current.evaluate({ isOnboarding: true }).allowed).toBe(true);
  });

  it('ignores released Anchors and never gates an entitled user', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', isReleased: true })] });
    const { result, rerender } = renderHook(() => useV2AnchorCreationGate());
    expect(result.current.result.allowed).toBe(true);

    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' }), makeAnchor({ id: 'b' })] });
    mockTrialSnapshot = { hasEntitlement: true };
    rerender({});
    expect(result.current.result).toEqual({ allowed: true, paywallContext: null });
  });
});
