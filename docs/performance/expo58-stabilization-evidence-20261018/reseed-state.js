(() => {const qa=globalThis.__anchorStabilizationQA;qa.guard();return {status:qa.status,historyCount:qa.load('src/stores/sessionStore.ts').useSessionStore.getState().practiceHistory.length};})()
