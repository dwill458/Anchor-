import React, { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import type { AnchorExpression } from '@/constants/v2/creation';

export type PaywallAnchorArtModel = {
  svg: string;
  imageUrl?: string | null;
  expression?: AnchorExpression | null;
  category?: string | null;
};

type Props = { art: PaywallAnchorArtModel | null; size: number };

const DISC = '#0F1020';

/**
 * The user's own Anchor as a plain circular crop: the finished artwork fills
 * the disc, else the stored structure on a dark disc. No ring, no glow. With
 * no Anchor at all it is an empty disc, never a stand-in mark.
 */
export const PaywallAnchorArt = memo(function PaywallAnchorArt({ art, size }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [art?.imageUrl]);
  const round = { width: size, height: size, borderRadius: size / 2 };
  const showImage = Boolean(art?.imageUrl) && !imageFailed;

  return (
    <View style={[styles.disc, round]} accessible={false} importantForAccessibility="no-hide-descendants">
      {showImage ? (
        <Image
          source={{ uri: art!.imageUrl as string }}
          resizeMode="cover"
          style={round}
          onError={() => setImageFailed(true)}
        />
      ) : art?.svg ? (
        <CircularAnchorRenderer
          svg={art.svg}
          expression={art.expression}
          category={art.category}
          size={size}
          appearance="bare"
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  disc: { overflow: 'hidden', backgroundColor: DISC, alignItems: 'center', justifyContent: 'center' },
});
