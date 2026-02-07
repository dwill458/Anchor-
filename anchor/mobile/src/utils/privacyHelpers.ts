/**
 * Anchor App - Privacy Helpers
 *
 * Client-side redaction utilities for privacy-safe anchor display
 * Ensures intentionText is never visible in the profile view
 */

import { Anchor, RedactedAnchor, AnchorCategory } from '../types';

const CATEGORY_LABELS: Record<AnchorCategory, string> = {
  career: 'Career',
  health: 'Health',
  wealth: 'Wealth',
  relationships: 'Relationships',
  personal_growth: 'Personal Growth',
  custom: 'Custom',
};

/**
 * Redacts anchor intentionText for privacy-safe display.
 * Strategy: Category-based labels with ID fallback.
 *
 * Example:
 * - Input: Anchor with category "career" → Output: "Career Anchor"
 * - Input: Anchor without category → Output: "Anchor #abc123"
 *
 * @param anchor - The anchor to redact
 * @returns RedactedAnchor with displayLabel instead of intentionText
 */
export function redactAnchor(anchor: Anchor): RedactedAnchor {
  const categoryLabel = anchor.category
    ? CATEGORY_LABELS[anchor.category] || anchor.category
    : null;

  const displayLabel = categoryLabel
    ? `${categoryLabel} Anchor`
    : `Anchor #${anchor.id.slice(-6)}`;

  return {
    id: anchor.id,
    displayLabel,
    category: anchor.category,
    isCharged: anchor.isCharged,
    activationCount: anchor.activationCount,
    enhancedImageUrl: anchor.enhancedImageUrl,
    baseSigilSvg: anchor.baseSigilSvg,
    createdAt: anchor.createdAt,
  };
}

/**
 * Batch redact multiple anchors
 *
 * @param anchors - Array of anchors to redact
 * @returns Array of redacted anchors
 */
export function redactAnchors(anchors: Anchor[]): RedactedAnchor[] {
  return anchors.map(redactAnchor);
}
