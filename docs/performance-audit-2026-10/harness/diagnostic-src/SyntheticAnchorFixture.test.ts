import { makePersistedFixture, validateCanonicalSynthetic72 } from './SyntheticAnchorFixture';

describe('canonical synthetic 72 fixture', () => {
  it('matches the calibrated full payload and accepts unchanged Account A records', () => {
    const fixture = makePersistedFixture(72);
    expect(fixture.payloadChars).toBe(719_217);
    const result = validateCanonicalSynthetic72(fixture.value);
    expect(result).toMatchObject({ ok: true, anchorCount: 72, selectedSynthetic: true, currentAnchorId: 'synthetic-anchor-001' });
  });

  it('allows only validated runtime prime/sync counters and selection to vary', () => {
    const fixture = JSON.parse(makePersistedFixture(72).value);
    fixture.state.primeStreak = 2;
    fixture.state.lastPrimedDate = '2026-10-12';
    fixture.state.lastSyncedAt = '2026-10-12T18:00:00.000Z';
    fixture.state.currentAnchorId = 'synthetic-anchor-022';
    expect(validateCanonicalSynthetic72(JSON.stringify(fixture))).toMatchObject({
      ok: true,
      selectedSynthetic: true,
      currentAnchorId: 'synthetic-anchor-022',
      primeState: { primeStreak: 2, lastPrimedDate: '2026-10-12' },
    });
  });

  it.each([
    ['owner changed', (fixture: any) => { fixture.state.anchors[0].userId = 'synthetic-account-c'; }],
    ['intention changed', (fixture: any) => { fixture.state.anchors[0].intentionText += ' altered'; }],
    ['SVG changed', (fixture: any) => { fixture.state.anchors[0].baseSigilSvg += 'x'; }],
    ['record field added', (fixture: any) => { fixture.state.anchors[0].profilePictureUrl = 'private'; }],
    ['records reordered', (fixture: any) => { [fixture.state.anchors[0], fixture.state.anchors[1]] = [fixture.state.anchors[1], fixture.state.anchors[0]]; }],
    ['unknown state field added', (fixture: any) => { fixture.state.ownerImage = 'private'; }],
    ['unrelated selection', (fixture: any) => { fixture.state.currentAnchorId = 'owner-anchor'; }],
  ])('refuses %s before any fixture consumer can write', (_label, mutate) => {
    const fixture = JSON.parse(makePersistedFixture(72).value);
    mutate(fixture);
    expect(validateCanonicalSynthetic72(JSON.stringify(fixture)).ok).toBe(false);
  });
});
