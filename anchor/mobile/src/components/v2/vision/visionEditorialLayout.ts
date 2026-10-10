import { visionImageRetained } from './visionImageGeometry';

export type VisionEditorialVariant = 'home' | 'details';

/** Read-only subset of existing Vision tiles; no new persisted media contract. */
export type VisionEditorialTile = {
  id: string;
  imageUrl?: string | null;
  caption?: string | null;
  sortOrder?: number;
  isHero?: boolean;
};

export type VisionEditorialImage = {
  tile: VisionEditorialTile;
  imageUrl: string;
  sourceIndex: number;
};

/** Top-left geometry normalized against the preview's stable canvas. */
export type VisionEditorialPhotoSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

/** Only remove recognized authentication fields, preserving proxy IDs and image transforms. */
export function editorialImageIdentity(imageUrl: string): string {
  if (!/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const question = imageUrl.indexOf('?');
  if (question < 0) return imageUrl;
  const hash = imageUrl.indexOf('#', question);
  const fragment = hash < 0 ? '' : imageUrl.slice(hash);
  const query = imageUrl.slice(question + 1, hash < 0 ? undefined : hash);
  const cloudFrontSigned = /(?:^|&)key-pair-id=/i.test(query);
  const supabaseSigned = /\/storage\/v1\/object\/sign\//i.test(imageUrl.slice(0, question));
  const retained = query.split('&').filter(parameter => {
    const key = parameter.split('=')[0].toLowerCase();
    return !/^x-(amz|goog)-/.test(key)
      && !(cloudFrontSigned && /^(signature|expires|key-pair-id|policy)$/.test(key))
      && !(supabaseSigned && key === 'token');
  });
  return imageUrl.slice(0, question) + (retained.length ? `?${retained.join('&')}` : '') + fragment;
}

/** Input already carries the canonical board order. Never mutate or reshuffle it. */
export function selectEditorialImages(
  tiles: readonly VisionEditorialTile[],
  variant: VisionEditorialVariant,
  featuredTileId?: string,
): VisionEditorialImage[] {
  const renderable = tiles.flatMap((tile, sourceIndex) => {
    const imageUrl = tile.imageUrl?.trim();
    return imageUrl ? [{ tile, imageUrl, sourceIndex }] : [];
  });
  const featured = renderable.find(item => item.tile.id === featuredTileId);
  const ordered = featured ? [featured, ...renderable.filter(item => item !== featured)] : renderable;
  const seen = new Set<string>();
  return ordered.filter(item => {
    // Signed URLs rotate on reads, but other query parameters can select different images.
    const path = editorialImageIdentity(item.imageUrl);
    if (seen.has(path)) return false;
    seen.add(path);
    return true;
  }).slice(0, variant === 'home' ? 3 : 5);
}

const single: VisionEditorialPhotoSlot = { x: 0.045, y: 0.07, width: 0.91, height: 0.86, rotation: -0.7, zIndex: 1 };
const hero: VisionEditorialPhotoSlot = { x: 0.04, y: 0.075, width: 0.65, height: 0.86, rotation: -1.2, zIndex: 1 };

/** Small fixed compositions represent the board without shrinking its full renderer. */
export function getEditorialPhotoSlots(variant: VisionEditorialVariant, count: number): VisionEditorialPhotoSlot[] {
  const shown = Math.min(variant === 'home' ? 3 : 5, Math.max(0, Math.floor(count)));
  if (shown === 0) return [];
  if (shown === 1) return [{ ...single }];
  if (shown === 2) return [{ ...hero }, { x: 0.65, y: 0.15, width: 0.30, height: 0.70, rotation: 2, zIndex: 2 }];
  if (variant === 'details' && shown >= 4) {
    return [
      { ...hero, width: 0.59 },
      { x: 0.65, y: 0.065, width: 0.31, height: 0.33, rotation: 1, zIndex: 2 },
      { x: 0.65, y: 0.405, width: 0.31, height: 0.33, rotation: -1, zIndex: 3 },
      { x: 0.65, y: 0.755, width: shown === 4 ? 0.31 : 0.15, height: 0.22, rotation: 1, zIndex: 4 },
      ...(shown === 5 ? [{ x: 0.81, y: 0.755, width: 0.15, height: 0.22, rotation: -1, zIndex: 5 }] : []),
    ];
  }
  const slots: VisionEditorialPhotoSlot[] = [
    { ...hero },
    { x: 0.66, y: 0.065, width: 0.30, height: 0.45, rotation: 1.8, zIndex: 2 },
    { x: 0.65, y: 0.50, width: 0.31, height: 0.45, rotation: -1.5, zIndex: 3 },
  ];
  return slots;
}

/** Unknown subject/dimensions keep the whole photo; no implied face detection. */
export function editorialImageFit(sourceAspect: number, frameAspect: number): 'cover' | 'contain' {
  if (!Number.isFinite(sourceAspect) || sourceAspect <= 0 || !Number.isFinite(frameAspect) || frameAspect <= 0) return 'contain';
  return visionImageRetained(sourceAspect, frameAspect) >= 0.9 ? 'cover' : 'contain';
}
