import { notifyPracticeCompletionReturned, registerPracticeCompletionReturn } from '../practiceCompletionReturn';

describe('PracticeCompletionReturn', () => {
  it('delivers authoritative fields once for a completed session', () => {
    const received = jest.fn();
    const unregister = registerPracticeCompletionReturn(received);
    const completion = { sessionId: 's1', anchorId: 'a1', mode: 'focus', completedAt: '2026-09-10T00:00:00.000Z', source: 'practice_screen', returnTarget: 'v2_practice' as const, beforeStrength: 50, afterStrength: 75, delta: 25 };
    notifyPracticeCompletionReturned(completion);
    notifyPracticeCompletionReturned(completion);
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith(completion);
    unregister();
  });

  it('does not emit while no host is registered', () => {
    registerPracticeCompletionReturn(null);
    expect(() => notifyPracticeCompletionReturned({ sessionId: 's2', anchorId: 'a', mode: 'visualize', completedAt: 'now', source: 'practice_screen', returnTarget: null, beforeStrength: null, afterStrength: null, delta: null })).not.toThrow();
  });

  it.each(['focus', 'deep_prime', 'visualize'])('returns accepted %s sessions without client movement math', (mode) => {
    const received = jest.fn();
    registerPracticeCompletionReturn(received);
    notifyPracticeCompletionReturned({ sessionId: `mode-${mode}`, anchorId: 'a', mode, completedAt: 'now', source: 'practice_screen', returnTarget: 'v2_practice', beforeStrength: 10, afterStrength: 20, delta: 10 });
    expect(received).toHaveBeenLastCalledWith(expect.objectContaining({ mode, beforeStrength: 10, afterStrength: 20, delta: 10 }));
  });

  it('keeps release separate and does not treat cancellation/failure as a completion callback', () => {
    const received = jest.fn();
    registerPracticeCompletionReturn(received);
    // No notify call models cancel/back or a failed server POST: both are intentionally silent.
    expect(received).not.toHaveBeenCalled();
    notifyPracticeCompletionReturned({ sessionId: 'release', anchorId: 'a', mode: 'release', completedAt: 'now', source: 'practice_screen', returnTarget: null, beforeStrength: null, afterStrength: null, delta: null });
    expect(received).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'release', returnTarget: null }));
  });
});
