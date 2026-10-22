import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';

/**
 * Reset helper for developer onboarding reset actions.
 * Safely resets in-memory first-run draft state and persisted storage.
 */
export async function resetFirstRunStore(): Promise<void> {
  try {
    useFirstRunStore.getState().reset();
  } catch {
    // Ignore if firstRunStore reset fails
  }
  try {
    await Promise.all([
      AsyncStorage.removeItem('anchor:v2:first-run'),
      encryptedPersistStorage.removeItem('anchor:v2:first-run'),
    ]);
  } catch {
    // Ignore storage removal errors
  }
}
