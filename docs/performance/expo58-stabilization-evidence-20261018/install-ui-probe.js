(() => {
  const qa = globalThis.__anchorStabilizationQA; qa.guard();
  function visit(callback) {
    const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    for (const renderer of hook.renderers.keys()) for (const root of hook.getFiberRoots(renderer)) {
      const stack = [root.current];
      while (stack.length) {
        const node = stack.pop(); if (!node) continue;
        if (node.child) stack.push(node.child); if (node.sibling) stack.push(node.sibling);
        callback(node);
      }
    }
  }
  qa.startFocus = () => {
    qa.guard();
    let navigation;
    visit(node => { if (node.memoizedProps?.route?.name === 'V2DevelopmentHome' && node.memoizedProps.navigation) navigation = node.memoizedProps.navigation; });
    if (!navigation) throw new Error('Home navigation is not mounted');
    const settings = qa.load('src/stores/settingsStore.ts').useSettingsStore;
    settings.setState({ soundEnabled: false, hapticIntensity: 0, sessionAudioDefaults: {
      ...settings.getState().sessionAudioDefaults, focus: { guidanceVoice: 'none', backgroundAudio: 'off' },
    } });
    qa.cycleStarted = performance.now();
    navigation.push('V2Practice', { anchorId: qa.anchorId, resumeMode: 'focus', resumeDuration: 30,
      resumeSource: 'practice_hub', returnRoute: 'V2DevelopmentHome' });
    return { started: true, plannedDurationSeconds: 30 };
  };
  qa.measureButton = wanted => {
    qa.guard();
    qa.button = { status: 'not-found', wanted };
    let instance;
    visit(node => {
      if (node.memoizedProps?.testID !== wanted) return;
      const candidate = node.stateNode?.canonical?.publicInstance ?? node.stateNode?.publicInstance ?? node.stateNode;
      if (typeof candidate?.measureInWindow === 'function') instance = candidate;
    });
    if (!instance) return qa.button;
    qa.button.status = 'pending';
    const density = qa.load('/react-native/index.js').PixelRatio.get();
    instance.measureInWindow((x, y, width, height) => {
      qa.button = { status: width > 0 && height > 0 ? 'ready' : 'empty', wanted, x, y, width, height,
        tapX: Math.round((x + width / 2) * density), tapY: Math.round((y + height / 2) * density) };
    });
    return { status: 'pending', wanted };
  };
  qa.screenState = () => {
    qa.guard();
    let active = false, complete = false;
    visit(node => {
      const name = typeof node.type === 'function' ? node.type.name : node.type?.type?.name;
      if (name === 'V2FocusActiveScreen') active = true;
      if (name === 'V2FocusCompleteScreen') complete = true;
    });
    const state = qa.load('src/stores/sessionStore.ts').useSessionStore.getState();
    return { active, complete, historyCount: state.practiceHistory.filter(event => event.accountId === qa.owner).length,
      threadStrength: state.threadStrength, failures: qa.failures, button: qa.button,
      sinceRouteMs: performance.now() - qa.cycleStarted };
  };
  return { installed: true, profile: 10 };
})()
