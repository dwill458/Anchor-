import type { SceneRect, Size } from '@/components/v2/vision/board/visionBoardLayouts';
import { cameraAtRect, mixCamera, progress, projectPoint, restCinematicCamera, smooth } from './prototype/cinematicGeometry';
import { cinematicSegmentAt, type CinematicTimeline } from './prototype/cinematicTimeline';

export function cinematicSessionGeometry(scene: Size, viewport: Size, firstPhoto: SceneRect, mark: SceneRect, imageCount: number, canvasFrame?: { x: number; y: number; width: number; height: number }) {
  const scale = canvasFrame ? canvasFrame.width / scene.width : 0;
  const rest = canvasFrame && scale > 0 ? {
    x: scene.width / 2 + (viewport.width / 2 - canvasFrame.x - canvasFrame.width / 2) / scale,
    y: scene.height / 2 + (viewport.height / 2 - canvasFrame.y - canvasFrame.height / 2) / scale,
    rotation: 0, scale,
  } : restCinematicCamera(scene, viewport);
  const lifted = { ...firstPhoto, y: firstPhoto.y - 4 };
  const full = { ...cameraAtRect(lifted, viewport, 1),
    scale: Math.max(viewport.width / firstPhoto.width, viewport.height / firstPhoto.height) * 1.015 };
  const anchor = cameraAtRect(mark, viewport, 0.5);
  return { scene, viewport, firstPhoto, mark, rest, full, anchor, imageCount };
}
export type CinematicSessionGeometry = ReturnType<typeof cinematicSessionGeometry>;

/** All native and Skia layers read this one frame in the same scene space. */
export function cinematicSessionFrame(ms: number, timeline: CinematicTimeline, g: CinematicSessionGeometry, reduced: boolean) {
  'worklet';
  const segment = cinematicSegmentAt(timeline, ms);
  const lastImage = g.imageCount - 1;
  const p = smooth(progress(ms, segment.startMs, segment.endMs));
  const breakout = segment.kind === 'arrival' ? 0 : segment.kind === 'breakout' ? p : 1;
  const compression = segment.kind === 'compression' ? p :
    ['recognition', 'return', 'carry', 'boardHold'].includes(segment.kind) ? 1 : 0;
  const compressionResolve = segment.kind === 'compression' ? smooth(progress(ms, segment.startMs + 3000, segment.endMs)) : 0;
  const recognition = segment.kind === 'compression' ? compressionResolve : segment.kind === 'recognition' ? 1 :
    ['return', 'carry', 'boardHold'].includes(segment.kind) ? 1 : 0;
  const retreat = segment.kind === 'return' ? p : ['carry', 'boardHold'].includes(segment.kind) ? 1 : 0;
  const camera = reduced ? g.rest : segment.kind === 'arrival' ? g.rest :
    segment.kind === 'breakout' ? mixCamera(g.rest, g.full, breakout) :
      segment.kind === 'return' || segment.kind === 'carry' || segment.kind === 'boardHold'
        ? mixCamera(g.anchor, g.rest, retreat) : g.anchor;
  const photoCamera = reduced && (segment.kind === 'arrival' || segment.kind === 'breakout') ? g.rest :
    segment.kind === 'arrival' || segment.kind === 'breakout' ? camera : g.full;
  const firstCenter = projectPoint({ x: g.firstPhoto.x + g.firstPhoto.width / 2,
    y: g.firstPhoto.y + g.firstPhoto.height / 2 - 4 * breakout }, photoCamera, g.viewport);
  const markCenter = reduced && segment.kind !== 'arrival' && segment.kind !== 'breakout'
    ? { x: g.viewport.width / 2, y: g.viewport.height / 2 }
    : projectPoint({ x: g.mark.x + g.mark.width / 2, y: g.mark.y + g.mark.height / 2 }, camera, g.viewport);
  const environment = reduced ? segment.kind === 'arrival' ? 1 : segment.kind === 'breakout' ? 1 - p : retreat :
    segment.kind === 'arrival' ? 1 : segment.kind === 'breakout' ? 1 - 0.3 * p : retreat;
  const sceneImageIndex = segment.kind === 'arrival' || segment.kind === 'breakout' ? 0 :
    segment.kind === 'transition' ? Math.max(0, (segment.imageIndex ?? 1) - 1) :
      segment.kind === 'immersion' ? segment.imageIndex ?? 0 : lastImage;
  return { segment, progress: p, camera, firstCenter, firstScale: photoCamera.scale,
    firstRotation: g.firstPhoto.rotation + photoCamera.rotation,
    markCenter, markScale: reduced && segment.kind !== 'arrival' && segment.kind !== 'breakout' ? g.anchor.scale : camera.scale,
    markRotation: reduced && segment.kind !== 'arrival' && segment.kind !== 'breakout' ? 0 : g.mark.rotation + camera.rotation,
    environment, frameOpacity: segment.kind === 'arrival' ? 1 : segment.kind === 'breakout' ? 1 - p : 0,
    nativePhoto: segment.kind === 'arrival' || segment.kind === 'breakout' ? 0 : 1,
    markOpacity: segment.kind === 'arrival' ? 1 : segment.kind === 'breakout' ? 1 - p :
      reduced && segment.kind === 'return' ? 1 - p : reduced &&
        (segment.kind === 'carry' || segment.kind === 'boardHold') ? 0 : recognition,
    boardMarkOpacity: reduced && segment.kind === 'return' ? p : reduced &&
      (segment.kind === 'carry' || segment.kind === 'boardHold') ? 1 : 0,
    sceneImageIndex, compression, recognition, retreat,
    unmasked: segment.kind === 'compression' ? reduced ? 1 - smooth(progress(ms, segment.startMs, segment.startMs + 2000)) : 0 : compression > 0 ? 0 : 1,
    masked: segment.kind === 'compression' ?
      (reduced ? smooth(progress(ms, segment.startMs, segment.startMs + 2000)) : 1) * (1 - compressionResolve) : 0,
    maskRadius: Math.hypot(g.viewport.width, g.viewport.height) * (1 - smooth(progress(ms,
      segment.kind === 'compression' ? segment.startMs : 0,
      segment.kind === 'compression' ? segment.startMs + 2800 : 2800))),
  };
}
export type ReturnTypeCinematicFrame = ReturnType<typeof cinematicSessionFrame>;
