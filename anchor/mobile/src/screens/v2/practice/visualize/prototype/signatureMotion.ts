import type { SceneRect, Size } from '@/components/v2/vision/board/visionBoardLayouts';
import { cameraAtRect, mix, mixCamera, progress, projectPoint, restCinematicCamera, smooth } from './cinematicGeometry';

/** Diagnostic reel, not a practice timer. No completion service is connected. */
export const SIGNATURE_BEATS = { breakout: 3000, immersed: 6000, compression: 11000, anchor: 15000, return: 17000, board: 21000, end: 24000 } as const;

export function signaturePlaybackRange(fromMs: number) {
  const start = Math.max(0, Math.min(SIGNATURE_BEATS.end, fromMs));
  return { start, duration: SIGNATURE_BEATS.end - start };
}

export function controlAction(action: () => void) {
  return () => action();
}

export function signatureGeometry(scene: Size, viewport: Size, photo: SceneRect, mark: SceneRect) {
  const rest = restCinematicCamera(scene, viewport);
  const lifted = { ...photo, y: photo.y - 4 };
  const full = { ...cameraAtRect(lifted, viewport, 1), scale: Math.max(viewport.width / photo.width, viewport.height / photo.height) * 1.015 };
  const anchor = cameraAtRect(mark, viewport, 0.5);
  return { rest, full, anchor, photo, mark, viewport };
}

export type SignatureGeometry = ReturnType<typeof signatureGeometry>;

export function signatureFrame(ms: number, geometry: SignatureGeometry, reduced = false) {
  'worklet';
  const b = SIGNATURE_BEATS;
  const { rest, full, anchor, photo, mark, viewport } = geometry;
  const breakout = smooth(progress(ms, b.breakout, b.immersed));
  const compression = smooth(progress(ms, b.compression, b.anchor));
  const retreat = smooth(progress(ms, b.return, b.board));
  // Rebase the hidden environment while the foreground holds its exact screen crop.
  // The mark's scene coordinate never changes: it belongs to the card throughout.
  const camera = ms < b.immersed ? mixCamera(rest, full, breakout)
    : ms < b.compression ? mixCamera(full, anchor, smooth(progress(ms, b.immersed, b.compression)))
      : mixCamera(anchor, rest, retreat);
  const photoCamera = ms < b.immersed ? camera : full;
  const photoCenter = projectPoint({ x: photo.x + photo.width / 2, y: photo.y + photo.height / 2 - 4 * breakout }, photoCamera, viewport);
  const markCenter = projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, camera, viewport);
  const photoScale = photoCamera.scale * mix(1, 0.72, compression);
  const opening = progress(ms, 0, 2400);
  const environment = ms < b.immersed ? 1 - 0.3 * breakout
    : ms < b.return ? 0 : smooth(progress(ms, b.return, b.return + 1600));
  const markPresence = ms < b.immersed ? 1 - breakout
    : smooth(progress(ms, b.anchor - 1000, b.anchor));
  const textured = 1 - smooth(progress(ms, b.anchor - 1000, b.anchor));
  const boundary = 1;
  const aperture = smooth(progress(ms, b.compression, b.anchor - 1200));
  const frameOpacity = ms < b.immersed ? 1 : 0;
  if (reduced) {
    // Accessibility: a static board and static viewport image, with no travel.
    const onBoard = ms < b.immersed || ms >= b.return + 1000;
    const reducedMarkPresence = ms < b.immersed ? 1 - progress(ms, b.breakout, b.immersed)
      : ms < b.return ? progress(ms, b.compression, b.anchor)
        : ms < b.return + 1000 ? 1 - progress(ms, b.return, b.return + 1000) : progress(ms, b.return + 1000, b.return + 2000);
    return { camera: rest, opening, environment: ms < b.immersed ? 1 - progress(ms, b.breakout, b.immersed) : smooth(progress(ms, b.return, b.board)),
      markCenter: onBoard ? projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, rest, viewport) : { x: viewport.width / 2, y: viewport.height / 2 },
      markScale: onBoard ? rest.scale : anchor.scale,
      markRotation: onBoard ? mark.rotation : 0,
      markPresence: reducedMarkPresence,
      photoCenter: { x: viewport.width / 2, y: viewport.height / 2 }, photoScale: full.scale,
      photoRotation: 0, frameOpacity: 0, boundary: 1,
      textured: progress(ms, b.breakout, b.immersed) * (1 - progress(ms, b.compression, b.anchor)),
      compression, aperture: 0, retreat, nativePhoto: 1 };
  }
  return { camera, opening, environment, markCenter, markScale: camera.scale,
    markRotation: mark.rotation + camera.rotation, markPresence, photoCenter, photoScale,
    photoRotation: photo.rotation + photoCamera.rotation, frameOpacity, boundary, aperture, textured,
    compression, retreat, nativePhoto: ms >= b.return ? 1 : 0 };
}
