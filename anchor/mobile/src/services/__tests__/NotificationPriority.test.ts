import { isSovereign, resolvePriority } from '../NotificationPriority';

describe('NotificationPriority', () => {
  it('marks sovereign rank at 50 all-time primes or 3 alchemist milestones', () => {
    expect(isSovereign(49, 2)).toBe(false);
    expect(isSovereign(50, 0)).toBe(true);
    expect(isSovereign(12, 3)).toBe(true);
  });

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
