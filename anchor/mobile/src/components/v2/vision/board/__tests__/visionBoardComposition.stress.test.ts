import type { V2VisionTile, VisionBoardLayout, VisionNote } from '@/adapters/v2/vision';
import { composeVisionBoard } from '../visionBoardComposition';
import { selectSlotBoardLayout, slotBoardHeightRatio, toSceneRect, VISION_BOARD_PAPER_MARK_SCALE } from '../visionBoardLayouts';
import { defaultVisionNoteOccupancy, nextVisionNotePresentation, visionBoardAspectForCount } from '../../notes/visionNotePlacement';

type Point = { x: number; y: number };
type Polygon = Point[];
const EPSILON = 1e-6;
function rotatedRect(cx: number, cy: number, width: number, height: number, degrees: number): Polygon {
  const angle = degrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]
    .map(([x, y]) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }));
}
/** Separating-axis test: rotated AABBs alone would report false intersections. */
function polygonsIntersect(a: Polygon, b: Polygon) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i], next = polygon[(i + 1) % polygon.length];
    const length = Math.hypot(next.x - p.x, next.y - p.y);
    const axis = { x: -(next.y - p.y) / length, y: (next.x - p.x) / length };
    const projectedA = a.map(point => point.x * axis.x + point.y * axis.y);
    const projectedB = b.map(point => point.x * axis.x + point.y * axis.y);
    if (Math.max(...projectedA) <= Math.min(...projectedB) + EPSILON || Math.max(...projectedB) <= Math.min(...projectedA) + EPSILON) return false;
  }
  return true;
}
function polygonIntersectsCircle(polygon: Polygon, center: Point, radius: number) {
  const crosses = polygon.map((p, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return (next.x - p.x) * (center.y - p.y) - (next.y - p.y) * (center.x - p.x);
  });
  if (crosses.every(value => value >= 0) || crosses.every(value => value <= 0)) return true;
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i], next = polygon[(i + 1) % polygon.length], dx = next.x - p.x, dy = next.y - p.y;
    const t = Math.max(0, Math.min(1, ((center.x - p.x) * dx + (center.y - p.y) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(center.x - p.x - t * dx, center.y - p.y - t * dy) < radius - EPSILON) return true;
  }
  return false;
}
function insideCanvas(polygon: Polygon, width: number, height: number) {
  return polygon.every(p => p.x >= -EPSILON && p.y >= -EPSILON && p.x <= width + EPSILON && p.y <= height + EPSILON);
}

function tiles(count: number, caption: string): V2VisionTile[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index}`, sceneId: `photo-${index}`, imageUrl: `https://cdn.test/persisted-${index}.jpg`,
    sourceType: index % 2 ? 'USER_UPLOAD' : 'AI_GENERATED', caption, prompt: `Original prompt ${index}`,
    slotIndex: index, sortOrder: index, isHero: index === 0,
    focal: { x: .15 + index * .08, y: .85 - index * .08 },
  }));
}
function note(index: number): VisionNote {
  const positions = [{ x: .12, y: .22 }, { x: .5, y: .75 }, { x: .86, y: .9 }];
  return {
    id: `note-${index}`, visionId: 'persisted-vision', content: { text: `My original note ${index}` },
    presentation: {
      styleId: index % 2 ? 'paper_ivory_torn' : 'sticky_butter_yellow', fontId: index % 2 ? 'classic' : 'handwritten',
      ...positions[index], width: .16, height: .12, scale: 1, rotation: 0, layerOrder: index,
    },
    layoutPositions: index % 2 ? { EDITORIAL: { x: .5, y: 5.2 }, SCRAPBOOK: { x: .7, y: 5.3 } } : null,
    isArchived: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  };
}
const captionModes = [
  { name: 'short', text: 'A future I love' },
  { name: '80 characters', text: 'I choose a life with room for my family, creative work and peaceful ordinary days. '.slice(0, 80) },
];
const noteConfigurations = [
  { name: 'no notes', value: [] as VisionNote[] },
  { name: 'one note', value: [note(0)] },
  { name: 'three notes with saved layout positions', value: [note(0), note(1), note(2)] },
];
const cases = (['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as VisionBoardLayout[]).flatMap(boardLayout =>
  Array.from({ length: 8 }, (_, i) => i + 1).flatMap(count => [336, 366, 406].flatMap(width => [1, 1.3].flatMap(fontScale =>
    captionModes.flatMap(caption => noteConfigurations.map(notes => ({
      title: `${boardLayout}; ${count} photos; width ${width}; font ${fontScale}; ${caption.name}; ${notes.name}`,
      boardLayout, count, width, fontScale, caption: caption.text, notes: notes.value,
    })))))));

describe('Vision shared composition collision stress matrix', () => {
  it('keeps the native eight-photo recovery fixture captions clear of all three canonical notes', () => {
    const notes: VisionNote[]=[];
    for(let i=0;i<3;i++)notes.push({...note(i),presentation:nextVisionNotePresentation(i?'sticky_butter_yellow':'sticky_blush_pink',notes,defaultVisionNoteOccupancy(8),visionBoardAspectForCount(8))});
    const board=composeVisionBoard({tiles:tiles(8,'Every ordinary day I choose a life with room for what matters most to me.'),notes,width:387.4,boardLayout:'CLASSIC'});
    for(const p of board.layout.photos){
      const c=p.caption;if(!c)continue;
      const r=toSceneRect(p,board.size),a=r.rotation*Math.PI/180;
      const dx=(c.left+c.width/2)*board.size.width-r.width/2,dy=(c.top+c.height/2)*board.size.width-r.height/2;
      const polygon=rotatedRect(r.x+r.width/2+dx*Math.cos(a)-dy*Math.sin(a),r.y+r.height/2+dx*Math.sin(a)+dy*Math.cos(a),c.width*board.size.width,c.height*board.size.width,r.rotation);
      for(const n of board.notes){const q=n.presentation;
        expect(polygonsIntersect(polygon,rotatedRect(q.x*board.size.width,q.y*board.size.height,q.width*board.size.width*q.scale,q.height*board.size.height*q.scale,q.rotation))).toBe(false);
      }
    }
  });
  it('covers exactly the specified 864 boards and 80-character stress captions', () => {
    expect(cases).toHaveLength(864);
    expect(captionModes[1].text).toHaveLength(80);
  });

  it.each(cases)('$title', ({ boardLayout, count, width, fontScale, caption, notes }) => {
    const photographs = tiles(count, caption), source = JSON.stringify({ photographs, notes });
    const board = composeVisionBoard({ tiles: photographs, notes, width, fontScale, boardLayout });
    const occupied = board.slotMap.flatMap((id, slot) => id ? [{ id, slot, rect: toSceneRect(board.layout.photos[slot], board.size) }] : []);
    const mounts = occupied.map(({ id, slot, rect }) => {
      const p = board.layout.photos[slot];
      // Snap/polaroid paper extends below its original frame. The renderer now
      // explicitly keeps transformOrigin at the original print center.
      const extra = (p.caption?.extra ?? 0) * width;
      const mountHeight = rect.height + (p.treatment === 'snap' || p.treatment === 'polaroid' ? extra : 0);
      const parentCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const angle = rect.rotation * Math.PI / 180, dy = (mountHeight - rect.height) / 2;
      return { id, polygon: rotatedRect(parentCenter.x - dy * Math.sin(angle), parentCenter.y + dy * Math.cos(angle), rect.width, mountHeight, rect.rotation) };
    });
    const card = toSceneRect(board.layout.card, board.size);
    const seal = { x: card.x + card.width / 2, y: card.y + card.height / 2, radius: card.width * VISION_BOARD_PAPER_MARK_SCALE / 2 };
    const projectedNotes = board.notes.map(value => {
      const p = value.presentation;
      return { id: value.id, polygon: rotatedRect(p.x * width, p.y * board.size.height, p.width * width * p.scale, p.height * board.size.height * p.scale, p.rotation) };
    });
    const problems: string[] = [];
    for (const mount of mounts) if (!insideCanvas(mount.polygon, width, board.size.height)) problems.push(`${mount.id} mount outside canvas`);
    const captionPolygons = occupied.flatMap(({ id, slot, rect }) => {
      const c = board.layout.photos[slot].caption;
      if (!c) { problems.push(`${id} lost caption`); return []; }
      const parentHeight = rect.height;
      const center = { x: rect.x + rect.width / 2, y: rect.y + parentHeight / 2 };
      const dx = (c.left + c.width / 2) * width - rect.width / 2;
      const dy = (c.top + c.height / 2) * width - parentHeight / 2;
      const angle = rect.rotation * Math.PI / 180;
      const polygon = rotatedRect(center.x + dx * Math.cos(angle) - dy * Math.sin(angle), center.y + dx * Math.sin(angle) + dy * Math.cos(angle), c.width * width, c.height * width, rect.rotation);
      if (!insideCanvas(polygon, width, board.size.height)) problems.push(`${id} caption outside canvas`);
      for (const mount of mounts) if (mount.id !== id && polygonsIntersect(polygon, mount.polygon)) problems.push(`${id} caption intersects ${mount.id} mount`);
      if (polygonIntersectsCircle(polygon, seal, seal.radius)) problems.push(`${id} caption intersects Anchor disc`);
      for (const projected of projectedNotes) if (polygonsIntersect(polygon, projected.polygon)) problems.push(`${id} caption intersects ${projected.id}`);
      return [{ id, polygon }];
    });
    for (let i = 0; i < captionPolygons.length; i += 1) for (let j = i + 1; j < captionPolygons.length; j += 1)
      if (polygonsIntersect(captionPolygons[i].polygon, captionPolygons[j].polygon)) problems.push(`${captionPolygons[i].id} caption intersects ${captionPolygons[j].id} caption`);
    expect(JSON.stringify({ photographs, notes })).toBe(source);
    expect(board.slotMap.filter(Boolean)).toEqual(photographs.map(photo => photo.sceneId));
    expect(board.notes.map(value => ({ id: value.id, content: value.content, styleId: value.presentation.styleId, fontId: value.presentation.fontId })))
      .toEqual(notes.map(value => ({ id: value.id, content: value.content, styleId: value.presentation.styleId, fontId: value.presentation.fontId })));
    expect(problems).toEqual([]);
  });

  it.each(Array.from({ length: 8 }, (_, i) => i + 1))('preserves every existing captionless Classic slot with %s photos', count => {
    const input = tiles(count, '');
    const board = composeVisionBoard({ tiles: input, width: 366, boardLayout: 'CLASSIC' });
    const legacy = selectSlotBoardLayout(slotBoardHeightRatio(count - 1));
    const legacySize = { width: 366, height: 366 * slotBoardHeightRatio(count - 1) };
    for (let slot = 0; slot < count; slot += 1) expect(toSceneRect(board.layout.photos[slot], board.size)).toEqual(toSceneRect(legacy.photos[slot], legacySize));
    expect(toSceneRect(board.layout.card, board.size)).toEqual(toSceneRect(legacy.card, legacySize));
  });
});
