export type VisionStatus = 'ACTIVE' | 'ARCHIVED';

export type VisionSceneSource = 'USER_UPLOAD' | 'AI_GENERATED';

export interface VisionSceneReadModel {
  id: string;
  visionId: string;
  sourceType: VisionSceneSource;
  assetId: string | null;
  resolvedImageUrl: string | null;
  prompt: string | null;
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
  scenes: VisionSceneReadModel[];
  seenToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface V2VisionTile {
  id: string;
  sceneId: string;
  imageUrl: string | null;
  prompt: string | null;
  sortOrder: number;
  isHero: boolean;
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
