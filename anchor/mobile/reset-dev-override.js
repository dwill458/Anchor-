// Run this in your app's console or React Native debugger to check/reset dev overrides

// Check current state
import { useSubscriptionStore } from './src/stores/subscriptionStore';

const store = useSubscriptionStore.getState();
console.log('Current subscription state:', {
  rcTier: store.rcTier,
  devOverrideEnabled: store.devOverrideEnabled,
  devTierOverride: store.devTierOverride,
  effectiveTier: store.getEffectiveTier(),
});

// To force free tier for testing:
store.setDevOverrideEnabled(true);
store.setDevTierOverride('free');
console.log('✅ Set to FREE tier');

// Or to reset overrides completely:
// store.resetOverrides();
// console.log('✅ Dev overrides reset');
