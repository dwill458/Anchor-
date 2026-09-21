import AsyncStorage from '@react-native-async-storage/async-storage';
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
    await AsyncStorage.removeItem('anchor:v2:first-run');
  } catch {
    // Ignore storage removal errors
  }
}
