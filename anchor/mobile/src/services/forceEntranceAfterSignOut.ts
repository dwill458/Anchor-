import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useSettingsStore } from '@/stores/settingsStore';

/** Ensure a signed-out app starts at the first-run entrance, including in development. */
export function forceEntranceAfterSignOut(): void {
  const settings = useSettingsStore.getState();
  settings.setDeveloperMasterAccountEnabled(false);
  settings.setDeveloperSkipOnboardingEnabled(false);
  useFirstRunStore.getState().reset();
}
