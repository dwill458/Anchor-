type BurnArtworkSource = {
  enhancedImageUrl?: string | null;
  sigilUri?: string | null;
  finalImageUrl?: string | null;
};

export const resolveBurnArtworkUri = (
  source?: BurnArtworkSource | null
): string | undefined => {
  if (!source) {
    return undefined;
  }

  return source.enhancedImageUrl || source.sigilUri || source.finalImageUrl || undefined;
};
