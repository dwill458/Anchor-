(() => {
  const qa = globalThis.__anchorStabilizationQA; qa.guard();
  if (qa.jsTimer) clearInterval(qa.jsTimer);
  const timing = qa.jsTiming = { intervalMs: 16, samples: 0, sumGapMs: 0, maxGapMs: 0, over50Ms: 0, over100Ms: 0, startedAt: performance.now() };
  let previous = performance.now();
  qa.jsTimer = setInterval(() => {
    const now = performance.now(), gap = now - previous; previous = now;
    timing.samples++; timing.sumGapMs += gap; timing.maxGapMs = Math.max(timing.maxGapMs, gap);
    if (gap > 50) timing.over50Ms++; if (gap > 100) timing.over100Ms++;
  }, 16);
  return { started: true, profile: 10 };
})()
