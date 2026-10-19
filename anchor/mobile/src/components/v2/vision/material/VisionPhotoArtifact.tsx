import { memo, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { VisionImageEdge } from '../VisionImageEdge';
import { VisionPaperSurface } from './VisionPaperSurface';
import { VisionTapeOverlay } from './VisionTapeOverlay';
import { seededRotation } from './visionMaterialRandom';
import {
  VISION_CAPTION_COLOR,
  VISION_CAPTION_FONTS,
  VISION_PHOTO,
  VISION_SHADOW,
  VISION_TAPE,
  clampPhotoRotation,
  type VisionTapeTone,
} from './visionMaterialTokens';

const MIN_ASPECT = 0.2;
const MAX_ASPECT = 5;
/** Tape tilts are drawn from this span around level, so a strip never looks mechanically straight. */
const TAPE_TILT_DEG = 8;

export type VisionPhotoArtifactProps = {
  /** Image source. A missing, empty or failed image shows a neutral paper placeholder. */
  uri?: string | null;
  /** Outer print width in points, mount included. */
  width: number;
  /** Image width divided by height. When omitted, the decoded image's own aspect is used. */
  aspectRatio?: number;
  /** Tilt in degrees. Clamped so |deg| never exceeds the photograph limit. */
  rotation?: number;
  /** Optional handwritten caption printed on the mount. */
  caption?: string;
  /** Adds a strip of tape across the top edge of the print. */
  tape?: boolean;
  tapeTone?: VisionTapeTone;
  /** Drives the tape's tilt. Same seed, same tilt. */
  seed?: number;
  accessibilityLabel: string;
  testID?: string;
  /** Overrides the image's testID (default `${testID}-image`), for callers that name the photograph itself. */
  imageTestID?: string;
  /**
   * How the photograph fills its window. `contain` (default) keeps the whole image; `cover` fills the window and
   * crops the overflow, for a fixed frame shape such as a landscape print on a card.
   */
  fit?: 'contain' | 'cover';
  style?: StyleProp<ViewStyle>;
};

type LoadState = { uri: string; status: 'loaded' | 'failed'; aspect?: number };

function validAspect(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, value));
}

/**
 * A polaroid-like photograph on archival mount: a torn white border around the
 * image window, a contact and ambient shadow, an optional handwritten caption
 * and optional tape. The image keeps its aspect ratio and is contained, never
 * cropped.
 */
export const VisionPhotoArtifact = memo(function VisionPhotoArtifact({
  uri, width, aspectRatio, rotation = 0, caption, tape = false, tapeTone = 'cream', seed = 1,
  accessibilityLabel, testID, imageTestID, fit = 'contain', style,
}: VisionPhotoArtifactProps) {
  const [load, setLoad] = useState<LoadState | null>(null);
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const hasUri = typeof uri === 'string' && uri.trim().length > 0;
  const current = hasUri && load?.uri === uri ? load : null;
  const imageFailed = current?.status === 'failed';
  const imageLoaded = current?.status === 'loaded';

  const sidePad = safeWidth * VISION_PHOTO.sidePadRatio;
  const innerWidth = Math.max(0, safeWidth - sidePad * 2);
  const aspect = validAspect(aspectRatio) ?? validAspect(current?.aspect) ?? VISION_PHOTO.fallbackAspect;
  const apertureHeight = innerWidth / aspect;
  const bottomBand = caption ? safeWidth * VISION_PHOTO.captionBandRatio : sidePad * 2;
  const mountHeight = sidePad + apertureHeight + bottomBand;
  const captionSize = Math.min(22, Math.max(12, safeWidth * 0.085));
  const tapeWidth = safeWidth * 0.36;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.print,
        VISION_SHADOW.ambient,
        { width: safeWidth, transform: [{ rotate: `${clampPhotoRotation(rotation)}deg` }] },
        style,
      ]}
    >
      <View style={[styles.mount, VISION_SHADOW.contact, { height: mountHeight, paddingTop: sidePad, paddingHorizontal: sidePad }]}>
        <View style={[styles.aperture, { width: innerWidth, height: apertureHeight }]}>
          <VisionPaperSurface seed={seed} style={StyleSheet.absoluteFill} testID={testID ? `${testID}-placeholder` : undefined} />
          {hasUri && !imageFailed ? (
            <Image
              testID={imageTestID ?? (testID ? `${testID}-image` : undefined)}
              source={{ uri: uri as string }}
              resizeMode={fit}
              resizeMethod="resize"
              fadeDuration={0}
              accessible={false}
              importantForAccessibility="no"
              style={[StyleSheet.absoluteFill, imageLoaded ? null : styles.hidden]}
              onLoad={event => {
                const { width: sourceWidth, height: sourceHeight } = event.nativeEvent.source;
                const sourceAspect = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : undefined;
                setLoad({ uri: uri as string, status: 'loaded', aspect: sourceAspect });
              }}
              onError={() => setLoad({ uri: uri as string, status: 'failed' })}
            />
          ) : null}
          {/* The torn white border: the mount's paper color overlapping the image window's top and bottom edges. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <VisionImageEdge color={VISION_PHOTO.mount} />
          </View>
        </View>
        {caption ? (
          <View style={[styles.captionBand, { height: bottomBand }]}>
            <Text
              testID={testID ? `${testID}-caption` : undefined}
              numberOfLines={1}
              style={[styles.caption, { fontSize: captionSize, lineHeight: captionSize * 1.25 }]}
            >
              {caption}
            </Text>
          </View>
        ) : null}
      </View>
      {tape ? (
        <VisionTapeOverlay
          testID={testID ? `${testID}-tape` : undefined}
          width={tapeWidth}
          tone={tapeTone}
          rotation={seededRotation(seed, TAPE_TILT_DEG)}
          style={[styles.tape, { left: (safeWidth - tapeWidth) / 2, top: -VISION_TAPE.height * 0.45 }]}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  print: { backgroundColor: VISION_PHOTO.mount, borderRadius: 1 },
  mount: { backgroundColor: VISION_PHOTO.mount, borderWidth: StyleSheet.hairlineWidth, borderColor: VISION_PHOTO.mountEdge },
  aperture: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  captionBand: { justifyContent: 'center', alignItems: 'center', paddingTop: 2 },
  caption: { fontFamily: VISION_CAPTION_FONTS.handwritten, color: VISION_CAPTION_COLOR, textAlign: 'center' },
  tape: { position: 'absolute', zIndex: 2 },
});
