// SQLCipher is a native/runtime change. This cohort cannot receive runtime-2.0 OTAs.
const staticConfig = require('./app.json').expo;
module.exports = ({ config = staticConfig } = {}) => {
  const isProductionCohort = process.env.ANCHOR_SQLCIPHER_OWNER_PILOT === '1' ||
                             process.env.APP_ENV === 'production' ||
                             process.env.EXPO_PUBLIC_APP_ENV === 'production' ||
                             process.env.EAS_BUILD_PROFILE === 'production';
  // Allow landscape in development and QA cohorts; keep portrait strictly locked in production.
  const base = {
    ...config,
    orientation: isProductionCohort ? 'portrait' : 'default',
  };
  if (process.env.ANCHOR_SQLCIPHER_APP_PREVIEW === '1') {
    return {
      ...base,
      runtimeVersion: '2.0',
      updates: { ...base.updates, enabled: true },
      android: { ...base.android, allowBackup: false },
      extra: { ...base.extra, sqlCipherOwnerPilot: true, sqlCipherOwnerPilotMigrationEnabled: true },
      plugins: [...base.plugins, ['expo-sqlite', { useSQLCipher: true, enableFTS: false }]],
    };
  }
  // SDK 58 QA uses its own package/runtime and compiles SQLCipher. This test
  // identity is distinct from both public Anchor and the working SQLCipher QA app.
  if (process.env.ANCHOR_EXPO58_QA === '1') {
    const qaPackage = 'com.anchorintentions.expo58qa20261016';
    return {
      ...base,
      name: 'Anchor Expo 58 QA',
      scheme: 'anchor-expo58-qa',
      runtimeVersion: '2.0-expo58-sqlcipher-qa',
      updates: { enabled: false },
      android: { ...base.android, package: qaPackage, versionCode: 1, allowBackup: false },
      ios: { ...base.ios, bundleIdentifier: qaPackage },
      extra: {
        ...base.extra,
        sqlCipherLab: true,
        sqlCipherPreview: false,
        sqlCipherOwnerPilot: false,
        sqlCipherOwnerPilotMigrationEnabled: false,
      },
      plugins: [...base.plugins, ['expo-sqlite', { useSQLCipher: true, enableFTS: false }]],
    };
  }
  // Standalone real-account development app. It uses a separate Android package
  // and runtime from the public app, but keeps production Firebase/API wiring.
  if (process.env.ANCHOR_SQLCIPHER_PRODUCTION_QA === '1') {
    const qaPackage = 'com.anchorintentions.sqlcipherpreview20261015';
    return {
      ...base,
      name: 'Anchor SQLCipher QA',
      scheme: 'anchor-sqlcipher-qa',
      runtimeVersion: '2.0-sqlcipher-v2-realdata-qa',
      // Keep this cohort on its isolated SQLCipher runtime. OTA is opt-in for
      // the dedicated preview profile and remains off for existing QA builds.
      updates: { ...base.updates, enabled: process.env.ANCHOR_SQLCIPHER_OTA_PREVIEW === '1' },
      android: {
        ...base.android,
        package: qaPackage,
        versionCode: Number(process.env.ANCHOR_SQLCIPHER_VERSION_CODE || 42),
        allowBackup: false,
      },
      ios: { ...base.ios, bundleIdentifier: qaPackage },
      extra: {
        ...base.extra,
        sqlCipherLab: true,
        sqlCipherPreview: false,
        sqlCipherOwnerPilot: false,
        sqlCipherOwnerPilotMigrationEnabled: false,
      },
      plugins: [...base.plugins, ['expo-sqlite', { useSQLCipher: true, enableFTS: false }]],
    };
  }
  // Owner-only native pilot. The package/Firebase/API remain production identities,
  // but this opt-in build has its own immutable runtime and cannot receive OTA.
  if (process.env.ANCHOR_SQLCIPHER_OWNER_PILOT === '1') {
    return {
      ...base,
      name: 'Anchor SQLCipher Owner Pilot',
      runtimeVersion: '2.0-sqlcipher-v1-owner-pilot',
      updates: { enabled: false },
      android: { ...base.android, allowBackup: false },
      extra: {
        ...base.extra,
        sqlCipherOwnerPilot: true,
        sqlCipherOwnerPilotMigrationEnabled: process.env.ANCHOR_SQLCIPHER_OWNER_PILOT_ACTIVATE === '1',
      },
      plugins: [...base.plugins, ['expo-sqlite', { useSQLCipher: true, enableFTS: false }]],
    };
  }
  // Standalone isolated QA preview: its own package, runtime and scheme; no OTA; no backup; SQLCipher compiled in.
  // The Firebase registration it ships is a non-production placeholder, so it cannot authenticate to production.
  if (process.env.ANCHOR_SQLCIPHER_PREVIEW === '1') {
    const preview = process.env.ANCHOR_SQLCIPHER_BACKUP_QA === '1'
      ? 'com.anchorintentions.backupqa20261015'
      : 'com.anchorintentions.sqlcipherpreview20261015';
    const migrationEnabled = process.env.ANCHOR_SQLCIPHER_PREVIEW_ACTIVATE === '1';
    return {
      ...base,
      name: 'Anchor SQLCipher Preview',
      scheme: 'anchor-sqlcipher-preview',
      runtimeVersion: '2.0-sqlcipher-v1-preview',
      updates: { enabled: false },
      android: { ...base.android, package: preview, allowBackup: false },
      ios: { ...base.ios, bundleIdentifier: preview },
      extra: { ...base.extra, sqlCipherLab: false, sqlCipherPreview: true, sqlCipherOwnerPilot: true, sqlCipherOwnerPilotMigrationEnabled: migrationEnabled },
      plugins: [...base.plugins, ['expo-sqlite', { useSQLCipher: true, enableFTS: false }]],
    };
  }
  if (process.env.ANCHOR_SQLCIPHER_LAB !== '1') return base;
  return {
    ...base,
    name: 'Anchor SQLCipher Dev',
    scheme: 'anchor-sqlcipher-lab',
    runtimeVersion: '2.0-sqlcipher-v1-lab',
    updates: { enabled: false },
    android: { ...base.android, package: 'com.anchorintentions.sqlcipherlab20261013', allowBackup: false },
    ios: { ...base.ios, bundleIdentifier: 'com.anchorintentions.sqlcipherlab20261013' },
    extra: { ...base.extra, sqlCipherLab: true },
    plugins: [...base.plugins, ['expo-sqlite', { useSQLCipher: true, enableFTS: false }]],
  };
};
