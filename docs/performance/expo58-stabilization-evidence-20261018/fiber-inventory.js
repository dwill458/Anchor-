(() => {
  const qa = globalThis.__anchorStabilizationQA; qa.guard();
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const matches = [];
  for (const renderer of hook.renderers.keys()) for (const root of hook.getFiberRoots(renderer)) {
    const stack = [root.current];
    while (stack.length) {
      const node = stack.pop(); if (!node) continue;
      if (node.child) stack.push(node.child); if (node.sibling) stack.push(node.sibling);
      const name = typeof node.type === 'function' ? node.type.displayName || node.type.name : node.type?.render?.name || node.type?.type?.name;
      const route = node.memoizedProps?.route?.name;
      if (/V2DevelopmentHome|V2HomeScreen|V2Practice|NavigationContainer/.test(name ?? '') || (route && node.memoizedProps?.navigation)) {
        matches.push({ name, route, navigation: Boolean(node.memoizedProps?.navigation) });
        if (route === 'V2DevelopmentHome' && node.memoizedProps.navigation) qa.navigation = node.memoizedProps.navigation;
      }
    }
  }
  return { status: qa.status, matches, navigationFound: Boolean(qa.navigation) };
})()
