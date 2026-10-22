(() => {
  const qa = globalThis.__anchorStabilizationQA;
  if (!qa) return { status: 'not-seeded' };
  qa.guard();
  const state = qa.load('src/stores/sessionStore.ts').useSessionStore.getState();
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  return { profile: 10, status: qa.status, error: qa.error, failures: qa.failures,
    historyCount: state.practiceHistory.length, threadStrength: state.threadStrength,
    hook: Boolean(hook), renderers: hook?.renderers ? [...hook.renderers.keys()] : [], traces: qa.traces };
})()
