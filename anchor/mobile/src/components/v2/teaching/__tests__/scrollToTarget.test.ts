import { scrollToTarget, waitForScrollSettle } from '../scrollToTarget';
const target = (y: number) => ({ current: { measureInWindow: (done: Function) => done(20, y, 300, 60) } }) as never;
it('scrolls to 150px below the viewport top, clamped to the scroll bounds, and measures after settling', async () => {
  const scrollTo = jest.fn();
  await scrollToTarget(target(700), { current: { scrollTo } }, () => ({ y: 20, max: 400, viewportTop: 50 }), true);
  expect(scrollTo).toHaveBeenCalledWith({ y: 400, animated: false });
  await scrollToTarget(target(20), { current: { scrollTo } }, () => ({ y: 300, max: 900, viewportTop: 0 }), true);
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 170, animated: false });
});
it('silently skips a target that cannot be measured', async () => {
  const scrollTo = jest.fn();
  expect(await scrollToTarget({ current: null }, { current: { scrollTo } }, () => ({ y: 0, max: 900, viewportTop: 0 }), false)).toBeNull();
  expect(scrollTo).not.toHaveBeenCalled();
});
it('waitForScrollSettle resolves after 4 consecutive stable frames', async () => {
  const originalRaf = global.requestAnimationFrame;
  const callbacks: FrameRequestCallback[] = [];
  global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  }) as typeof requestAnimationFrame;
  try {
    const scrollY = { value: 0 };
    let resolved = false;
    const promise = waitForScrollSettle(scrollY).then(() => { resolved = true; });
    const stepFrame = (nextY: number) => {
      scrollY.value = nextY;
      const cb = callbacks.shift();
      cb?.(0);
    };
    stepFrame(100);
    stepFrame(180);
    expect(resolved).toBe(false);
    stepFrame(180.2);
    stepFrame(180.3);
    stepFrame(180.4);
    await Promise.resolve();
    expect(resolved).toBe(false);
    stepFrame(180.4);
    await promise;
    expect(resolved).toBe(true);
  } finally {
    global.requestAnimationFrame = originalRaf;
  }
});
it('waitForScrollSettle resolves after the 2 s cap even if scroll keeps moving', async () => {
  jest.useFakeTimers();
  const originalRaf = global.requestAnimationFrame;
  global.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
  try {
    const scrollY = { value: 0 };
    let resolved = false;
    const promise = waitForScrollSettle(scrollY).then(() => { resolved = true; });
    jest.advanceTimersByTime(1999);
    await Promise.resolve();
    expect(resolved).toBe(false);
    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  } finally {
    global.requestAnimationFrame = originalRaf;
    jest.useRealTimers();
  }
});
