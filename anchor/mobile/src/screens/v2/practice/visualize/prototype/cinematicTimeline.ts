import { VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';

export type CinematicDurationSeconds = 60 | 180 | 300;

export type CinematicSegmentKind =
  | 'arrival'
  | 'breakout'
  | 'immersion'
  | 'transition'
  | 'finalHold'
  | 'feeling'
  | 'compression'
  | 'recognition'
  | 'return'
  | 'carry'
  | 'boardHold';

export type CinematicSegment = {
  kind: CinematicSegmentKind;
  startMs: number;
  endMs: number;
  /** `immersion` uses its own image; `transition` points to the incoming image. */
  imageIndex?: number;
};

export type CinematicTimeline = {
  durationMs: number;
  segments: CinematicSegment[];
};

const SECOND = 1000;
const BETWEEN_IMAGES_MS = 2 * SECOND;

const FIXED_TAIL: ReadonlyArray<readonly [CinematicSegmentKind, number]> = [
  ['finalHold', 2 * SECOND],
  ['feeling', 3 * SECOND],
  ['compression', 4 * SECOND],
  ['recognition', 2 * SECOND],
  ['return', 4 * SECOND],
  ['carry', 3 * SECOND],
  ['boardHold', SECOND],
];

function arrivalDuration(durationSeconds: CinematicDurationSeconds) {
  'worklet';
  return durationSeconds === 60 ? 3 * SECOND : durationSeconds === 180 ? 4 * SECOND : 5 * SECOND;
}

/** Builds an absolute-millisecond, image-ordered timeline with no duplicated image slots. */
export function buildCinematicTimeline(
  durationSeconds: CinematicDurationSeconds,
  imageCount: number,
): CinematicTimeline {
  if (!Number.isInteger(imageCount) || imageCount < 1) {
    throw new RangeError('A cinematic timeline requires at least one saved Vision image.');
  }

  const count = Math.min(imageCount, VISION_BOARD_MAX_IMAGES);
  const durationMs = durationSeconds * SECOND;
  const arrivalMs = arrivalDuration(durationSeconds);
  const fixedTailMs = FIXED_TAIL.reduce((total, [, duration]) => total + duration, 0);
  const transitionTotalMs = (count - 1) * BETWEEN_IMAGES_MS;
  const immersionTotalMs = durationMs - arrivalMs - 3 * SECOND - transitionTotalMs - fixedTailMs;
  if (immersionTotalMs < count) {
    throw new RangeError('The selected duration is too short for this image count.');
  }

  const baseImmersionMs = Math.floor(immersionTotalMs / count);
  const remainderMs = immersionTotalMs % count;
  const segments: CinematicSegment[] = [];
  let cursor = 0;
  const append = (kind: CinematicSegmentKind, duration: number, imageIndex?: number) => {
    segments.push({ kind, startMs: cursor, endMs: cursor + duration, ...(imageIndex === undefined ? {} : { imageIndex }) });
    cursor += duration;
  };

  append('arrival', arrivalMs);
  append('breakout', 3 * SECOND, 0);
  for (let imageIndex = 0; imageIndex < count; imageIndex += 1) {
    append('immersion', baseImmersionMs + (imageIndex < remainderMs ? 1 : 0), imageIndex);
    if (imageIndex < count - 1) append('transition', BETWEEN_IMAGES_MS, imageIndex + 1);
  }
  for (const [kind, duration] of FIXED_TAIL) {
    append(kind, duration, kind === 'finalHold' ? count - 1 : undefined);
  }

  return { durationMs, segments };
}

/** Returns the active segment; boundaries belong to the segment that starts there. */
export function cinematicSegmentAt(timeline: CinematicTimeline, elapsedMs: number): CinematicSegment {
  'worklet';
  const elapsed = Math.max(0, Math.min(timeline.durationMs, elapsedMs));
  for (let index = 0; index < timeline.segments.length; index += 1) {
    const segment = timeline.segments[index];
    if (elapsed < segment.endMs || index === timeline.segments.length - 1) return segment;
  }
  return timeline.segments[timeline.segments.length - 1];
}
