import { DevSettings } from 'react-native';
import * as Updates from 'expo-updates';

/** Reloads without checking for or downloading an update. */
export async function reloadCurrentApp(
  isDevelopment = __DEV__,
  reloadDevelopmentBundle: () => void = () => DevSettings.reload(),
  reloadProductionBundle: () => Promise<void> = () => Updates.reloadAsync(),
): Promise<void> {
  if (isDevelopment) {
    reloadDevelopmentBundle();
    return;
  }
  await reloadProductionBundle();
}
