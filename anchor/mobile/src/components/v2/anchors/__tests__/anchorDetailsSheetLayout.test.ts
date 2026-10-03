import {
  nearestSnap,
  nextSnapForTap,
  resolveRestAnchorRect,
  resolveSheetLayout,
  resolveSheetSnaps,
} from '../anchorDetailsSheetLayout';

const W = 390;
const H = 844;
const INSET = 44;
const snaps = resolveSheetSnaps(H, INSET);
const at = (y: number) => resolveSheetLayout({ y, snaps, width: W, height: H, topInset: INSET });

describe('sheet snaps', () => {
  it('matches the prototype at 390 x 844', () => {
    expect(snaps).toEqual({ rest: 566, half: 392, full: 212 });
  });

  it('never lets full rise above the status bar plus 168', () => {
    const tall = resolveSheetSnaps(700, 60);
    expect(tall.full).toBeGreaterThanOrEqual(60 + 168);
    expect(tall.full).toBeLessThan(tall.half);
    expect(tall.half).toBeLessThan(tall.rest);
  });
});

describe('sheet layout', () => {
  it('rests with a 300dp Anchor centred above the sheet', () => {
    const l = at(snaps.rest);
    expect(l.anchorSize).toBeCloseTo(300, 5);
    expect(l.anchorCenterX).toBeCloseTo(195, 5);
    expect(l.anchorTop).toBeCloseTo(86, 5);
    expect(l.centeredOpacity).toBe(1);
    expect(l.headerOpacity).toBe(0);
    expect(l.practiceHeight).toBeCloseTo(106, 5);
    expect(l.barOpacity).toBe(0);
  });

  it('is continuous across the half snap', () => {
    const below = at(snaps.half + 0.01);
    const above = at(snaps.half - 0.01);
    expect(Math.abs(below.anchorSize - above.anchorSize)).toBeLessThan(0.05);
    expect(Math.abs(below.anchorCenterX - above.anchorCenterX)).toBeLessThan(0.05);
    expect(Math.abs(below.anchorTop - above.anchorTop)).toBeLessThan(0.05);
  });

  it('reaches the 84dp Anchor at the left at full, with the header block in and the card collapsed', () => {
    const l = at(snaps.full);
    expect(l.anchorSize).toBeCloseTo(84, 5);
    expect(l.anchorCenterX).toBeCloseTo(62, 5);
    expect(l.anchorTop).toBeCloseTo(104 - 44 + INSET, 5);
    expect(l.centeredOpacity).toBe(0);
    expect(l.headerOpacity).toBe(1);
    expect(l.practiceHeight).toBe(0);
    expect(l.practiceOpacity).toBe(0);
    expect(l.barOpacity).toBe(1);
    expect(l.haloOpacity).toBe(0);
    // Header sits to the right of the Anchor, 16dp clear of it.
    expect(l.headerLeft).toBeCloseTo(62 + 42 + 16, 5);
  });

  it('crossfades the title blocks without both being fully visible', () => {
    for (let y = snaps.full; y <= snaps.rest; y += 4) {
      const l = at(y);
      expect(l.centeredOpacity + l.headerOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the halo at full strength from half up and shrinks the Anchor monotonically', () => {
    let previous = at(snaps.full).anchorSize;
    for (let y = snaps.full; y <= snaps.rest; y += 4) {
      const l = at(y);
      expect(l.anchorSize).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = l.anchorSize;
      if (y >= snaps.half) expect(l.haloOpacity).toBe(1);
    }
  });

  it('scales with width and the smaller of the two scales', () => {
    const narrow = resolveSheetLayout({ y: 566, snaps, width: 360, height: H, topInset: INSET });
    expect(narrow.anchorSize).toBeCloseTo(300 * (360 / 390), 5);
    const shortSnaps = resolveSheetSnaps(700, INSET);
    const short = resolveSheetLayout({ y: shortSnaps.rest, snaps: shortSnaps, width: W, height: 700, topInset: INSET });
    expect(short.anchorSize).toBeCloseTo(300 * (700 / 844), 5);
  });
});

describe('release and tap behaviour', () => {
  it('snaps to the nearest of the three, projecting 160ms of velocity', () => {
    expect(nearestSnap(500, 0, snaps)).toBe(snaps.rest);
    expect(nearestSnap(450, -600, snaps)).toBe(snaps.half); // flung up: 450 - 96 = 354 -> half
    expect(nearestSnap(300, -2000, snaps)).toBe(snaps.full);
    expect(nearestSnap(300, 2000, snaps)).toBe(snaps.rest);
  });

  it('cycles rest -> half -> full -> rest on tap', () => {
    expect(nextSnapForTap(snaps.rest, snaps)).toBe(snaps.half);
    expect(nextSnapForTap(snaps.half, snaps)).toBe(snaps.full);
    expect(nextSnapForTap(snaps.full, snaps)).toBe(snaps.rest);
  });
});

describe('rest Anchor rect', () => {
  it('is the rect Home flies the Anchor to', () => {
    const rect = resolveRestAnchorRect({ width: W, height: H, topInset: INSET });
    expect(rect.width).toBeCloseTo(300, 5);
    expect(rect.x).toBeCloseTo(45, 5);
    expect(rect.y).toBeCloseTo(86, 5);
    // The Anchor clears the resting sheet with room for the title block.
    expect(rect.y + rect.height).toBeLessThan(snaps.rest - 100);
  });
});
