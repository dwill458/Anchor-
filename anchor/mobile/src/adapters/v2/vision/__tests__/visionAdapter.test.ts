import {
  toV2VisionPresentationState,
  toV2VisionCompactState,
  toVisualizeHandoff,
} from '../visionAdapter';
import type { VisionReadModel } from '../types';

describe('visionAdapter', () => {
  const mockVision: VisionReadModel = {
    id: 'vision-123',
    anchorId: 'anchor-456',
    title: 'Future Studio',
    description: 'A sunlit workspace where I create daily.',
    status: 'ACTIVE',
    seenToday: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    scenes: [
      {
        id: 'scene-1',
        visionId: 'vision-123',
        sourceType: 'USER_UPLOAD',
        assetId: 'asset-1',
        resolvedImageUrl: 'https://cdn.example.com/scene-1.jpg',
        prompt: 'Main desk',
        sortOrder: 0,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'scene-2',
        visionId: 'vision-123',
        sourceType: 'AI_GENERATED',
        assetId: 'asset-2',
        resolvedImageUrl: 'https://cdn.example.com/scene-2.jpg',
        prompt: 'Morning sun',
        sortOrder: 1,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  };

  describe('toV2VisionPresentationState', () => {
    it('returns state none when raw vision is null or undefined', () => {
      expect(toV2VisionPresentationState(null, 'anchor-456')).toEqual({
        state: 'none',
        anchorId: 'anchor-456',
      });
      expect(toV2VisionPresentationState(undefined, 'anchor-456')).toEqual({
        state: 'none',
        anchorId: 'anchor-456',
      });
    });

    it('returns state none when vision is ARCHIVED', () => {
      const archived: VisionReadModel = { ...mockVision, status: 'ARCHIVED' };
      expect(toV2VisionPresentationState(archived, 'anchor-456')).toEqual({
        state: 'none',
        anchorId: 'anchor-456',
      });
    });

    it('returns state none when all scenes are archived', () => {
      const allArchived: VisionReadModel = {
        ...mockVision,
        scenes: mockVision.scenes.map((s) => ({ ...s, isArchived: true })),
      };
      expect(toV2VisionPresentationState(allArchived, 'anchor-456')).toEqual({
        state: 'none',
        anchorId: 'anchor-456',
      });
    });

    it('returns state ready with tiles and hero marked', () => {
      const state = toV2VisionPresentationState(mockVision, 'anchor-456');
      expect(state.state).toBe('ready');
      if (state.state === 'ready') {
        expect(state.visionId).toBe('vision-123');
        expect(state.description).toBe('A sunlit workspace where I create daily.');
        expect(state.tiles).toHaveLength(2);
        expect(state.tiles[0].isHero).toBe(true);
        expect(state.tiles[1].isHero).toBe(false);
        expect(state.featuredTileId).toBe('scene-1');
        expect(state.seenToday).toBe(false);
      }
    });

    it('returns state error when error is provided', () => {
      const state = toV2VisionPresentationState(null, 'anchor-456', {
        error: 'Network failure',
        isOffline: true,
      });
      expect(state).toEqual({
        state: 'error',
        anchorId: 'anchor-456',
        message: 'Network failure',
        isOffline: true,
      });
    });
  });

  describe('toV2VisionCompactState', () => {
    it('returns state none when raw is null or archived', () => {
      expect(toV2VisionCompactState(null)).toEqual({ state: 'none' });
      expect(toV2VisionCompactState({ ...mockVision, status: 'ARCHIVED' })).toEqual({
        state: 'none',
      });
    });

    it('returns state ready with previewText and heroImageUrl', () => {
      const compact = toV2VisionCompactState(mockVision);
      expect(compact).toEqual({
        state: 'ready',
        visionId: 'vision-123',
        previewText: 'A sunlit workspace where I create daily.',
        heroImageUrl: 'https://cdn.example.com/scene-1.jpg',
        seenToday: false,
        tileCount: 2,
      });
    });
  });

  describe('toVisualizeHandoff', () => {
    it('returns empty handoff when vision does not exist', () => {
      expect(toVisualizeHandoff(null)).toEqual({
        visionId: null,
        activeVisionAsset: null,
        seenToday: false,
        hasVision: false,
      });
    });

    it('returns activeVisionAsset and visionId when vision exists', () => {
      expect(toVisualizeHandoff(mockVision)).toEqual({
        visionId: 'vision-123',
        activeVisionAsset: 'https://cdn.example.com/scene-1.jpg',
        seenToday: false,
        hasVision: true,
      });
    });
  });
});
