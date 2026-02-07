/**
 * Quick script to reset onboarding for testing
 *
 * Run this in Expo Go console or add to your app temporarily:
 *
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * AsyncStorage.removeItem('anchor-auth-storage').then(() => console.log('Onboarding reset!'));
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear the auth storage (includes onboarding state)
AsyncStorage.removeItem('anchor-auth-storage')
  .then(() => {
    console.log('✅ Onboarding state reset! Reload the app to see onboarding.');
  })
  .catch((error) => {
    console.error('❌ Failed to reset onboarding:', error);
  });

// Or to see what's currently stored:
AsyncStorage.getItem('anchor-auth-storage')
  .then((value) => {
    console.log('Current auth storage:', JSON.parse(value || '{}'));
  });
