(() => {
  const qa = globalThis.__anchorStabilizationQA; qa.guard();
  if (qa.verifiedCycles !== 41) throw new Error('Complete the 20 focused-route sessions first');
  const service = qa.load('src/services/PracticeCompletionService.ts').PracticeCompletionService;
  const prior = service.completePracticeSession;
  const state = qa.load('src/stores/sessionStore.ts').useSessionStore.getState();
  qa.nativeFailure = { phase: 'waiting-for-lock-window', baseCount: state.practiceHistory.length, beforeStrength: state.threadStrength };
  let connection, releaseTimer;
  const release = async () => {
    if (!connection) return;
    const saved = connection; connection = undefined; clearTimeout(releaseTimer);
    try { await saved.execAsync('ROLLBACK'); } finally { await saved.closeAsync(); }
    qa.nativeFailure.lockReleased = true;
  };
  service.completePracticeSession = function (...args) {
    qa.guard();
    if (qa.nativeFailure.phase !== 'lock-held') return prior.apply(this, args);
    qa.failedFocusInput = args[0];
    qa.nativeFailure.attemptedAt = performance.now();
    return prior.apply(this, args).then(async result => {
      await release(); qa.nativeFailure.phase = 'unexpected-success'; service.completePracticeSession = prior; return result;
    }, async error => {
      qa.nativeFailure.rejectedAfterMs = performance.now() - qa.nativeFailure.attemptedAt;
      qa.nativeFailure.nativeError = (/database is locked|SQLITE_BUSY/i.test(String(error?.message ?? error)) ? 'SQLITE_BUSY' : 'native-operation-failed');
      await release(); qa.nativeFailure.phase = 'rejected-and-unlocked'; service.completePracticeSession = prior; throw error;
    });
  };
  qa.startFocus();
  setTimeout(() => {
    (async () => {
      qa.guard();
      const secure = qa.load('expo-secure-store/build/SecureStore.js');
      const runtime = qa.load('src/storage/sqlcipher/runtime.ts');
      const key = await secure.getItemAsync('anchor.sqlcipher.key.v1');
      if (!key) throw new Error('Synthetic key missing');
      connection = await qa.load('expo-sqlite/build/index.js').openDatabaseAsync(runtime.DATABASE_NAME, { useNewConnection: true });
      await connection.execAsync(qa.load('src/storage/sqlcipher/database.ts').keyPragma(key));
      await connection.execAsync('PRAGMA busy_timeout = 1000; BEGIN IMMEDIATE;');
      qa.nativeFailure.phase = 'lock-held'; qa.nativeFailure.lockedAt = performance.now();
      releaseTimer = setTimeout(() => { void release().then(() => { qa.nativeFailure.phase = 'lock-window-expired'; }); }, 20000);
    })().catch(async error => { qa.nativeFailure.phase = 'setup-failed'; qa.nativeFailure.nativeError = (/database is locked|SQLITE_BUSY/i.test(String(error?.message ?? error)) ? 'SQLITE_BUSY' : 'native-operation-failed'); await release(); });
  }, 25000);
  return { scheduled: true, profile: 10, plannedDurationSeconds: 30, baseCount: qa.nativeFailure.baseCount };
})()
