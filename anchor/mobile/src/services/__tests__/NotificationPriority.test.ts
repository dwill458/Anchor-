import { resolvePriority } from '../NotificationPriority';

describe('NotificationPriority', () => {
  it('resolves notification priority in the expected order', () => {
    expect(resolvePriority({
      alchemist: false,
      weaver: false,
      mirror: false,
      microPrime: false,
    })).toBeNull();

    expect(resolvePriority({
      alchemist: false,
      weaver: false,
      mirror: true,
      microPrime: true,
    })).toBe('MIRROR');

    expect(resolvePriority({
      alchemist: true,
      weaver: true,
      mirror: true,
      microPrime: true,
    })).toBe('ALCHEMIST');
  });
});
