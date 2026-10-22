type ScheduledInteractionTask = { cancel: () => void };

/**
 * RN 0.88 removes InteractionManager. Defer past the initial transition frames
 * and settle interval, then wait for a genuine JS idle callback. Do not put a
 * timeout on idle work: long choreography must not be preempted by a deadline.
 */
export function scheduleAfterInteractions(task: () => void): ScheduledInteractionTask {
  let cancelled = false;
  let firstFrame: number | undefined;
  let secondFrame: number | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let idleCallback: number | undefined;

  const scheduleIdleWork = () => {
    if (cancelled) return;
    if (typeof requestIdleCallback === 'function') {
      idleCallback = requestIdleCallback(() => {
        idleCallback = undefined;
        if (!cancelled) task();
      });
    } else {
      settleTimer = setTimeout(() => {
        settleTimer = undefined;
        if (!cancelled) task();
      }, 0);
    }
  };

  firstFrame = requestAnimationFrame(() => {
    firstFrame = undefined;
    secondFrame = requestAnimationFrame(() => {
      secondFrame = undefined;
      settleTimer = setTimeout(scheduleIdleWork, 400);
    });
  });

  return {
    cancel() {
      cancelled = true;
      if (firstFrame !== undefined) cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      if (idleCallback !== undefined && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleCallback);
      }
    },
  };
}
