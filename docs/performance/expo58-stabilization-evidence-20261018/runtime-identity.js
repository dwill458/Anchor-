(() => {
  const load = suffix => { const found = [...__r.getModules()].find(([, m]) => (m.verboseName ?? '').endsWith(suffix)); if (!found) throw new Error('Missing module ' + suffix); return __r(found[0]); };
  const fs = load('expo-file-system/build/legacy/FileSystem.js');
  const application = load('expo-application/build/Application.js');
  return { documentDirectory: fs.documentDirectory, applicationId: application.applicationId,
    sqlCipherEnabled: load('src/storage/sqlcipher/persistence.ts').sqlCipherEnabled(), dev: __DEV__ };
})()
