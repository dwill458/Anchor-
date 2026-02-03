// Utility script to clear AsyncStorage anchor data
// Run with: node clear-anchor-storage.js

console.log(`
🧹 To clear old anchor data, add this to your app temporarily:

import AsyncStorage from '@react-native-async-storage/async-storage';

// Add this button to a debug screen:
const clearOldAnchors = async () => {
  await AsyncStorage.removeItem('anchor-vault-storage');
  console.log('✅ Cleared old anchor data. Restart the app.');
};

OR in React Native Debugger console:
AsyncStorage.clear().then(() => console.log('Cleared'));

Then create a NEW anchor to test the fix.
`);
