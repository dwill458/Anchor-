import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useAuraStrength } from '@/stores/devThreadStrengthStore';

type V2FocusAnchorArtworkProps = {
  svg: string;
  imageUrl?: string | null;
  category?: string | null;
  size: number;
  surface: string;
  accessibilityLabel: string;
  testID?: string;
  /** The Anchor's stored Thread Strength. When provided (even as null), the Details-calibrated glow is drawn. */
  threadStrength?: number | null;
  anchorId?: string;
  /** Practice-complete: 0..1 bar progress the glow grows with. */
  strengthProgress?: SharedValue<number>;
};

/**
 * Focus shares Anchor's circular rendering contract. The surrounding Focus
 * field supplies atmosphere; the artwork itself never dissolves into a square.
 */
export function V2FocusAnchorArtwork({
  svg,
  imageUrl,
  category,
  size,
  accessibilityLabel,
  testID,
  threadStrength,
  anchorId,
  strengthProgress,
}: V2FocusAnchorArtworkProps) {
  const reduceMotion = useV2ReduceMotion();
  const glow = useAuraStrength(threadStrength);
  return (
    <CircularAnchorRenderer
      testID={testID}
      svg={svg}
      imageUrl={imageUrl}
      category={category}
      size={size}
      appearance="dark"
      aura={threadStrength === undefined ? undefined : { anchorId: `${anchorId ?? svg.length}${glow.keySuffix}`, threadStrength: glow.strength, variant: 'details', active: true, reducedMotion: reduceMotion, strengthProgress }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
