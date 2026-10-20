(() => {
  const qa = globalThis.__anchorStabilizationQA; qa.guard(); qa.verifiedCycles ??= 0;
  qa.verifyCycle = () => {
    qa.guard(); qa.verification = { status: 'pending' };
    (async () => {
      const sessions = qa.load('src/stores/sessionStore.ts').useSessionStore;
      const before = sessions.getState().threadStrength;
      const event = sessions.getState().practiceHistory.filter(item => item.accountId === qa.owner).at(-1);
      if (!event) throw new Error('No canonical completion');
      const result = await qa.load('src/services/PracticeCompletionService.ts').PracticeCompletionService.completePracticeSession({
        sessionId: event.id, accountId: qa.owner, anchorId: null, anchorLocalId: qa.anchorId, mode: 'focus',
        plannedDurationSeconds: event.plannedDurationSeconds, actualDurationSeconds: event.completedDurationSeconds,
        startedAt: event.startedAt, completedAt: event.completedAt, source: 'practice_screen', guidanceVoice: 'none', backgroundAudio: 'off',
      }, { mirrorLegacySession: true, flushImmediately: false });
      if (!result.duplicate || before !== sessions.getState().threadStrength) throw new Error('Duplicate reinforcement');
      const db = qa.load('src/storage/sqlcipher/runtime.ts').recordDatabase();
      await db.close();
      const history = await db.read(`anchor:practice-history:${qa.owner}`);
      const snapshot = await db.read(`anchor:session-snapshot:${qa.owner}`);
      const queue = await db.read(`anchor:practice-write-queue:${qa.owner}`);
      const expected = qa.verifiedCycles + 1;
      if (history.length !== expected || new Set(history.map(item => item.id)).size !== expected ||
          snapshot.totalSessionsCount !== expected || snapshot.threadStrength !== before || queue.length !== expected) throw new Error('Native canonical recovery mismatch');
      qa.verifiedCycles = expected;
      qa.verification = { status: 'complete', expected, duplicatePrevented: true, reopened: true,
        threadStrength: before, plannedDurationSeconds: event.plannedDurationSeconds,
        actualDurationSeconds: event.completedDurationSeconds, sinceRouteMs: performance.now() - qa.cycleStarted };
    })().catch(error => { qa.verification = { status: 'failed', message: String(error?.message ?? error) }; });
    return { status: 'scheduled' };
  };
  return { installed: true };
})()
