import { colors } from '@/theme/colors';
import type { AnchorCategory } from '@/types';
import { INK_BOUNDARY } from '../creationFlowConfig';
import { H, HERO, fieldLineText } from '../geometry';
import { buildSceneContext, type BuiltFlow } from '../sceneContext';
import { drawFrameContent } from '../scenes/drawFrame';
import { FORM_REVEAL_SECONDS, drawForm } from '../scenes/FormScene';
import { drawMap } from '../scenes/MapScene';
import { STYLE_STROKES, strokeTreatmentFor } from '../scenes/styleStrokes';
import {
  INK_HIDDEN,
  autoBoundary,
  drawBoundary,
  sweepBoundary,
  tornEdge,
} from '../scenes/InkBoundary';
import { CREAM_PALETTE, type SceneContext } from '../scenes/sceneTypes';
import { RecordingPainter, fakeMeasure } from './recordingPainter';

const build = (
  text: string,
  category: AnchorCategory,
  overrides: Partial<Parameters<typeof buildSceneContext>[0]> = {}
): BuiltFlow =>
  buildSceneContext({
    intentionText: text,
    category,
    source: 'typed',
    entry: 'glide',
    mode: 'first',
    reduceMotion: false,
    measure: fakeMeasure,
    ...overrides,
  });

const paint = (ctx: SceneContext, t: number): RecordingPainter => {
  const p = new RecordingPainter();
  drawFrameContent(p, CREAM_PALETTE, ctx, { kind: 'auto', t });
  return p;
};

const TEXT = 'Close the deal';
/** D W H T V R N — seven distinct consonants. */
const SEVEN = 'I do whatever I want whenever I want';

describe('Distill', () => {
  it('ends on exactly the distilled letters, in order (Y stays a consonant)', () => {
    const { context, distilledLetters } = build('Fly by night', 'custom');
    expect(distilledLetters).toEqual(['F', 'L', 'Y', 'B', 'N', 'G', 'H', 'T']);

    const tl = context.timeline;
    const p = paint(context, tl.start.distill + tl.distill);
    const sans = p
      .of('text')
      .filter((o) => o.style.font.family === 'sans' && o.style.font.size === 26 && (o.style.alpha ?? 1) > 0.9)
      .map((o) => o.value);
    expect(sans).toEqual(distilledLetters);
  });

  it('shows the three captions in sequence', () => {
    const { context } = build(TEXT, 'career');
    const { start, distill } = context.timeline;
    const at = (u: number) => paint(context, start.distill + distill * u).visibleText(0.2);

    expect(at(0.1)).toContain('Removing vowels…');
    expect(at(0.42)).toContain('Combining duplicates…');
    expect(at(0.8)).toContain('Keeping each letter, in order.');
  });

  it('glides from the field to the centred layout without changing size', () => {
    const { context } = build(TEXT, 'career', { field: { x: 24, y: 282, width: 342, lineHeight: 39 } });
    const first = context.layout.chars.find((c) => c.ch !== ' ');
    expect(first?.ax).not.toBe(first?.cx);

    const sizes = new Set<number>();
    for (const t of [0, 0.3, 0.6, 0.9, 1.2]) {
      paint(context, t)
        .of('text')
        .filter((o) => o.style.font.family === 'serif')
        .forEach((o) => sizes.add(o.style.font.size));
    }
    // Only the slow camera push may change size, and it does not begin until Distill.
    expect(sizes.size).toBe(1);
  });

  it('reduce motion crossfades instead of gliding', () => {
    const { context } = build(TEXT, 'career', {
      reduceMotion: true,
      field: { x: 24, y: 282, width: 342, lineHeight: 39 },
    });
    const first = context.layout.chars.find((c) => c.ch !== ' ');
    const p = paint(context, 0.1);
    const op = p.of('text').find((o) => o.value === first?.ch && o.style.font.family === 'serif');
    expect(op?.x).toBeCloseTo(first!.cx, 5);
    expect(op?.y).toBeCloseTo(first!.by, 5);
  });
});

describe('Map', () => {
  const TIERS: Array<[AnchorCategory, number]> = [
    ['spirituality', 3],
    ['career', 4],
    ['health', 5],
    ['desire', 6],
    ['relationships', 7],
  ];

  it.each(TIERS)('draws the %s tier grid at %i x %i, never a fixed 6x6', (category, size) => {
    const { context } = build(TEXT, category);
    expect(context.map?.size).toBe(size);

    const { start, map } = context.timeline;
    const p = paint(context, start.map + map * 0.9);
    // N + 1 lines each way, and nothing else is a straight line in this beat.
    expect(p.of('line')).toHaveLength((size + 1) * 2);
  });

  it('keeps the frame inside the screen on every tier', () => {
    TIERS.forEach(([category]) => {
      const { context } = build(TEXT, category);
      const { x, span } = context.map!.frame;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + span).toBeLessThanOrEqual(390);
      expect(span).toBeLessThanOrEqual(330.01);
    });
  });

  it('shows the number actually used for each letter, not A=1', () => {
    const { context } = build('Stay still', 'spirituality'); // Saturn: digit-sum reduction
    const sMap = context.map!.points.find((pt) => pt.letter === 'S')!;
    expect(sMap.number).toBe(1); // S = 19 -> 1 on Saturn, not 19

    const sun = build('Stay still', 'desire').context.map!.points.find((pt) => pt.letter === 'S')!;
    expect(sun.number).toBe(19); // 36 cells: alphabet position
  });

  it('never labels every cell — only the cells that were landed in', () => {
    const { context } = build(TEXT, 'relationships'); // 49 cells
    const { start, map } = context.timeline;
    const p = paint(context, start.map + map * 0.99);
    const numbers = p
      .of('text')
      .filter((o) => o.style.font.size === 10 && /^\d+$/.test(o.value) && (o.style.alpha ?? 1) > 0.01);
    expect(numbers.length).toBeLessThanOrEqual(context.map!.points.length);
    expect(numbers.length).toBeLessThan(49);
  });

  it('lands one dot per cell and draws no zero-length segments when cells repeat', () => {
    // J(10), S(19) -> both cell 1 on Saturn; T(20) -> 2.
    const { context } = build('just so', 'spirituality');
    const cells = context.map!.points.map((pt) => pt.cell);
    expect(new Set(cells).size).toBeLessThan(cells.length);

    const { start, map } = context.timeline;
    const p = paint(context, start.map + map * 0.999);
    const dots = p.of('circle').filter((o) => o.fill && o.r === 3.4);
    expect(dots).toHaveLength(new Set(cells).size);

    p.of('segments').forEach((seg) =>
      seg.pairs.forEach(([a, b]) => expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0.5))
    );
  });

  it('uses gold only for the one-shot landing ring', () => {
    const { context } = build(TEXT, 'desire');
    const { start, map } = context.timeline;
    for (let u = 0; u <= 1; u += 0.05) {
      const p = paint(context, start.map + map * u);
      p.ops.forEach((o) => {
        const styles = [
          (o as { stroke?: { color: string } }).stroke,
          (o as { fill?: { color: string } }).fill,
          (o as { style?: { color: string } }).style,
        ];
        styles.forEach((s) => {
          if (s?.color === colors.creation.gold) {
            expect(o.op).toBe('circle');
            expect((o as { fill?: unknown }).fill).toBeUndefined();
          }
        });
      });
    }
  });

  it('draws the path progressively between the real jittered points', () => {
    const { context } = build(TEXT, 'desire');
    const { start, map } = context.timeline;
    const pairsAt = (u: number) =>
      paint(context, start.map + map * u)
        .of('segments')
        .reduce((n, s) => n + s.pairs.length, 0);
    expect(pairsAt(0.3)).toBeLessThan(pairsAt(0.999));
    expect(pairsAt(0.999)).toBeGreaterThan(0);
  });
});

describe('Forget', () => {
  it('ends with only the polyline at the hero and the proof line', () => {
    const { context } = build(SEVEN, 'desire');
    expect(context.letterCount).toBe(7);
    const end = context.timeline.start.forget + context.timeline.forget;
    const p = paint(context, end);

    expect(p.of('line')).toHaveLength(0); // grid gone
    expect(p.visibleText()).toEqual(['Seven letters. One line. Only yours.']);

    const poly = p.of('polyline')[0];
    expect(poly).toBeDefined();
    const cx = poly.points.reduce((s, pt) => s + pt.x, 0) / poly.points.length;
    expect(Math.abs(cx - HERO.x)).toBeLessThan(120);
    expect(p.of('circle').filter((o) => o.fill && (o.fill.alpha ?? 1) > 0.01)).toHaveLength(0);
  });

  it('holds still: the stillness beat draws exactly what Forget ended on', () => {
    const { context } = build(SEVEN, 'desire');
    const tl = context.timeline;
    const end = tl.start.forget + tl.forget;
    const a = paint(context, end);
    const b = paint(context, end + tl.stillness * 0.9);
    expect(JSON.stringify(b.ops)).toBe(JSON.stringify(a.ops));
  });

  it('fits the hero to about 230 px', () => {
    const { context } = build(SEVEN, 'desire');
    const pts = context.hero.vertices;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(extent).toBeGreaterThan(100);
    expect(extent).toBeLessThanOrEqual(230.01);
  });
});

describe('Form (D5)', () => {
  const colorsDrawn = (p: RecordingPainter) => new Set(p.of('polyline').map((o) => o.stroke.color));

  it('names the draw before styling, then sets expectations for a longer style during the actual wait', () => {
    const { context } = build(TEXT, 'desire');
    const early = new RecordingPainter();
    drawForm(early, CREAM_PALETTE, context, { tf: 0.6, progress: 0, slow: false, fade: 1, styleId: 'porcelain', styleName: 'Porcelain', longerWait: true });
    expect(early.visibleText()).toContain('Drawing your line…');
    const styled = new RecordingPainter();
    drawForm(styled, CREAM_PALETTE, context, { tf: 2, progress: 0.5, slow: false, fade: 1, styleId: 'porcelain', styleName: 'Porcelain', longerWait: true });
    expect(styled.visibleText()).toContain('Applying your style…');
    const waiting = new RecordingPainter();
    drawForm(waiting, CREAM_PALETTE, context, { tf: 5, progress: 0.8, slow: false, fade: 1, styleId: 'porcelain', styleName: 'Porcelain', longerWait: true });
    expect(waiting.visibleText()).toContain('Forging your Porcelain — this one takes a moment');
    expect(waiting.visibleText()).toContain('Applying your style…');
  });

  it('sets Alloy expectations from the apply stage even when recommended', () => {
    const { context } = build(TEXT, 'desire');
    const p = new RecordingPainter();
    drawForm(p, CREAM_PALETTE, context, { tf: 1.2, progress: 0.1, slow: false, fade: 1, styleId: 'alloy', styleName: 'Alloy', longerWait: false });
    expect(p.visibleText()).toContain('Applying your style…');
    expect(p.visibleText()).toContain('Forging your Alloy — this one takes a moment');
  });

  it('gives the bottom stage text contrast and gentle motion, respecting Reduce Motion', () => {
    const { context } = build(TEXT, 'desire');
    const caption = (tf: number, reduceMotion: boolean) => {
      const p = new RecordingPainter();
      drawForm(p, CREAM_PALETTE, { ...context, reduceMotion }, { tf, progress: 0.5, slow: false, fade: 1, styleId: 'alloy' });
      return p.of('text').find((op) => op.value === 'Applying your style…')!;
    };
    const first = caption(4, false);
    expect(caption(4.7, false).y).not.toBe(first.y);
    expect(caption(4.7, true)).toEqual(caption(4, true));
  });

  it('never morphs the geometry: no smoothing, no construction circle, caption says styling', () => {
    const { context } = build(TEXT, 'desire');
    const p = new RecordingPainter();
    drawForm(p, CREAM_PALETTE, context, { tf: 3, progress: 0.4, slow: false, fade: 1, styleId: 'woven' });

    expect(p.of('smoothStroke')).toHaveLength(0);
    expect(p.of('arc')).toHaveLength(0);
    expect(p.visibleText()).toContain('Applying your style…');
    expect(p.visibleText()).not.toContain('Refining the form…');
  });

  it('draws no progress bar: the wait is the reveal', () => {
    const { context } = build(TEXT, 'desire');
    const p = new RecordingPainter();
    drawForm(p, CREAM_PALETTE, context, { tf: 2, progress: 0.5, slow: false, fade: 1, styleId: 'woven' });
    expect(p.of('fillRect').filter((o) => o.y === 790)).toHaveLength(0);
  });

  it('switches the caption after a long wait', () => {
    const { context } = build(TEXT, 'desire');
    const p = new RecordingPainter();
    drawForm(p, CREAM_PALETTE, context, { tf: 14, progress: 0.9, slow: true, fade: 1, styleId: 'woven' });
    expect(p.visibleText()).toContain('Still working on your anchor…');
  });

  it('re-draws the line first and lets the style material bloom behind the pen', () => {
    const { context } = build(TEXT, 'desire');
    const woven = strokeTreatmentFor('woven').layers.map((l) => l.color);

    const early = new RecordingPainter();
    drawForm(early, CREAM_PALETTE, context, { tf: 0.3, progress: 0, slow: false, fade: 1, styleId: 'woven' });
    expect(woven.some((c) => colorsDrawn(early).has(c))).toBe(false);

    const mid = new RecordingPainter();
    drawForm(mid, CREAM_PALETTE, context, { tf: 1.6, progress: 0, slow: false, fade: 1, styleId: 'woven' });
    expect(woven.some((c) => colorsDrawn(mid).has(c))).toBe(true);

    const done = new RecordingPainter();
    drawForm(done, CREAM_PALETTE, context, { tf: FORM_REVEAL_SECONDS + 0.1, progress: 0, slow: false, fade: 1, styleId: 'woven' });
    woven.forEach((c) => expect(colorsDrawn(done).has(c)).toBe(true));
  });

  it('gives every style its own material, not a shared tint', () => {
    const { context } = build(TEXT, 'desire');
    const signature = (styleId: string) => {
      const p = new RecordingPainter();
      drawForm(p, CREAM_PALETTE, context, { tf: FORM_REVEAL_SECONDS + 0.1, progress: 1, slow: false, fade: 1, styleId });
      return JSON.stringify(strokeTreatmentFor(styleId).layers);
    };
    const ids = Object.keys(STYLE_STROKES);
    expect(ids).toHaveLength(15);
    expect(new Set(ids.map(signature)).size).toBe(ids.length);
  });

  it('keeps stitched thread as dashed stitches and leaves flat styles flat', () => {
    expect(strokeTreatmentFor('woven').layers.some((l) => l.dash)).toBe(true);
    expect(strokeTreatmentFor('graphic').layers).toHaveLength(1);
  });

  it.each(Object.keys(STYLE_STROKES))('%s: the apply phase never holds still, and the motion shows on the field', (styleId) => {
    const { context } = build(TEXT, 'desire');
    const frame = (tf: number) => {
      const p = new RecordingPainter();
      drawForm(p, CREAM_PALETTE, context, { tf, progress: 0.5, slow: false, fade: 1, styleId });
      return JSON.stringify(p.ops);
    };
    // From the moment styling begins to well past the reveal, nothing is identical half a second
    // apart (a static hold of ~1s is the failure), including the whole resting wait.
    for (let tf = 1; tf <= 14; tf += 0.25) expect(frame(tf)).not.toBe(frame(tf + 0.5));
    // Resting wait: a lit head (white core + glow disc) is painted on every frame.
    for (let tf = FORM_REVEAL_SECONDS + 0.6; tf <= FORM_REVEAL_SECONDS + 5.5; tf += 0.37) {
      const p = new RecordingPainter();
      drawForm(p, CREAM_PALETTE, context, { tf, progress: 0.5, slow: false, fade: 1, styleId });
      const heads = p.of('circle').filter((op) => op.fill?.color === '#FFFFFF' && (op.fill?.alpha ?? 0) > 0.9);
      expect(heads.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Map captions', () => {
  it('names the field by function and states the ritual line, then clears before Forget', () => {
    const { context } = build(TEXT, 'desire');
    expect(context.fieldLine).toBe('Desire intentions take shape on the Desire field.');
    const tl = context.timeline;
    const mid = new RecordingPainter();
    drawMap(mid, CREAM_PALETTE, context, tl.start.map + tl.map * 0.6);
    expect(mid.visibleText()).toContain('Desire intentions take shape on the Desire field.');
    expect(mid.visibleText()).toContain('Letters become numbers. Numbers become the path.');

    const end = new RecordingPainter();
    drawMap(end, CREAM_PALETTE, context, tl.start.map + tl.map - 0.01);
    expect(end.visibleText()).not.toContain('Letters become numbers. Numbers become the path.');
  });

  it('uses no occult terminology in any field line', () => {
    ['desire', 'health', 'career', 'relationships', 'creativity', 'spirituality', 'abundance', 'family', 'learning', 'adventure', 'custom'].forEach((c) => {
      expect(fieldLineText(c)).not.toMatch(/planet|kamea|sigil|sacred|saturn|jupiter|mars|venus|sun\b/i);
    });
    expect(fieldLineText('custom')).toBe('Your intention takes shape on its own field.');
  });
});

describe('Ink boundary', () => {
  it('rises from below the screen to 618 over the handoff, then to 104, then 98', () => {
    const { context } = build(TEXT, 'desire');
    const tl = context.timeline;
    expect(autoBoundary(context, 0)).toBe(INK_HIDDEN);
    expect(autoBoundary(context, tl.handoff - 1e-6)).toBeCloseTo(INK_BOUNDARY.afterHandoff, 0);
    expect(autoBoundary(context, tl.start.distill + tl.distill - 1e-6)).toBeCloseTo(INK_BOUNDARY.afterDistill, 0);
    expect(autoBoundary(context, tl.start.map + tl.map - 1e-6)).toBeCloseTo(INK_BOUNDARY.held, 0);
    expect(autoBoundary(context, tl.rawGeometryAt)).toBe(INK_BOUNDARY.held);
  });

  it('is monotonic upward during the handoff', () => {
    const { context } = build(TEXT, 'desire');
    let last = Infinity;
    for (let t = 0; t <= context.timeline.handoff; t += 0.05) {
      const b = autoBoundary(context, t);
      expect(b).toBeLessThanOrEqual(last + 1e-9);
      last = b;
    }
  });

  it('skips the rise under reduce motion', () => {
    const { context } = build(TEXT, 'desire', { reduceMotion: true });
    expect(autoBoundary(context, 0)).toBe(INK_BOUNDARY.afterHandoff);
    expect(drawBoundary(0, true)).toBe(INK_BOUNDARY.held);
    expect(sweepBoundary(0.5, true)).toBe(INK_BOUNDARY.held);
  });

  it('sweeps from 98 to off-screen', () => {
    expect(sweepBoundary(0, false)).toBe(INK_BOUNDARY.held);
    expect(sweepBoundary(1, false)).toBe(INK_HIDDEN);
    expect(INK_HIDDEN).toBeGreaterThan(H);
  });

  it('torn edge stays within its three octaves', () => {
    for (let x = -20; x <= 410; x += 1) {
      expect(Math.abs(tornEdge(x))).toBeLessThanOrEqual(9 + 3.6 + 0.9 + 1e-9);
    }
  });
});

describe('Draw path', () => {
  const strokes = [
    [{ x: 120, y: 640 }, { x: 195, y: 300 }, { x: 270, y: 640 }],
    [{ x: 145, y: 520 }, { x: 245, y: 520 }],
  ];

  it('has no grid, no letters and shows the drawn proof line', () => {
    const { context } = build(TEXT, 'desire', { source: 'drawn', drawnStrokes: strokes });
    expect(context.map).toBeNull();
    expect(context.timeline.distill).toBe(0);
    expect(context.timeline.map).toBe(0);

    const tl = context.timeline;
    const p = paint(context, tl.start.forget + tl.forget);
    expect(p.of('line')).toHaveLength(0);
    expect(p.visibleText()).toEqual(['Drawn by you. Only yours.']);
    expect(p.of('polyline').length).toBe(2); // one polyline per stroke
  });

  it('builds a 100x100 multi-path SVG for styling', () => {
    const { baseSigilSvg } = build(TEXT, 'desire', { source: 'drawn', drawnStrokes: strokes });
    expect(baseSigilSvg).toContain('viewBox="0 0 100 100"');
    expect(baseSigilSvg.match(/<path /g)).toHaveLength(2);
  });

  it('shows the pad, hint and small intention while empty', () => {
    const { context } = build(TEXT, 'desire', { source: 'drawn' });
    const p = new RecordingPainter();
    drawFrameContent(p, CREAM_PALETTE, context, {
      kind: 'draw',
      pad: { strokes: [], current: null, riseU: 1 },
    });
    expect(p.visibleText()).toContain('Draw here');
    expect(p.of('strokeRRect')).toHaveLength(1);
    expect(p.of('strokeRRect')[0].stroke.dash).toEqual([5, 7]);
  });

  it('shows the strokes as they are drawn', () => {
    const { context } = build(TEXT, 'desire', { source: 'drawn' });
    const p = new RecordingPainter();
    drawFrameContent(p, CREAM_PALETTE, context, {
      kind: 'draw',
      pad: { strokes: [strokes[0]], current: strokes[1], riseU: 1 },
    });
    expect(p.of('smoothStroke')).toHaveLength(2);
    expect(p.visibleText()).not.toContain('Draw here');
  });
});
