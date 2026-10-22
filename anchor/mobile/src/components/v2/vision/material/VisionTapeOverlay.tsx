import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { clampTapeRotation, VISION_TAPE, type VisionTapeTone } from './visionMaterialTokens';
import { VisionMaterialSurface } from './VisionMaterialSurface';
import type { VisionTapeVariant } from '@/assets/vision/materials/manifest';

export type VisionTapeOverlayProps = {
  photographic?: boolean;
  variant?: VisionTapeVariant;
  /** Strip width in points. */
  width: number;
  /** Tilt in degrees; clamped to the tape limit. */
  rotation?: number;
  tone?: VisionTapeTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A translucent strip of warm tape that holds a print to the paper. It is
 * positioned by its parent; it only draws itself and never animates.
 */
export const VisionTapeOverlay = memo(function VisionTapeOverlay({ width, rotation = 0, tone = 'cream', style, testID, photographic = false, variant }: VisionTapeOverlayProps) {
  const spec = VISION_TAPE.tones[tone];
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      style={[
        styles.tape,
        { width: safeWidth, backgroundColor: photographic ? 'transparent' : spec.color, opacity: photographic ? 1 : spec.opacity, transform: [{ rotate: `${clampTapeRotation(rotation)}deg` }] },
        style,
      ]}
    >
      {/* A single pale highlight along the top edge: the tape's sheen, not a gradient. */}
      {photographic ? <VisionMaterialSurface material={`tape-${variant ?? (tone === 'kraft' ? 'beige' : tone === 'gold' ? 'textured-ivory' : 'cream')}`} /> : <View style={styles.sheen} />}
    </View>
  );
});

const styles = StyleSheet.create({
  tape: {
    height: VISION_TAPE.height,
    borderRadius: 1,
    overflow: 'hidden',
  },
  sheen: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

