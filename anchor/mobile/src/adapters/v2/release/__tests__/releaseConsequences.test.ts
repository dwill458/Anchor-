import {
  buildReleaseConsequenceSnapshot,
  buildReleaseEnding,
  normalizeReleaseReason,
  resolveReleaseReason,
} from '../releaseConsequences';
import type { V2ReleaseLinkedCourse } from '../types';

const anchor = {
  id: 'anchor-1',
  intentionText: 'Finish the first draft',
  category: 'creativity',
  baseSigilSvg: '<svg id="base" />',
  reinforcedSigilSvg: null,
};

const waypointCourse: V2ReleaseLinkedCourse = {
  status: 'ACTIVE', waypointCount: 4, reachedCount: 2, linkKind: 'waypoint', waypointReached: true,
  courseId: 'course-1', nextWaypointTitle: 'Send to editor', revision: 3,
};
const destinationCourse: V2ReleaseLinkedCourse = {
  status: 'COMPLETED', waypointCount: 4, reachedCount: 4, linkKind: 'destination', courseCompleted: true,
  courseId: 'course-1', revision: 7,
};
const ids = (snap: { consequences: Array<{ id: string }> }) => snap.consequences.map((c) => c.id);

describe('buildReleaseConsequenceSnapshot', () => {
  it('a plain release is Anchor then History: honest, non-destructive, never "complete"', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor });

    expect(ids(snap)).toEqual(['anchor', 'history']);
    expect(snap.reason).toBe('no_longer_aligned');
    const anchorRow = snap.consequences.find((c) => c.id === 'anchor');
    expect(anchorRow?.detail).toBe('Moves out of active use');
    expect(anchorRow?.tone).toBe('preserved');
    expect(snap.consequences.find((c) => c.id === 'history')?.detail).toBe('Practice and Thread history remain in Progress');
    expect(JSON.stringify(snap.consequences)).not.toMatch(/complete/i);
    expect(snap.intentionText).toBe('Finish the first draft');
    expect(snap.artworkSvg).toBe('<svg id="base" />');
  });

  it('adds a Chart row only when a Course is linked, and phrases waypoint retention honestly', () => {
    const snap = buildReleaseConsequenceSnapshot({
      anchor,
      linkedCourse: { status: 'ACTIVE', waypointCount: 4, reachedCount: 2, linkKind: 'waypoint', courseId: 'c' },
    });

    const courseRow = snap.consequences.find((c) => c.id === 'course');
    expect(courseRow).toBeDefined();
    expect(courseRow?.detail).toMatch(/2 of 4 waypoints reached/);
    expect(snap.hasLinkedCourse).toBe(true);
  });

  it('does not fabricate a Vision, Chart or Successor that is not linked', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, hasLinkedVision: false });
    expect(ids(snap)).not.toContain('vision');
    expect(ids(snap)).not.toContain('course');
    expect(ids(snap)).not.toContain('successor');
    expect(snap.hasLinkedVision).toBe(false);
    const evolve = buildReleaseConsequenceSnapshot({ anchor, reason: 'evolve' });
    expect(ids(evolve)).not.toContain('successor');
    expect(evolve.successor).toBeNull();
  });

  it('adds a Vision row when a Vision is linked', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, hasLinkedVision: true });
    expect(ids(snap)).toEqual(['anchor', 'vision', 'history']);
  });

  it('waypoint: the reached waypoint stays and the next one is named', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, linkedCourse: waypointCourse, reason: 'waypoint_completed' });
    expect(snap.reason).toBe('waypoint_completed');
    expect(snap.nextWaypointTitle).toBe('Send to editor');
    expect(snap.consequences.find((c) => c.id === 'course')?.detail).toBe('The reached waypoint stays. Next: Send to editor');
  });

  it('destination: the completed course moves to history', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, linkedCourse: destinationCourse, reason: 'destination_completed', hasLinkedVision: true });
    expect(snap.reason).toBe('destination_completed');
    expect(snap.consequences.find((c) => c.id === 'course')?.detail).toBe('Completed course moves to history');
    expect(ids(snap)).toEqual(['anchor', 'course', 'vision', 'history']);
  });

  it('evolve: the Anchor moves into history and the successor is shown', () => {
    const snap = buildReleaseConsequenceSnapshot({ anchor, reason: 'evolve', successor: { anchorId: 'anchor-2', intentionText: 'Ship the second draft' } });
    expect(snap.consequences.find((c) => c.id === 'anchor')?.detail).toBe('This Anchor moves into history');
    expect(snap.consequences.find((c) => c.id === 'successor')?.detail).toContain('Ship the second draft');
    expect(snap.consequences.find((c) => c.id === 'successor')?.detail).toContain('Linked to your previous intention.');
  });

  it('prefers reinforced artwork when present', () => {
    const snap = buildReleaseConsequenceSnapshot({
      anchor: { ...anchor, reinforcedSigilSvg: '<svg id="reinforced" />' },
    });
    expect(snap.artworkSvg).toBe('<svg id="reinforced" />');
  });

  it('the revision changes when a relationship does, so a hold started earlier is stale', () => {
    const before = buildReleaseConsequenceSnapshot({ anchor, linkedCourse: waypointCourse });
    const after = buildReleaseConsequenceSnapshot({ anchor, linkedCourse: { ...waypointCourse, revision: 4 } });
    const withVision = buildReleaseConsequenceSnapshot({ anchor, linkedCourse: waypointCourse, hasLinkedVision: true });
    expect(after.revision).not.toBe(before.revision);
    expect(withVision.revision).not.toBe(before.revision);
  });
});

describe('resolveReleaseReason (never infers completion on the client)', () => {
  it('only the five locked reasons survive normalization; anything else is manual', () => {
    expect(normalizeReleaseReason('evolve')).toBe('evolve');
    expect(normalizeReleaseReason('practice_prepare')).toBeUndefined();
    expect(normalizeReleaseReason(undefined)).toBeUndefined();
    expect(resolveReleaseReason(undefined, null)).toBe('no_longer_aligned');
  });

  it('waypoint completion needs a server-reached linked waypoint', () => {
    expect(resolveReleaseReason('waypoint_completed', waypointCourse)).toBe('waypoint_completed');
    expect(resolveReleaseReason('waypoint_completed', { ...waypointCourse, waypointReached: false })).toBe('no_longer_aligned');
    expect(resolveReleaseReason('waypoint_completed', destinationCourse)).toBe('no_longer_aligned');
    expect(resolveReleaseReason('waypoint_completed', null)).toBe('no_longer_aligned');
  });

  it('destination completion needs a server-completed course', () => {
    expect(resolveReleaseReason('destination_completed', destinationCourse)).toBe('destination_completed');
    expect(resolveReleaseReason('destination_completed', { ...destinationCourse, courseCompleted: false })).toBe('no_longer_aligned');
    expect(resolveReleaseReason('destination_completed', null)).toBe('no_longer_aligned');
  });

  it('a standalone completion is only standalone when no Course is linked', () => {
    expect(resolveReleaseReason('outcome_completed', null)).toBe('outcome_completed');
    expect(resolveReleaseReason('outcome_completed', waypointCourse)).toBe('no_longer_aligned');
  });
});

describe('buildReleaseEnding (locked copy)', () => {
  const intentionText = 'Finish the first draft';
  const build = (reason: Parameters<typeof buildReleaseEnding>[0]['reason'], successor?: { anchorId: string; intentionText: string }) =>
    buildReleaseEnding({ reason, intentionText, successor });

  it.each([
    ['outcome_completed', 'Released', 'This intention has moved into your history.', 'Return Home', 'View Progress'],
    ['no_longer_aligned', 'Released', 'This intention has moved into your history.', 'Return Home', 'View Progress'],
    ['waypoint_completed', 'Waypoint complete', 'Your Anchor has been released. Your course continues.', 'Continue to Chart', undefined],
    ['destination_completed', 'Destination complete', 'The course is complete. Your history remains in Progress.', 'View completed Chart', 'Return Home'],
  ] as const)('%s', (reason, eyebrow, body, primary, secondary) => {
    const ending = build(reason);
    expect(ending.eyebrow).toBe(eyebrow);
    expect(ending.body).toBe(body);
    expect(ending.primary.label).toBe(primary);
    expect(ending.secondary?.label).toBe(secondary);
  });

  it('evolve shows the successor and the link note', () => {
    const ending = build('evolve', { anchorId: 'a2', intentionText: 'Ship the second draft' });
    expect(ending.eyebrow).toBe('Evolved');
    expect(ending.body).toBe('This intention has moved into history.');
    expect(ending.primary.label).toBe('Continue with new Anchor');
    expect(ending.secondary).toBeNull();
    expect(ending.successor).toEqual({ intentionText: 'Ship the second draft', note: 'Linked to your previous intention.' });
  });

  it('evolve without a successor degrades to the manual ending', () => {
    expect(build('evolve').eyebrow).toBe('Released');
  });

  it('a manual release never claims achievement', () => {
    const manual = build('no_longer_aligned');
    expect(`${manual.eyebrow} ${manual.title} ${manual.body}`).not.toMatch(/complete|achiev|congrat/i);
  });
});
