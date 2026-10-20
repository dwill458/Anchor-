(() => {
  const modules = [...__r.getModules()];
  const fsEntry = modules.find(([, module]) => (module.verboseName ?? '').endsWith('expo-file-system/build/legacy/FileSystem.js'));
  if (!fsEntry || !/^file:\/\/\/data\/user\/10\//.test(__r(fsEntry[0]).documentDirectory ?? '')) throw new Error('QA profile 10 required');
  globalThis.__anchorStabilizationResult = { status: 'pending' };
  (async () => {
  const load = suffix => { const found = [...__r.getModules()].find(([, m]) => (m.verboseName ?? '').endsWith(suffix)); if (!found) throw new Error('Missing module ' + suffix); return __r(found[0]); };
  const fs = load('expo-file-system/build/legacy/FileSystem.js');
  if (!/^file:\/\/\/data\/user\/10\//.test(fs.documentDirectory ?? '') || load('expo-application/build/Application.js').applicationId !== 'com.anchorintentions.sqlcipherpreview20261015') throw new Error('Isolated QA profile 10 required');
  if (!load('src/storage/sqlcipher/persistence.ts').sqlCipherEnabled()) throw new Error('SQLCipher adapter required');
  const runtime = load('src/storage/sqlcipher/runtime.ts');
  const db = runtime.recordDatabase();
  const value = { synthetic: true, sequence: Date.now() };
  const started = performance.now();
  await db.write('stabilization:probe', value);
  const committed = performance.now();
  await db.close();
  const restored = await db.read('stabilization:probe');
  const reopened = performance.now();
  if (restored.sequence !== value.sequence) throw new Error('Native durable restoration failed');
  // Only this disposable profile's key is read in-process; no key is returned or exported.
  const key = await load('expo-secure-store/build/SecureStore.js').getItemAsync('anchor.sqlcipher.key.v1');
  if (!key) throw new Error('Synthetic key missing');
  const connection = await load('expo-sqlite/build/index.js').openDatabaseAsync(runtime.DATABASE_NAME, { useNewConnection: true });
  let version;
  try {
    await connection.execAsync(load('src/storage/sqlcipher/database.ts').keyPragma(key));
    const row = await connection.getFirstAsync('PRAGMA cipher_version');
    version = Object.values(row ?? {})[0];
  } finally { await connection.closeAsync(); }
  return { profile: 10, sqlCipherEnabled: true, cipherVersion: version, verified: true,
    durableWriteMs: committed - started, closeReopenReadMs: reopened - committed, dev: __DEV__ };
  })().then(value => { globalThis.__anchorStabilizationResult = { status: 'complete', ...value }; }, error => {
    globalThis.__anchorStabilizationResult = { status: 'failed', message: String(error?.message ?? error) };
  });
  return { status: 'scheduled', profile: 10 };
})()
