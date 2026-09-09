import { buildReleaseConsequenceSnapshot } from '../releaseConsequences';

const anchor = {
  id: 'anchor-1',
  intentionText: 'Finish the first draft',
  category: 'creativity',
  baseSigilSvg: '<svg id="base" />',
  reinforcedSigilSvg: null,
};

describe('buildReleaseConsequenceSnapshot', () => {
  it('always states the honorable, non-destructive outcome', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor });

    const ids = snap.consequences.map((c) => c.id);
    expect(ids).toEqual(['intention', 'anchor', 'reminders', 'history']);

    const anchorRow = snap.consequences.find((c) => c.id === 'anchor');
    expect(anchorRow?.detail).toMatch(/history/i);
    expect(anchorRow?.tone).toBe('preserved');

    const remindersRow = snap.consequences.find((c) => c.id === 'reminders');
    expect(remindersRow?.tone).toBe('ceases');

    expect(snap.intentionText).toBe('Finish the first draft');
    expect(snap.artworkSvg).toBe('<svg id="base" />');
  });

  it('adds a Course row only when a Course is linked, and phrases waypoint retention honestly', () => {
    const snap = buildReleaseConsequenceSnapshot({
      anchor,
      linkedCourse: { status: 'ACTIVE', waypointCount: 4, reachedCount: 2 },
    });

    const courseRow = snap.consequences.find((c) => c.id === 'course');
    expect(courseRow).toBeDefined();
    expect(courseRow?.detail).toMatch(/2 of 4 waypoints reached/);
    expect(snap.hasLinkedCourse).toBe(true);
  });

  it('does not fabricate a Vision or Course that is not linked', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, hasLinkedVision: false });
    expect(snap.consequences.some((c) => c.id === 'vision')).toBe(false);
    expect(snap.consequences.some((c) => c.id === 'course')).toBe(false);
    expect(snap.hasLinkedVision).toBe(false);
  });

  it('adds a Vision row when a Vision is linked', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, hasLinkedVision: true });
    expect(snap.consequences.some((c) => c.id === 'vision')).toBe(true);
  });

  it('prefers reinforced artwork when present', () => {
    const snap = buildReleaseConsequenceSnapshot({
      anchor: { ...anchor, reinforcedSigilSvg: '<svg id="reinforced" />' },
    });
    expect(snap.artworkSvg).toBe('<svg id="reinforced" />');
  });
});
