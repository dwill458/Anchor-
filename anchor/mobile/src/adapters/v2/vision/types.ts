export type VisionStatus = 'ACTIVE' | 'ARCHIVED';
export const VISION_BOARD_LAYOUTS = ['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const;
export type VisionBoardLayout = typeof VISION_BOARD_LAYOUTS[number];
export type VisionNoteLayoutPositions = Partial<Record<'EDITORIAL' | 'SCRAPBOOK', { x: number; y: number } | null>>;

/** Where a board image came from: the person's library, their camera, or the image generator. */
export type VisionSceneSource = 'USER_UPLOAD' | 'AI_GENERATED' | 'USER_CAMERA';

/** Stable note material IDs. Presets are presentation choices, not note content. */
export type VisionNoteStyleId =
  | 'sticky_blush_pink' | 'sticky_butter_yellow' | 'sticky_sky_blue' | 'sticky_sage_green' | 'sticky_lavender' | 'sticky_peach' | 'sticky_warm_ivory' | 'sticky_rose_lined'
  | 'paper_ivory_torn' | 'paper_aged_parchment' | 'paper_handmade_cream' | 'paper_blush_torn' | 'paper_sage_handmade' | 'paper_white_deckled'
  | 'editorial_classic_cream' | 'editorial_powder_blue' | 'editorial_minimal_quote' | 'editorial_botanical_shadow' | 'editorial_coastal_illustration' | 'editorial_atmospheric_landscape'
  | 'editorial_vintage_letter' | 'editorial_golden_hour' | 'editorial_misty_mountains' | 'editorial_rose_editorial' | 'editorial_architectural' | 'editorial_midnight_editorial';

export type VisionNoteFontId = 'handwritten' | 'classic' | 'modern';

export const VISION_NOTE_MAX_CHARS = 200;
export const VISION_NOTE_MAX_ACTIVE = 24;

/** Board-relative geometry uses normalized center coordinates and dimensions. */
export interface VisionNotePresentation {
  styleId: VisionNoteStyleId;
  /** Optional for compatibility; older notes use the font defined by their material. */
  fontId?: VisionNoteFontId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  layerOrder: number;
}

/** Additive read-only contract for future persisted Vision notes. */
export interface VisionNote {
  id: string;
  visionId: string;
  content: { text: string };
  presentation: VisionNotePresentation;
  layoutPositions?: VisionNoteLayoutPositions | null;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisionSceneReadModel {
  id: string;
  visionId: string;
  sourceType: VisionSceneSource;
  assetId: string | null;
  resolvedImageUrl: string | null;
  prompt: string | null;
  /** Absent on responses from servers predating scene captions. */
  caption?: string | null;
  /** The board slot (0-7) this image sits in. Absent from servers predating slots; the client then places it. */
  slotIndex?: number | null;
  /** Where the image sits inside its print, 0..1 along each overflowing axis. Absent when never set. */
  focal?: { x: number; y: number } | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisionReadModel {
  id: string;
  anchorId: string;
  title: string | null;
  description: string | null;
  status: VisionStatus;
  boardLayout?: VisionBoardLayout;
  scenes: VisionSceneReadModel[];
  /** Optional for compatibility with servers and cached reads predating notes. */
  notes?: VisionNote[];
  seenToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface V2VisionTile {
  id: string;
  sceneId: string;
  imageUrl: string | null;
  prompt: string | null;
  caption?: string | null;
  slotIndex?: number | null;
  focal?: { x: number; y: number } | null;
  sortOrder: number;
  isHero: boolean;
  sourceType?: VisionSceneSource;
}

export type V2VisionPresentationState =
  | { state: 'none'; anchorId: string }
  | { state: 'loading'; anchorId: string }
  | {
      state: 'ready';
      anchorId: string;
      visionId: string;
      title: string | null;
      description: string;
      tiles: V2VisionTile[];
      featuredTileId: string;
      seenToday: boolean;
      raw: VisionReadModel;
    }
  | { state: 'error'; anchorId: string; message: string; isOffline?: boolean };

export type V2VisionCompactState =
  | { state: 'none' }
  | {
      state: 'ready';
      visionId: string;
      previewText: string;
      heroImageUrl?: string | null;
      seenToday: boolean;
      tileCount: number;
    };

export interface V2VisualizeHandoff {
  visionId: string | null;
  activeVisionAsset: string | null;
  seenToday: boolean;
  hasVision: boolean;
}

/** Navigation-only snapshot of the board being left; never written back as a composition. */
export interface VisionVisualizeEntry {
  anchorId: string;
  visionId: string;
  tiles: V2VisionTile[];
  notes: VisionNote[];
  boardLayout?: VisionBoardLayout;
  layoutWidth?: number;
  sourceFrame?: { x: number; y: number; width: number; height: number; sceneWidth?: number; sceneHeight?: number };
}
