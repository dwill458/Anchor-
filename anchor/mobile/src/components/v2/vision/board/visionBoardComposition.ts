import type {
  V2VisionTile,
  VisionNote,
  VisionNotePresentation,
  VisionBoardLayout,
} from '@/adapters/v2/vision';
import { assignmentsFromMap, resolveSlotMap } from './visionBoardSlots';
import {
  detailBoardSizeForWidth,
  selectSlotBoardLayout,
  slotBoardHeightRatio,
  toSceneRect,
  VISION_BOARD_PAPER_MARK_SCALE,
  type BoardCaption,
  type BoardLayout,
  type BoardSlot,
} from './visionBoardLayouts';
import { estimateCaptionLines } from './visionCaptionLayout';
import { VISION_CAPTION_FONTS } from '../material/visionMaterialTokens';
import { clampVisionNotePresentationForAspect } from '../notes/visionNotePlacement';

const ROW = [0, 1, 1, 2, 2, 3, 4, 4];
const ROW_Y = [0.37, 0.95, 1.445, 1.75, 2.12];
type RowItem = readonly [number, number, number, number, number?, number?];
const EDITORIAL: readonly (readonly RowItem[])[] = [
  [[0, 0.5, 0.92, 1.75]],
  [
    [1, 0.27, 0.44, 0.8],
    [2, 0.73, 0.44, 0.8],
  ],
  [
    [3, 0.27, 0.44, 1.3],
    [4, 0.73, 0.44, 1.3],
  ],
  [[5, 0.5, 0.92, 2]],
  [
    [6, 0.27, 0.44, 0.8],
    [7, 0.73, 0.44, 0.8],
  ],
];
const SCRAPBOOK: readonly (readonly RowItem[])[] = [
  [[0, 0.46, 0.78, 1.25, -2.5]],
  [
    [1, 0.26, 0.44, 0.82, 4, 0.02],
    [2, 0.75, 0.42, 1, -5],
  ],
  [
    [3, 0.3, 0.5, 1.3, -3],
    [-1, 0.76, 0.3, 1, 6, 0.05],
  ],
  [
    [4, 0.74, 0.4, 0.85, 5],
    [5, 0.26, 0.44, 0.9, 3, 0.05],
  ],
  [
    [6, 0.72, 0.42, 1.2, -4],
    [7, 0.28, 0.42, 1, 2, 0.03],
  ],
];
export type CaptionMeasurement = {
  key: string;
  text: string;
  width: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing: number;
};
type Input = {
  tiles: readonly V2VisionTile[];
  notes?: readonly VisionNote[];
  width: number;
  boardLayout?: VisionBoardLayout;
  slotMap?: readonly (string | null)[];
  reserve?: boolean;
  fontScale?: number;
  measured?: Readonly<Record<string, number>>;
};
export type VisionBoardComposition = ReturnType<typeof composeVisionBoard>;

function bounds(x: number, y: number, w: number, h: number, rotation: number) {
  const a = (rotation * Math.PI) / 180,
    rw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)),
    rh = Math.abs(h * Math.cos(a)) + Math.abs(w * Math.sin(a));
  return {
    left: x - rw / 2,
    right: x + rw / 2,
    top: y - rh / 2,
    bottom: y + rh / 2,
  };
}
const intersects = (
  a: ReturnType<typeof bounds>,
  b: ReturnType<typeof bounds>,
) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function printBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  extra = 0,
) {
  const a = (rotation * Math.PI) / 180;
  return bounds(
    x - (Math.sin(a) * extra) / 2,
    y + (Math.cos(a) * extra) / 2,
    w,
    h + extra,
    rotation,
  );
}

/** Geometry alone: no image generation, persistence, renderer, camera or per-frame work. */
export function composeVisionBoard(input: Input) {
  const { tiles, notes = [], measured = {}, reserve = false } = input;
  const width = Math.max(1, input.width),
    boardLayout = input.boardLayout ?? 'CLASSIC';
  const fontScale = Math.max(1, Math.min(1.3, input.fontScale ?? 1));
  const canonical = Object.fromEntries(
    tiles
      .filter((t) => t.slotIndex != null)
      .map((t) => [t.sceneId, t.slotIndex!]),
  );
  const savedSlots = input.slotMap;
  const slotMap = resolveSlotMap(
    tiles.map((t) => t.sceneId),
    savedSlots ? assignmentsFromMap(savedSlots) : canonical,
  );
  const bySlot = slotMap.map((id) => tiles.find((tile) => tile.sceneId === id));
  const lastSlot = slotMap.reduce((last, id, i) => (id ? i : last), -1);
  const baseRatio = slotBoardHeightRatio(lastSlot, reserve);
  const classic = selectSlotBoardLayout(baseRatio);
  const shifts = [0, 0, 0, 0, 0];
  const measurements: CaptionMeasurement[] = [];
  const captions = (
    slot: number,
    w: number,
    h: number,
    treatment: BoardSlot['treatment'],
    labelFraction = 0.78,
  ): BoardCaption | undefined => {
    const raw = bySlot[slot]?.caption?.trim();
    if (!raw) return undefined;
    const editorial = treatment === 'flat',
      label = treatment === 'torn' || treatment === 'print';
    const text = editorial ? raw.toUpperCase() : raw;
    const fontFamily = editorial
      ? 'Inter-SemiBold'
      : VISION_CAPTION_FONTS.handwritten;
    const textWidth = editorial
      ? w
      : label
        ? w * labelFraction - 18 / width
        : w * 0.84;
    let fs =
      (editorial
        ? 10.5
        : treatment === 'snap'
          ? 15
          : w >= 0.45
            ? 16
            : w >= 0.42
              ? 15
              : 14) * fontScale;
    while (
      !editorial &&
      estimateCaptionLines(text, fs, textWidth * width) > 4 &&
      fs > 13 * fontScale
    )
      fs = Math.max(13 * fontScale, fs - 1);
    const lineHeight = fs * (editorial ? 1.38 : 1.18);
    const key = JSON.stringify([
      text,
      textWidth * width,
      fs,
      lineHeight,
      fontFamily,
    ]);
    measurements.push({
      key,
      text,
      width: textWidth * width,
      fontSize: fs,
      lineHeight,
      fontFamily,
      letterSpacing: editorial ? fs * 0.1 : 0,
    });
    const textHeight =
      (measured[key] ??
        estimateCaptionLines(text, fs, textWidth * width) * lineHeight) / width;
    const capHeight = textHeight + (editorial ? 0 : 8 / width);
    const capWidth = textWidth + (label ? 18 / width : 0);
    const top = editorial
      ? h + 7 / width
      : label
        ? h - capHeight * 0.62
        : treatment === 'snap'
          ? h - 0.17 * w
          : h * 0.78;
    const extra = editorial
      ? capHeight + 7 / width
      : label
        ? 0
        : Math.max(0, capHeight + 6 / width - (h - top));
    return {
      key,
      text,
      fontFamily,
      kind: editorial ? 'editorial' : label ? 'label' : 'band',
      fontSize: fs / width,
      lineHeight: lineHeight / width,
      width: capWidth,
      height: capHeight,
      left: (w - capWidth) / 2,
      top,
      extra,
    };
  };
  // Work in board-width units; normalize y only once, after caption growth determines the canvas height.
  let photos: BoardSlot[] = [],
    card = { ...classic.card, y: 0.965 },
    ratio = baseRatio;
  let decor = classic.decor;
  if (boardLayout === 'CLASSIC') {
    photos = classic.photos.map((p, i) => ({
      ...p,
      y: p.y * baseRatio,
      apertureBottom: bySlot[i]?.caption?.trim()?.length
        ? 0.78
        : i === 3
          ? 0.7
          : 0.78,
      caption: captions(i, p.width, p.width / p.aspectRatio, p.treatment),
    }));
    // Paper labels share a top layer. Search their own photograph first; only a collision
    // with a later row may grow Classic. The saved slots and note coordinates never change.
    const localBounds = (p: BoardSlot, c: BoardCaption) => {
      const h = p.width / p.aspectRatio,
        a = (p.rotation * Math.PI) / 180;
      const dx = c.left + c.width / 2 - p.width / 2,
        dy = c.top + c.height / 2 - h / 2;
      return bounds(
        p.x + dx * Math.cos(a) - dy * Math.sin(a),
        p.y + dx * Math.sin(a) + dy * Math.cos(a),
        c.width,
        c.height,
        p.rotation,
      );
    };
    const noteRatio = detailBoardSizeForWidth(1, tiles.length).height;
    const noteShift = (y: number) => {
      if (y <= ROW_Y[0]) return shifts[0];
      for (let row = 1; row < 5; row++)
        if (y < ROW_Y[row])
          return (
            shifts[row - 1] +
            ((shifts[row] - shifts[row - 1]) * (y - ROW_Y[row - 1])) /
              (ROW_Y[row] - ROW_Y[row - 1])
          );
      return shifts[4];
    };
    for (let pass = 0; pass < 60; pass++) {
      let push = -1;
      const placed: ReturnType<typeof bounds>[] = [];
      for (let i = 0; i < 8; i++) {
        const original = photos[i],
          initial = original.caption;
        if (!slotMap[i] || !initial) continue;
        const p = { ...original, y: original.y + shifts[ROW[i]] },
          h = p.width / p.aspectRatio;
        const movableNotes = new Set<ReturnType<typeof bounds>>();
        const seal = card.width * VISION_BOARD_PAPER_MARK_SCALE;
        const obstacles = photos
          .flatMap((other, j) =>
            j !== i && slotMap[j]
              ? [
                  {
                    rect: bounds(
                      other.x,
                      other.y + shifts[ROW[j]],
                      other.width,
                      other.width / other.aspectRatio +
                        (other.caption?.kind === 'band'
                          ? other.caption.extra
                          : 0),
                      other.rotation,
                    ),
                    row: ROW[j],
                  },
                ]
              : [],
          )
          .concat(
            [
              {
                rect: bounds(card.x, card.y + shifts[1], seal, seal, 0),
                row: 1,
              },
            ],
            placed.map((rect) => ({ rect, row: -1 })),
          )
          .concat(
            notes
              .filter((note) => !note.isArchived)
              .map((note) => {
                const n = note.presentation,
                  y = n.y * noteRatio;
                const rect = bounds(
                    n.x,
                    y + noteShift(y),
                    n.width * n.scale,
                    n.height * noteRatio * n.scale,
                    n.rotation,
                  );
                if (ROW[i] < 4 && y >= ROW_Y[ROW[i]] + 0.35 * (ROW_Y[ROW[i] + 1] - ROW_Y[ROW[i]])) movableNotes.add(rect);
                return { rect, row: -1 };
              }),
          );
        const currentBounds = localBounds(p, initial);
        const initialHits = obstacles.filter((o) =>
          intersects(o.rect, currentBounds),
        );
        if (initial.kind === 'band' && !initialHits.length) {
          placed.push(currentBounds);
          continue;
        }
        let best:
          | {
              caption: BoardCaption;
              rect: ReturnType<typeof bounds>;
              hits: typeof obstacles;
              score: number;
            }
          | undefined;
        for (const fraction of [0.78, 0.64, 0.52]) {
          const variant = captions(i, p.width, h, 'torn', fraction)!;
          const positions = [
            h + variant.height * 0.5 - 0.012,
            h + variant.height * 0.22,
            h - variant.height * 0.12,
          ];
          for (
            let cy = h - variant.height * 0.47;
            cy - variant.height / 2 >= 0.01;
            cy -= variant.height * 0.35
          )
            positions.push(cy);
          for (const left of [
            (p.width - variant.width) / 2,
            0.04 * p.width,
            p.width - variant.width - 0.04 * p.width,
          ]) {
            for (const cy of positions) {
              const candidate = {
                ...variant,
                left,
                top: cy - variant.height / 2,
                kind: 'label' as const,
                extra: 0,
              };
              const rect = localBounds(p, candidate);
              const hits = obstacles.filter((o) => intersects(o.rect, rect));
              // Covering the photograph is heavily penalized: it must never beat pushing rows/notes down.
              const covered = Math.min(1, Math.max(0, h - candidate.top) / candidate.height);
              const hitCost = hits.reduce(
                (sum, o) => sum + (o.row > ROW[i] || movableNotes.has(o.rect) ? 1 : 50),
                0,
              );
              const coverCost = covered > 0.35 ? 15 + covered * 5 : covered * 0.5;
              const score =
                coverCost +
                hitCost +
                (rect.left < 0 || rect.right > 1 || rect.top < 0 ? 100 : 0);
              if (!best || score < best.score)
                best = { caption: candidate, rect, hits, score };
              if (score === 0) break;
            }
            if (best?.score === 0) break;
          }
          if (best && best.score < 1) break;
        }
        if (best) {
          original.caption = best.caption;
          placed.push(best.rect);
          // Only grow for a note when every available position remains blocked;
          // prefer existing clear caption positions before changing row spacing.
          const blockedByMovableNotes =
            best.hits.length > 0 && best.hits.some((o) => movableNotes.has(o.rect));
          const hitsBelow = best.hits.some((o) => o.row > ROW[i]);
          if (hitsBelow || blockedByMovableNotes)
            push = push < 0 ? ROW[i] : Math.min(push, ROW[i]);
        }
      }
      if (push < 0) break;
      for (let row = push + 1; row < 5; row++) shifts[row] += 0.04;
    }
    photos = photos.map((p, i) => ({ ...p, y: p.y + shifts[ROW[i]] }));
    card.y += shifts[1];
    const hasCaption = photos.some((p, i) => p.caption && slotMap[i]);
    if (hasCaption)
      ratio = Math.max(
        baseRatio,
        ...photos
          .filter((_, i) => slotMap[i] || reserve)
          .flatMap((p) => [
            printBounds(
              p.x,
              p.y,
              p.width,
              p.width / p.aspectRatio,
              p.rotation,
              p.caption?.kind === 'band' ? p.caption.extra : 0,
            ).bottom + 0.22,
            p.caption ? localBounds(p, p.caption).bottom + 0.05 : 0,
          ]),
      );
  } else {
    let y = boardLayout === 'EDITORIAL' ? 0.03 : 0.04;
    let sealPlaced = false;
    const rows = boardLayout === 'EDITORIAL' ? EDITORIAL : SCRAPBOOK;
    photos = new Array<BoardSlot>(8);
    for (const row of rows) {
      if (!reserve && !row.some(([slot]) => slot < 0 || slotMap[slot]))
        continue;
      let bottom = y;
      for (const [slot, plannedX, w, a, rotation = 0, dy = 0] of row) {
        let x = plannedX;
        if (slot < 0) {
          card = {
            ...card,
            x,
            y: y + dy + w / 2,
            width: w / VISION_BOARD_PAPER_MARK_SCALE,
            rotation,
          };
          sealPlaced = true;
          bottom = Math.max(bottom, y + dy + w);
          continue;
        }
        const h = w / a,
          treatment = boardLayout === 'EDITORIAL' ? 'flat' : 'snap';
        const caption = captions(slot, w, h, treatment);
        // An expanded, tilted paper foot can cross the canvas edge. Move only the minimum
        // necessary to retain that paper; captionless recipes keep their approved positions.
        const edges = printBounds(
          x,
          y + dy + h / 2,
          w,
          h,
          rotation,
          treatment === 'snap' ? (caption?.extra ?? 0) : 0,
        );
        if (edges.left < 0) x -= edges.left;
        if (edges.right > 1) x -= edges.right - 1;
        photos[slot] = {
          x,
          y: y + dy + h / 2,
          width: w,
          aspectRatio: a,
          rotation,
          zIndex: 12 + slot,
          frame: a < 1 ? 'portrait' : 'landscape',
          treatment,
          caption,
        };
        if (slotMap[slot] || reserve)
          bottom = Math.max(
            bottom,
            printBounds(
              x,
              y + dy + h / 2,
              w,
              h,
              rotation,
              treatment === 'snap' ? (caption?.extra ?? 0) : 0,
            ).bottom + (treatment === 'flat' ? (caption?.extra ?? 0) : 0),
          );
      }
      y = bottom + (boardLayout === 'EDITORIAL' ? 0.05 : 0.035);
    }
    for (let i = 0; i < 8; i++)
      if (!photos[i]) photos[i] = { ...classic.photos[i], y: y + 0.3 };
    if (!sealPlaced)
      card = {
        ...card,
        x: 0.5,
        y: y + 0.11,
        width: 0.2 / VISION_BOARD_PAPER_MARK_SCALE,
        rotation: 0,
      };
    ratio =
      Math.max(y, card.y + (card.width * VISION_BOARD_PAPER_MARK_SCALE) / 2) +
      0.12;
    decor =
      boardLayout === 'EDITORIAL'
        ? []
        : photos.map((_, i) => ({
            kind: 'tape' as const,
            photo: i,
            offset: 0.5,
            width: i === 0 ? 0.3 : 0.34,
            rotation: [-4, 5, -6, 3, -3, 4, -5, 2][i],
            tone: i % 3 === 1 ? ('cream' as const) : ('kraft' as const),
          }));
  }
  const noteBaseRatio = detailBoardSizeForWidth(1, tiles.length).height;
  const shiftAt = (y: number) => {
    if (y <= ROW_Y[0]) return shifts[0];
    for (let i = 1; i < 5; i++)
      if (y < ROW_Y[i])
        return (
          shifts[i - 1] +
          ((shifts[i] - shifts[i - 1]) * (y - ROW_Y[i - 1])) /
            (ROW_Y[i] - ROW_Y[i - 1])
        );
    return shifts[4];
  };
  const contentBottom = ratio - 0.1;
  const placedNoteBounds: ReturnType<typeof bounds>[] = [];
  const scrapbookNoteSpot = (
    w: number,
    h: number,
    rotation: number,
    scale: number,
  ) => {
    const diameter = card.width * VISION_BOARD_PAPER_MARK_SCALE;
    const obstacles = photos
      .flatMap((p, i) =>
        slotMap[i]
          ? [
              printBounds(
                p.x,
                p.y,
                p.width,
                p.width / p.aspectRatio,
                p.rotation,
                p.caption?.extra ?? 0,
              ),
            ]
          : [],
      )
      .concat(
        [bounds(card.x, card.y, diameter, diameter, card.rotation)],
        placedNoteBounds,
      );
    let best = { x: 0.5, y: contentBottom + h / 2 + 0.08, score: Infinity };
    for (let y = 0.15; y <= contentBottom + 0.9 + h * notes.length; y += 0.04)
      for (const x of [0.2, 0.5, 0.8]) {
        const candidate = bounds(
          x,
          y,
          w * scale + 0.03,
          h * scale + 0.03,
          rotation,
        );
        if (candidate.left < 0 || candidate.right > 1 || candidate.top < 0)
          continue;
        const overlap = obstacles.reduce(
          (sum, o) =>
            sum +
            Math.max(
              0,
              Math.min(candidate.right, o.right) -
                Math.max(candidate.left, o.left),
            ) *
              Math.max(
                0,
                Math.min(candidate.bottom, o.bottom) -
                  Math.max(candidate.top, o.top),
              ),
          0,
        );
        const score =
          (overlap > 0 ? 1 + overlap * 10 : 0) +
          Math.max(0, candidate.bottom - contentBottom) * 0.4;
        if (score < best.score - 1e-6) best = { x, y, score };
        if (score === 0) return { x, y };
      }
    return { x: best.x, y: best.y };
  };
  const projectedNotes = notes
    .filter((n) => !n.isArchived)
    .map((note, i) => {
      const p = note.presentation,
        saved =
          boardLayout === 'CLASSIC'
            ? null
            : note.layoutPositions?.[boardLayout];
      if (boardLayout === 'CLASSIC') {
        const y = p.y * noteBaseRatio;
        return {
          ...note,
          presentation: {
            ...p,
            y: y + shiftAt(y),
            height: p.height * noteBaseRatio,
          },
        };
      }
      // Original note materials/fonts/content remain canonical; only geometry differs per layout.
      const w = boardLayout === 'EDITORIAL' ? Math.min(0.28, p.width) : p.width;
      const h = p.height * noteBaseRatio * (w / p.width);
      const rotation = boardLayout === 'EDITORIAL' ? 0 : [5, -4, 3, -6][i % 4];
      const spot =
        saved ??
        (boardLayout === 'SCRAPBOOK'
          ? scrapbookNoteSpot(w, h, rotation, p.scale)
          : {
              x: [0.2, 0.5, 0.8][i % 3],
              y: contentBottom + 0.08 + h / 2 + Math.floor(i / 3) * (h + 0.06),
            });
      const geometry = {
        ...spot,
        width: w,
        height: h,
        rotation,
        scale: p.scale,
        layerOrder: p.layerOrder,
      };
      placedNoteBounds.push(
        bounds(geometry.x, geometry.y, w * p.scale, h * p.scale, rotation),
      );
      return { ...note, presentation: { ...p, ...geometry } };
    });
  for (const n of projectedNotes) {
    const p = n.presentation;
    ratio = Math.max(
      ratio,
      bounds(p.x, p.y, p.width * p.scale, p.height * p.scale, p.rotation)
        .bottom + 0.05,
    );
  }
  const layout: BoardLayout = {
    count: 8,
    photos: photos.map((p) => ({ ...p, y: p.y / ratio })),
    card: { ...card, y: card.y / ratio },
    decor,
  };
  return {
    boardLayout,
    layout,
    slotMap,
    order: slotMap.map((id) => id ?? ''),
    size: { width, height: width * ratio },
    ratio,
    noteBaseRatio,
    shifts,
    measurements: [...new Map(measurements.map((m) => [m.key, m])).values()],
    notes: projectedNotes.map((n) => ({
      ...n,
      presentation: {
        ...n.presentation,
        y: n.presentation.y / ratio,
        height: n.presentation.height / ratio,
      },
    })),
  };
}

/** Inverse of the Classic presentation offset: growing captions never rewrites saved note coordinates. */
export function unprojectClassicNote(
  p: VisionNotePresentation,
  composition: VisionBoardComposition,
): VisionNotePresentation {
  const target = p.y * composition.ratio;
  let low = 0,
    high = Math.max(composition.ratio, composition.noteBaseRatio);
  for (let step = 0; step < 40; step++) {
    const mid = (low + high) / 2;
    let shift = composition.shifts[4];
    if (mid <= ROW_Y[0]) shift = composition.shifts[0];
    else
      for (let i = 1; i < 5; i++)
        if (mid < ROW_Y[i]) {
          shift =
            composition.shifts[i - 1] +
            ((composition.shifts[i] - composition.shifts[i - 1]) *
              (mid - ROW_Y[i - 1])) /
              (ROW_Y[i] - ROW_Y[i - 1]);
          break;
        }
    if (mid + shift < target) low = mid;
    else high = mid;
  }
  const unprojected = {
    ...p,
    y: (low + high) / 2 / composition.noteBaseRatio,
    height: (p.height * composition.ratio) / composition.noteBaseRatio,
  };
  return clampVisionNotePresentationForAspect(unprojected, 1);
}
