(() => ({ dev: __DEV__, modules: Array.from(globalThis.__r.getModules()).filter(([, module]) =>
  /(?:expo-file-system.*legacy.*FileSystem\.js|expo-application.*Application\.js|storage\/sqlcipher\/(?:persistence|runtime)\.ts|stores\/(?:authStore|anchorStore|sessionStore|subscriptionStore)\.ts|services\/ApiClient\.ts|services\/PracticeCompletionService\.ts)$/.test(module.verboseName ?? '')
).map(([id, module]) => ({ id, path: module.verboseName })) }))()
