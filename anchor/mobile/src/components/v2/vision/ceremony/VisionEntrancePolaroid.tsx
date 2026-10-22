import { memo } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { VisionPolaroidVariant } from '@/assets/vision/materials/manifest';
import { VisionPolaroidFrame } from '../material/VisionPolaroidFrame';
import { VISION_CAPTION_COLOR, VISION_CAPTION_FONTS } from '../material/visionMaterialTokens';
import { defaultVisionFocal, visionCoverFrame, type VisionFocal } from '../visionPhotoFocus';

/** The polaroid material's aperture, as fractions of the print (measured from the art's alpha). */
export const ENTRANCE_POLAROID_WINDOW = { left: 0.06, top: 0.06, width: 0.88, height: 0.72 } as const;
/** The paper under the photograph, sampled from the frame art, so the print has body and a shadow on every platform. */
const PAPER = '#ECE9E2';

export type VisionEntrancePolaroidProps = {
  source: ImageSourcePropType;
  sourceSize: { width: number; height: number };
  caption?: string;
  frame?: VisionPolaroidVariant;
  /** Print size in points. */
  width: number;
  height: number;
  focal?: VisionFocal | null;
  testID?: string;
};

/**
 * A cream polaroid drawn in code around a photograph-only picture: paper body, the real paper frame with its
 * aperture, a contact shadow and a handwritten caption. The photograph covers its window at its own proportions
 * and is anchored near the top, so a head is never the part that is cropped.
 */
export const VisionEntrancePolaroid = memo(function VisionEntrancePolaroid({ source, sourceSize, caption, frame = 'classic', width, height, focal, testID }: VisionEntrancePolaroidProps) {
  const win = {
    left: width * ENTRANCE_POLAROID_WINDOW.left, top: height * ENTRANCE_POLAROID_WINDOW.top,
    width: width * ENTRANCE_POLAROID_WINDOW.width, height: height * ENTRANCE_POLAROID_WINDOW.height,
  };
  const sourceAspect = sourceSize.width / sourceSize.height;
  const cover = visionCoverFrame(sourceAspect, win.width, win.height, focal ?? defaultVisionFocal(sourceAspect, win.width / win.height));
  const fontSize = Math.min(19, Math.max(13, width * 0.1));
  const captionTop = height * (ENTRANCE_POLAROID_WINDOW.top + ENTRANCE_POLAROID_WINDOW.height);
  return <View testID={testID} style={styles.print}>
    <View style={[styles.paper, styles.shadow]} />
    <View style={[styles.window, win]}>
      <Image source={source} resizeMode="cover" resizeMethod="resize" fadeDuration={0} accessible={false}
        style={{ position: 'absolute', width: cover.width, height: cover.height, left: cover.left, top: cover.top }} />
    </View>
    <VisionPolaroidFrame variant={frame} />
    {caption ? <View pointerEvents="none" style={[styles.captionBand, { top: captionTop, height: height - captionTop }]}>
      <Text testID={testID ? `${testID}-caption` : undefined} style={[styles.caption, { fontSize, lineHeight: fontSize * 1.2 }]}>{caption}</Text>
    </View> : null}
  </View>;
});

const styles = StyleSheet.create({
  print: { ...StyleSheet.absoluteFill },
  paper: { ...StyleSheet.absoluteFill, backgroundColor: PAPER, borderRadius: 1 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 16 }, elevation: 10 },
  window: { position: 'absolute', overflow: 'hidden', backgroundColor: '#1A1D36' },
  captionBand: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  caption: { fontFamily: VISION_CAPTION_FONTS.handwritten, color: VISION_CAPTION_COLOR, textAlign: 'center' },
});
