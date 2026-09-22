import React from 'react';
import { CircularAnchorRenderer } from '@/components/v2';

type V2FocusAnchorArtworkProps = {
  svg: string;
  imageUrl?: string | null;
  category?: string | null;
  size: number;
  surface: string;
  accessibilityLabel: string;
  testID?: string;
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
}: V2FocusAnchorArtworkProps) {
  return (
    <CircularAnchorRenderer
      testID={testID}
      svg={svg}
      imageUrl={imageUrl}
      category={category}
      size={size}
      appearance="dark"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
