import {
  LANDSCAPE_FOCAL_Y, PORTRAIT_FOCAL_Y, defaultVisionFocal, panVisionFocal, parseVisionFocal, resolveVisionFocal, visionCoverFrame, visionFocalChanged,
} from '../visionPhotoFocus';

/** The Vision board's polaroid window: 0.88 x 0.72 of a print that is 1.18 wide for each unit of height. */
const WINDOW = { width: 100, height: 100 / 1.0185 };

describe('visionCoverFrame', () => {
  it.each([
    ['a selfie (portrait)', 3 / 4],
    ['a full-body portrait', 2 / 3],
    ['a group shot (landscape)', 4 / 3],
    ['a landscape with no people', 16 / 9],
    ['a panorama', 3],
    ['a square photograph', 1],
  ])('covers the window at the photograph\'s own proportions for %s, with no blank edge at any focal', (_name, aspect) => {
    for (const fx of [0, 0.25, 0.5, 1]) for (const fy of [0, 0.3, 0.5, 1]) {
      const frame = visionCoverFrame(aspect, WINDOW.width, WINDOW.height, { x: fx, y: fy });
      expect(frame.width / frame.height).toBeCloseTo(aspect, 5); // never stretched
      expect(frame.left).toBeLessThanOrEqual(1e-9); expect(frame.top).toBeLessThanOrEqual(1e-9);
      expect(frame.left + frame.width).toBeGreaterThanOrEqual(WINDOW.width - 1e-9); // right and bottom edges stay covered
      expect(frame.top + frame.height).toBeGreaterThanOrEqual(WINDOW.height - 1e-9);
      // Never larger than cover: one axis fits the window exactly.
      expect(Math.min(frame.width - WINDOW.width, frame.height - WINDOW.height)).toBeCloseTo(0, 5);
    }
  });
  it('is the window itself until the photograph has loaded', () => {
    expect(visionCoverFrame(0, 100, 80, { x: 0.5, y: 0.5 })).toMatchObject({ width: 100, height: 80, left: 0, top: 0 });
  });
});

describe('defaultVisionFocal', () => {
  it('shows a tall portrait from near the top so the head is kept', () => {
    const selfie = defaultVisionFocal(3 / 4, WINDOW.width / WINDOW.height);
    const full = defaultVisionFocal(1 / 2, WINDOW.width / WINDOW.height);
    expect(selfie.y).toBeLessThan(0.3); expect(full.y).toBeCloseTo(PORTRAIT_FOCAL_Y, 6);
    expect(selfie.x).toBe(0.5);
  });
  it('keeps the head inside the window for portraits: at most 4.5% of the photograph is cropped from the top', () => {
    for (const aspect of [3 / 4, 2 / 3, 1 / 2, 9 / 16]) {
      const focal = defaultVisionFocal(aspect, WINDOW.width / WINDOW.height);
      const frame = visionCoverFrame(aspect, WINDOW.width, WINDOW.height, focal);
      const topVisible = -frame.top / frame.height;             // share of the photograph cut off above the window
      expect(topVisible).toBeLessThanOrEqual(0.045);               // at most a sliver of headroom is lost
    }
  });
  it('is gentler for landscapes, and centred horizontally for everything', () => {
    expect(defaultVisionFocal(16 / 9, WINDOW.width / WINDOW.height).y).toBe(LANDSCAPE_FOCAL_Y);
    expect(defaultVisionFocal(16 / 9, WINDOW.width / WINDOW.height).x).toBe(0.5);
  });
  it('lets face or subject metadata win when a source has it', () => {
    expect(defaultVisionFocal(3 / 4, 1, { x: 0.3, y: 0.1 })).toEqual({ x: 0.3, y: 0.1 });
  });
  it('falls back to a sensible position for unknown sizes', () => {
    expect(defaultVisionFocal(0, 1)).toEqual({ x: 0.5, y: 0.3 });
  });
});

describe('panVisionFocal', () => {
  it('moves opposite the finger and clamps at the edges, so a drag can never reveal blank paper', () => {
    const start = { x: 0.5, y: 0.5 };
    expect(panVisionFocal(start, { x: 0, y: 20 }, { x: 0, y: 100 })).toEqual({ x: 0.5, y: 0.3 });
    expect(panVisionFocal(start, { x: 0, y: 500 }, { x: 0, y: 100 }).y).toBe(0);
    expect(panVisionFocal(start, { x: 0, y: -500 }, { x: 0, y: 100 }).y).toBe(1);
    expect(panVisionFocal(start, { x: -30, y: 0 }, { x: 60, y: 0 }).x).toBe(1);
  });
  it('cannot move along an axis with no overflow', () => {
    expect(panVisionFocal({ x: 0.5, y: 0.2 }, { x: 40, y: 40 }, { x: 0, y: 0 })).toEqual({ x: 0.5, y: 0.2 });
  });
});

describe('stored and shared values', () => {
  it('parses a saved focal and rejects anything else', () => {
    expect(parseVisionFocal({ x: 0.25, y: 0.75 })).toEqual({ x: 0.25, y: 0.75 });
    expect(parseVisionFocal({ x: 2, y: -1 })).toEqual({ x: 1, y: 0 });
    for (const bad of [null, undefined, 3, 'x', {}, { x: 'a', y: 1 }, { x: NaN, y: 0 }]) expect(parseVisionFocal(bad)).toBeNull();
  });
  it('treats a negative component as "not set" on the UI thread', () => {
    const auto = defaultVisionFocal(2 / 3, 1);
    expect(resolveVisionFocal(-1, -1, 2 / 3, 1)).toEqual(auto);
    expect(resolveVisionFocal(0.2, -1, 2 / 3, 1)).toEqual({ x: 0.2, y: auto.y });
    expect(resolveVisionFocal(0.9, 0.4, 2 / 3, 1)).toEqual({ x: 0.9, y: 0.4 });
  });
  it('only reports a change worth saving', () => {
    expect(visionFocalChanged({ x: 0.5, y: 0.5 }, { x: 0.5005, y: 0.5 })).toBe(false);
    expect(visionFocalChanged({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 })).toBe(true);
    expect(visionFocalChanged(undefined, { x: 0.5, y: 0.5 })).toBe(true);
    expect(visionFocalChanged(undefined, null)).toBe(false);
  });
});
