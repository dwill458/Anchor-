import { SYSTEM_HANDOFF, SYSTEM_HANDOFF_REDUCED, systemPieceWindows } from '../systemHandoff';

describe.each([
  ['full motion', SYSTEM_HANDOFF],
  ['Reduce Motion', SYSTEM_HANDOFF_REDUCED],
] as const)('Screen 4 → 5 handoff timeline (%s)', (_name, t) => {
  it('never shows a blank or doubled frame', () => {
    // Screen 5's cream covers Screen 4 only after Screen 4's copy has fully cleared…
    expect(t.s5Backdrop[0]).toBeGreaterThanOrEqual(t.s4UiOut[1]);
    // …and Screen 4 is released only once that cream is opaque.
    expect(t.commitStep).toBeGreaterThan(t.s5Backdrop[1]);
  });

  it('overlaps each beat with the last rather than waiting for it to finish', () => {
    expect(t.pill[0]).toBeLessThan(t.heroFlight[1]);
    expect(t.headline[0]).toBeLessThan(t.pill[1]);
    expect(t.support[0]).toBeLessThan(t.headline[1]);
    const pieces = [0, 1, 2].map((index) => systemPieceWindows(t, index));
    expect(pieces[0].art[0]).toBeLessThan(t.support[1] + 200);
    for (let i = 1; i < pieces.length; i++) {
      // SEE → REINFORCE → MOVE, in order, each starting before the last has settled.
      expect(pieces[i].art[0]).toBeGreaterThan(pieces[i - 1].art[0]);
      expect(pieces[i].art[0]).toBeLessThan(pieces[i - 1].art[1]);
    }
    // Labels follow their own art.
    for (const piece of pieces) expect(piece.label[0]).toBeGreaterThan(piece.art[0]);
  });

  it('finishes when the last piece does', () => {
    const move = systemPieceWindows(t, 2);
    expect(t.end).toBeGreaterThanOrEqual(move.art[1]);
    expect(t.end).toBeGreaterThanOrEqual(move.label[1]);
    expect(t.end).toBeGreaterThanOrEqual(t.cta[1]);
    expect(t.directFrom).toBeLessThan(t.pill[0]);
  });
});
