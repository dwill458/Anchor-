import { boardSizeForWidth, selectBoardLayout, toSceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import { restCamera } from '@/components/v2/vision/board/visionBoardCamera';
import { buildBoardVisitSchedule, V2_VISUALIZE_TIMING } from '../visualizeVisionPlan';
import { planVisualizeCamera, visualizeCameraPhaseAt } from '../visualizeBoardCamera';

const viewport = { width: 390, height: 844 };
const scene = boardSizeForWidth(390 * V2_VISUALIZE_TIMING.board.renderScale);

function planFor(duration: number, count: number) {
  const layout = selectBoardLayout(count);
  return planVisualizeCamera({
    schedule: buildBoardVisitSchedule(duration, count),
    photoRects: layout.photos.map(slot => toSceneRect(slot, scene)),
    cardRect: toSceneRect(layout.card, scene),
    scene,
    viewport,
  });
}

describe('Visualize camera plan', () => {
  it('opens on the Anchor, pushing in slightly', () => {
    const plan = planFor(180, 4);
    expect(plan.anchorPush.scale / plan.anchor.scale).toBeCloseTo(V2_VISUALIZE_TIMING.board.openingPush);
    expect(visualizeCameraPhaseAt(plan, 1000)).toEqual(expect.objectContaining({ kind: 'opening', to: plan.anchorPush }));
  });

  it('glides to each photograph in 1.2-1.8s, then holds', () => {
    const plan = planFor(180, 5);
    for (const visit of plan.visits) {
      expect(visit.travelMs).toBeGreaterThanOrEqual(1200);
      expect(visit.travelMs).toBeLessThanOrEqual(1800);
      expect(visit.drift.scale).toBeGreaterThan(visit.target.scale);
    }
    const first = plan.visits[0];
    expect(visualizeCameraPhaseAt(plan, first.startMs + 100)).toEqual(expect.objectContaining({ kind: 'travel', remainingTravelMs: first.travelMs - 100 }));
    expect(visualizeCameraPhaseAt(plan, first.startMs + first.travelMs + 1000)).toEqual(expect.objectContaining({ kind: 'hold' }));
  });

  it('brings every photograph to the centre of attention, never exaggerated', () => {
    const plan = planFor(180, 6);
    // The zoom cap is relative to the board fitted to the screen.
    const rest = restCamera(scene, viewport);
    const seen = new Set<string>();
    for (const visit of plan.visits) {
      seen.add(`${visit.target.x.toFixed(1)}:${visit.target.y.toFixed(1)}`);
      expect(visit.target.scale / rest.scale).toBeLessThanOrEqual(V2_VISUALIZE_TIMING.board.maxZoom + 1e-9);
    }
    expect(seen.size).toBe(6);
  });

  it('resumes a paused glide towards the same place with the remaining time', () => {
    const plan = planFor(60, 3);
    const visit = plan.visits[1];
    const paused = visualizeCameraPhaseAt(plan, visit.startMs + 400);
    expect(paused.kind).toBe('travel');
    if (paused.kind === 'travel') {
      expect(paused.visit.target).toEqual(visit.target);
      expect(paused.remainingTravelMs).toBe(visit.travelMs - 400);
    }
  });

  it('finishes by pulling back to the board and settling around the Anchor', () => {
    const plan = planFor(180, 3);
    expect(plan.rest.x).toBe(0);
    expect(plan.rest.y).toBe(0);
    expect(plan.finale.x).toBeCloseTo(plan.anchor.x);
    expect(plan.finale.y).toBeCloseTo(plan.anchor.y);
    expect(plan.finale.scale).toBeGreaterThan(plan.rest.scale);
    expect(plan.finale.scale).toBeLessThan(plan.anchor.scale);
  });

  it('stays on the Anchor when there are no photographs', () => {
    const plan = planFor(60, 0);
    expect(plan.visits).toEqual([]);
    expect(visualizeCameraPhaseAt(plan, 50_000).kind).toBe('opening');
  });
});
