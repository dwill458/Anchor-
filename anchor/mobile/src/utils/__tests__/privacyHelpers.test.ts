import { redactAnchor, redactAnchors } from '../privacyHelpers';
import type { Anchor } from '@/types';

describe('privacyHelpers', () => {
  const mockBaseAnchor: Anchor = {
    id: 'test-anchor-id-123456',
    userId: 'user-1',
    intentionText: 'I want to build a successful startup',
    category: 'career',
    distilledLetters: ['B', 'L', 'D'],
    isCharged: true,
    activationCount: 5,
    enhancedImageUrl: 'https://example.com/image.png',
    baseSigilSvg: '<svg>sigil</svg>',
    structureVariant: 'balanced',
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
  };

  describe('redactAnchor', () => {
    it('redacts intentionText and maps a known category to its label', () => {
      const result = redactAnchor(mockBaseAnchor);

      // intentionText should be omitted from RedactedAnchor
      expect((result as any).intentionText).toBeUndefined();
      expect(result.id).toBe(mockBaseAnchor.id);
      expect(result.displayLabel).toBe('Career Anchor');
      expect(result.category).toBe('career');
      expect(result.isCharged).toBe(true);
      expect(result.activationCount).toBe(5);
      expect(result.enhancedImageUrl).toBe('https://example.com/image.png');
      expect(result.baseSigilSvg).toBe('<svg>sigil</svg>');
      expect(result.createdAt).toBe(mockBaseAnchor.createdAt);
    });

    it('handles a custom category that is not in the predefined map', () => {
      const customAnchor: Anchor = {
        ...mockBaseAnchor,
        category: 'fitness' as any,
      };

      const result = redactAnchor(customAnchor);
      expect(result.displayLabel).toBe('fitness Anchor');
      expect(result.category).toBe('fitness');
    });

    it('falls back to ID snippet if category is missing or null', () => {
      const noCategoryAnchor: Anchor = {
        ...mockBaseAnchor,
        category: undefined as any,
      };

      const result = redactAnchor(noCategoryAnchor);
      // The last 6 characters of 'test-anchor-id-123456' is '123456'
      expect(result.displayLabel).toBe('Anchor #123456');
      expect(result.category).toBeUndefined();
    });
  });

  describe('redactAnchors', () => {
    it('redacts an array of anchors correctly', () => {
      const anchors: Anchor[] = [
        {
          ...mockBaseAnchor,
          id: 'anchor-career-999999',
          category: 'career',
        },
        {
          ...mockBaseAnchor,
          id: 'anchor-health-888888',
          category: 'health',
        },
        {
          ...mockBaseAnchor,
          id: 'anchor-nocat-777777',
          category: undefined as any,
        },
      ];

      const results = redactAnchors(anchors);

      expect(results).toHaveLength(3);
      expect(results[0].displayLabel).toBe('Career Anchor');
      expect(results[0].id).toBe('anchor-career-999999');
      expect(results[1].displayLabel).toBe('Health Anchor');
      expect(results[1].id).toBe('anchor-health-888888');
      expect(results[2].displayLabel).toBe('Anchor #777777');
      expect(results[2].id).toBe('anchor-nocat-777777');
    });
  });
});
