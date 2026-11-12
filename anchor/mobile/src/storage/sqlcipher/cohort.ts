const ISOLATED_SQLCIPHER_APPLICATION_IDS: ReadonlySet<string> = new Set([
  'com.anchorintentions.sqlcipherlab20261013',
  'com.anchorintentions.sqlcipherpreview20261015',
  'com.anchorintentions.expo58qa20261016',
]);
const OWNER_PILOT_APPLICATION_ID = 'com.anchorintentions.app';

export function isSqlCipherAndroidStoreEnabled(
  platform: string,
  applicationId: string | null | undefined,
  runtimeVersion: string | null | undefined,
  enabled: boolean,
): boolean {
  return enabled && platform === 'android' && applicationId === OWNER_PILOT_APPLICATION_ID &&
    runtimeVersion === '2.0-android-sqlcipher-v1';
}

export function isSqlCipherNativeCohortAllowed(
  applicationId: string | null | undefined,
  ownerPilotEnabled: boolean,
  ownerPilotMigrationEnabled: boolean,
): boolean {
  if (!applicationId) return false;
  if (ISOLATED_SQLCIPHER_APPLICATION_IDS.has(applicationId)) return true;
  return applicationId === OWNER_PILOT_APPLICATION_ID && ownerPilotEnabled && ownerPilotMigrationEnabled;
}

export function isSqlCipherStorageEnabled(labEnabled: boolean, ownerPilotEnabled: boolean, ownerPilotMigrationEnabled: boolean): boolean {
  return labEnabled || (ownerPilotEnabled && ownerPilotMigrationEnabled);
}
