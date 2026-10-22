import { useSettingsStore } from '../settingsStore';

describe('guide mode default', () => {
  it('starts off for a fresh install', () => {
    expect(useSettingsStore.getInitialState().guideMode).toBe(false);
  });

  it('merges an existing persisted true without replacing it with the default', () => {
    const options = useSettingsStore.persist.getOptions();
    const merged = options.merge!({ guideMode: true }, useSettingsStore.getInitialState());
    expect(merged.guideMode).toBe(true);
  });
});
