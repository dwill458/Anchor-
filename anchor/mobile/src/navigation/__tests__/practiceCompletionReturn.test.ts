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
});
