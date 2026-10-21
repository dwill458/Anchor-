import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { visionMaterials, type VisionMaterialId } from '@/assets/vision/materials/manifest';

type Props = {
  material: VisionMaterialId;
  thumbnail?: boolean;
  tint?: { color: string; opacity: number };
  testID?: string;
};

/** Static photographed material; text and gestures belong to the parent. Never decodes on keystrokes. */
export const VisionMaterialSurface = memo(function VisionMaterialSurface({ material, thumbnail = false, tint, testID }: Props) {
  const asset = visionMaterials[material];
  const source = thumbnail && 'thumbnail' in asset ? asset.thumbnail : asset.source;
  return <View pointerEvents="none" accessible={false} testID={testID} style={StyleSheet.absoluteFill}>
    <Image source={source} resizeMode="stretch" fadeDuration={0} style={styles.image} />
    {tint ? <Image source={source} resizeMode="stretch" fadeDuration={0}
      style={[styles.image, { tintColor: tint.color, opacity: tint.opacity }]} /> : null}
  </View>;
});

const styles = StyleSheet.create({
  // Native Image inserts a bundled asset's intrinsic width/height before this style.
  // Edges alone do not override those values. Resolve both axes against the bounded
  // note, print or tape parent, including while its board geometry animates.
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
