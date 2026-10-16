import { renderHook } from '@testing-library/react-native';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useV2PracticeModel } from '../useV2PracticeModel';

jest.mock('@/hooks/v2/vision', () => ({ useV2Vision: () => ({ state: { kind: 'none' } }) }));
jest.mock('@/adapters/v2/home', () => ({
  toThreadPresentation: () => null,
  toV2HomeVisionState: () => ({ state: 'none' }),
}));
jest.mock('@/adapters/v2/practice', () => ({
  fetchV2RecommendationContext: jest.fn(() => new Promise(() => undefined)),
}));
jest.mock('@/adapters/v2/practice/recommendationCache', () => ({
  isV2RecommendationContextFresh: () => false,
  peekV2RecommendationContext: () => null,
}));

const resetSubscription = () =>
  useSubscriptionStore.setState({
    entitlementReady: false,
    hasActiveEntitlement: false,
    remoteCompedAccess: false,
    legacyMigrationAccess: false,
    devOverrideEnabled: false,
  });

describe('useV2PracticeModel entitlement capabilities', () => {
  beforeEach(resetSubscription);
  afterAll(resetSubscription);

  it('allows every premium practice for a server-verified comped account while RevenueCat is unresolved', () => {
    useSubscriptionStore.setState({ remoteCompedAccess: true, entitlementReady: false });
    const { result } = renderHook(() => useV2PracticeModel(null));
    expect(result.current.capability).toEqual({ focus: true, deep_prime: true, visualize: true, release: true });
  });

  it('keeps a free account gated from Deep Focus and Visualize once RevenueCat has answered', () => {
    useSubscriptionStore.setState({ entitlementReady: true, hasActiveEntitlement: false });
    const { result } = renderHook(() => useV2PracticeModel(null));
    expect(result.current.capability).toEqual({ focus: true, deep_prime: false, visualize: false, release: true });
  });

  it('does not grant premium practice to an unresolved non-comped account', () => {
    useSubscriptionStore.setState({ entitlementReady: false, hasActiveEntitlement: false });
    const { result } = renderHook(() => useV2PracticeModel(null));
    expect(result.current.capability.deep_prime).toBe(false);
    expect(result.current.capability.visualize).toBe(false);
  });

  it('allows premium practice for a paid RevenueCat entitlement', () => {
    useSubscriptionStore.setState({ entitlementReady: true, hasActiveEntitlement: true });
    const { result } = renderHook(() => useV2PracticeModel(null));
    expect(result.current.capability).toEqual({ focus: true, deep_prime: true, visualize: true, release: true });
  });
});
