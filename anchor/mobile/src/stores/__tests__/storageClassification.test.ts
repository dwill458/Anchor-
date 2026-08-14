import { STORAGE_CLASSIFICATION_MATRIX } from '../storageClassification';

describe('storageClassification', () => {
  it('contains the STORAGE_CLASSIFICATION_MATRIX with expected stores', () => {
    expect(STORAGE_CLASSIFICATION_MATRIX).toBeDefined();
    expect(STORAGE_CLASSIFICATION_MATRIX.authStore).toBeDefined();
    expect(STORAGE_CLASSIFICATION_MATRIX.anchorStore).toBeDefined();
    expect(STORAGE_CLASSIFICATION_MATRIX.sessionStore).toBeDefined();
    expect(STORAGE_CLASSIFICATION_MATRIX.teachingStore).toBeDefined();
    expect(STORAGE_CLASSIFICATION_MATRIX.settingsStore).toBeDefined();
  });

  it('maps expected keys in authStore to storage classes', () => {
    const authStore = STORAGE_CLASSIFICATION_MATRIX.authStore;
    expect(authStore.token).toBe('token');
    expect(authStore.user).toBe('identity');
    expect(authStore.hasCompletedOnboarding).toBe('low_sensitivity_preferences');
    expect(authStore.anchorCount).toBe('high_sensitivity_telemetry');
  });

  it('maps expected keys in anchorStore to storage classes', () => {
    const anchorStore = STORAGE_CLASSIFICATION_MATRIX.anchorStore;
    expect(anchorStore.anchors).toBe('high_sensitivity_telemetry');
    expect(anchorStore.isLoading).toBe('session_only');
  });

  it('maps expected keys in settingsStore to low_sensitivity_preferences', () => {
    const settingsStore = STORAGE_CLASSIFICATION_MATRIX.settingsStore;
    expect(settingsStore.language).toBe('low_sensitivity_preferences');
    expect(settingsStore.biometricLockEnabled).toBe('low_sensitivity_preferences');
    expect(settingsStore.soundEnabled).toBe('low_sensitivity_preferences');
  });
});
