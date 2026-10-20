(() => { const qa = globalThis.__anchorStabilizationQA; qa.guard(); clearInterval(qa.jsTimer); return { ...qa.jsTiming, endedAt: performance.now() }; })()
