import { MILESTONE_SPECS } from '../registry';
import { MILESTONE_SOUND_TIER, milestoneSoundKey } from '../milestoneSounds';

describe('milestone tier sounds', () => {
  it('maps every registry milestone to exactly one tier', () => {
    const ids = MILESTONE_SPECS.map(spec => spec.id).sort();
    expect(Object.keys(MILESTONE_SOUND_TIER).sort()).toEqual(ids);
    expect(ids).toHaveLength(20);
  });

  it('matches the locked tier table', () => {
    const count = (tier: number) => Object.values(MILESTONE_SOUND_TIER).filter(t => t === tier).length;
    expect([count(1), count(2), count(3)]).toEqual([4, 8, 8]);
    expect(MILESTONE_SOUND_TIER['journey.goal']).toBe(3);
    expect(MILESTONE_SOUND_TIER['vision.first']).toBe(1);
    expect(MILESTONE_SOUND_TIER['vision.visualize.1']).toBe(2);
  });

  it('resolves each tier to its sound asset key', () => {
    expect(milestoneSoundKey('strength.building')).toBe('milestoneT1Quiet');
    expect(milestoneSoundKey('commitment.minutes.100')).toBe('milestoneT2Established');
    expect(milestoneSoundKey('strength.full')).toBe('milestoneT3Major');
    expect(milestoneSoundKey('unknown.id')).toBeUndefined();
  });
});
