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
    <Image source={source} resizeMode="stretch" fadeDuration={0} style={StyleSheet.absoluteFill} />
    {tint ? <Image source={source} resizeMode="stretch" fadeDuration={0}
      style={[StyleSheet.absoluteFill, { tintColor: tint.color, opacity: tint.opacity }]} /> : null}
  </View>;
});
