import { HANDWRITING_LINES } from '../handwritingStrokes';
import { CTA_READY_MS, MARK_STROKES, T, planInk } from '../screen2Timeline';

/**
 * Screen 2 must read as one transformation. Pausing it anywhere should land on one of:
 * blank paper → writing in progress → complete intention → intention breaking apart →
 * fragments travelling → Anchor partially forming → completed Anchor.
 */
describe('Screen 2 transformation timeline', () => {
  const plan = planInk();
  const firstWrite = Math.min(...plan.strokes.map((stroke) => stroke.write[0]));
  const lastWrite = Math.max(...plan.strokes.map((stroke) => stroke.write[1]));
  const departures = plan.chunks.map((chunk) => chunk.flight[0]);
  const arrivals = plan.chunks.map((chunk) => chunk.flight[1]);

  it('shows the notebook with a blank page before any ink', () => {
    expect(firstWrite).toBeGreaterThanOrEqual(T.notebookIn[1]);
  });

  it('writes stroke by stroke, in order, at a legible hand pace', () => {
    for (let i = 1; i < plan.strokes.length; i++) {
      // The pen lifts between strokes: no two strokes are drawn at once.
      expect(plan.strokes[i].write[0]).toBeGreaterThanOrEqual(plan.strokes[i - 1].write[1]);
    }
    T.lines.forEach(([start, end], index) => {
      const lineStrokes = plan.strokes.filter((stroke) => stroke.line === index);
      expect(lineStrokes[0].write[0]).toBe(start);
      expect(lineStrokes[lineStrokes.length - 1].write[1]).toBeCloseTo(end, 5);
      // Each line takes long enough to register as being written, not typed or faded on.
      expect(end - start).toBeGreaterThanOrEqual(2000);
      // Most of the line's time is the pen moving on the page, not lifted.
      const drawing = lineStrokes.reduce((sum, stroke) => sum + stroke.write[1] - stroke.write[0], 0);
      expect(drawing / (end - start)).toBeGreaterThan(0.6);
    });
  });

  it('holds the complete intention before it breaks apart', () => {
    expect(Math.min(...departures) - lastWrite).toBeGreaterThanOrEqual(500);
  });

  it('breaks the writing itself into letter-sized pieces that cover every stroke exactly', () => {
    plan.strokes.forEach((stroke, index) => {
      const pieces = plan.chunks.filter((chunk) => chunk.stroke === index);
      expect(pieces.length).toBeGreaterThan(0);
      const covered = pieces.reduce((sum, piece) => sum + piece.length, 0);
      expect(covered).toBeCloseTo(stroke.length, 3);
    });
    const letters = HANDWRITING_LINES.reduce((sum, line) => sum + line.text.replace(/\s/g, '').length, 0);
    expect(plan.chunks.length).toBeGreaterThanOrEqual(letters);
  });

  it('staggers departures so the pieces do not all move at once', () => {
    const unique = new Set(departures.map((t) => Math.round(t)));
    expect(unique.size).toBe(departures.length);
    expect(Math.max(...departures) - Math.min(...departures)).toBeGreaterThanOrEqual(800);
  });

  it('builds each part of the mark from the pieces assigned to it, as they arrive', () => {
    MARK_STROKES.forEach((_, part) => {
      const feeding = plan.chunks.filter((chunk) => chunk.target === part);
      expect(feeding.length).toBeGreaterThan(0);
      const [guideStart, guideEnd] = T.guides[part];
      // The guide starts once its pieces are in the air and near, and is still drawing as
      // the last of them lands: the pieces visibly become the stroke.
      expect(guideStart).toBeGreaterThan(Math.min(...feeding.map((chunk) => chunk.flight[0])));
      expect(guideEnd).toBeGreaterThanOrEqual(Math.min(...feeding.map((chunk) => chunk.flight[1])));
    });
    for (let i = 1; i < T.guides.length; i++) {
      expect(T.guides[i][0]).toBeGreaterThan(T.guides[i - 1][0]);
    }
  });

  it('paints the mark in along its strokes before it settles, then holds before the copy', () => {
    const lastBrush = Math.max(...T.guides.map(([, end]) => end + T.brushLag));
    expect(T.markComplete[0]).toBeGreaterThanOrEqual(lastBrush - 100);
    expect(T.diamondIn[0]).toBeGreaterThan(Math.max(...arrivals));
    expect(T.settleUp[0]).toBeGreaterThanOrEqual(T.markComplete[0]);
    // Quiet hold on the finished Anchor before any supporting copy.
    expect(T.headline[0] - T.settleDown[1]).toBeGreaterThanOrEqual(300);
    expect(CTA_READY_MS).toBeGreaterThan(T.headline[0]);
    expect(CTA_READY_MS).toBeLessThan(T.end);
  });
});
