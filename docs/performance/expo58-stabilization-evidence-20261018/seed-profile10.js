(() => {
  const load = suffix => { const found = [...__r.getModules()].find(([, m]) => (m.verboseName ?? '').endsWith(suffix)); if (!found) throw new Error('Missing module ' + suffix); return __r(found[0]); };
  const guard = () => {
    if (!/^file:\/\/\/data\/user\/10\//.test(load('expo-file-system/build/legacy/FileSystem.js').documentDirectory ?? '') ||
        load('expo-application/build/Application.js').applicationId !== 'com.anchorintentions.sqlcipherpreview20261015') throw new Error('Only synthetic QA profile 10 is permitted');
  };
  guard();
  const auth = load('src/stores/authStore.ts').useAuthStore;
  const owner = 'stabilization-synthetic-owner';
  if (auth.getState().user && auth.getState().user.id !== owner) throw new Error('Unexpected account; fixture refused');
  if (globalThis.__anchorStabilizationQA) return { status: 'already-seeded', profile: 10 };
  const qa = globalThis.__anchorStabilizationQA = { status: 'seeding', traces: [], failures: 0, profile: 10, load, guard, owner, anchorId: 'stabilization-synthetic-anchor' };
  (async () => {
    const api = load('src/services/ApiClient.ts').apiClient;
    // Isolate the test transport in this profile's JS context; no synthetic request reaches production.
    for (const method of ['get', 'post', 'patch', 'put', 'delete']) api[method] = () => Promise.reject(new Error('STABILIZATION_SYNTHETIC_OFFLINE'));
    const service = load('src/services/PracticeCompletionService.ts').PracticeCompletionService;
    const complete = service.completePracticeSession;
    service.completePracticeSession = function (...args) {
      guard();
      const id = qa.traces.filter(trace => trace.stage === 'focus-complete' && trace.phase === 'begin').length + 1;
      const started = performance.now();
      qa.traces.push({ stage: 'focus-complete', phase: 'begin', id, t: started });
      return complete.apply(this, args).then(result => {
        qa.traces.push({ stage: 'focus-complete', phase: 'durable', id, t: performance.now(), ms: performance.now() - started, duplicate: result.duplicate });
        return result;
      }, error => {
        qa.failures++;
        qa.traces.push({ stage: 'focus-complete', phase: 'rejected', id, t: performance.now(), ms: performance.now() - started });
        throw error;
      });
    };
    const now = new Date();
    const user = { id: owner, email: 'synthetic@example.invalid', hasCompletedOnboarding: true, subscriptionStatus: 'pro', isComped: true,
      totalAnchorsCreated: 1, totalActivations: 0, currentStreak: 0, longestStreak: 0, stabilizesTotal: 0, stabilizeStreakDays: 0, createdAt: now };
    auth.setState({ user, token: null, isAuthenticated: true, hasCompletedOnboarding: true, isGuest: false,
      isLoading: false, isOfflineMode: true, anchorCount: 1, shouldRedirectToCreation: false });
    const subscription = load('src/stores/subscriptionStore.ts').useSubscriptionStore;
    subscription.getState().setRemoteCompedAccess(true);
    subscription.getState().setEntitlementReady(true);
    const anchors = load('src/stores/anchorStore.ts').useAnchorStore;
    anchors.getState().bindAccount(owner);
    if (!anchors.getState().anchors.some(anchor => anchor.id === qa.anchorId)) anchors.getState().addAnchor({
      id: qa.anchorId, localId: qa.anchorId, userId: owner, intentionText: 'Synthetic stabilization routine', category: 'career',
      distilledLetters: ['S', 'T', 'R'], baseSigilSvg: '<svg viewBox="0 0 100 100"><path d="M20 80L50 20L80 80Z" stroke="white" fill="none"/></svg>',
      structureVariant: 'balanced', isCharged: false, activationCount: 0, threadStrength: 0, createdAt: now, updatedAt: now,
    });
    anchors.getState().setCurrentAnchor(qa.anchorId);
    anchors.setState({ isLoading: false, remoteAnchorState: 'confirmed' });
    await anchors.getState().flushPersistence();
    qa.status = 'ready';
  })().catch(error => { qa.status = 'failed'; qa.error = String(error?.message ?? error); });
  return { status: 'scheduled', profile: 10 };
})()
