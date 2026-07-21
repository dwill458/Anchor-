import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';

import { colors, typography } from '@/theme';
import type { VisualizeSegmentState } from './visualizePresentation';

type LensProps = {
  size: number;
  imageUrl?: string;
  svg?: string;
  style?: StyleProp<ViewStyle>;
};

/** A circular presentation of an Anchor, shared by every Visualize surface. */
export const VisualizationAnchorLens = React.memo(({
  size,
  imageUrl,
  svg,
  style,
}: LensProps) => {
  const innerSize = Math.round(size - 12);
  return (
    <View style={[styles.lensStage, { width: size, height: size }, style]}>
      <View
        pointerEvents="none"
        style={[styles.lensAmbientGlow, { width: size + 22, height: size + 22, borderRadius: (size + 22) / 2 }]}
      />
      <LinearGradient
        colors={['#F4EDD8', '#DDD0B5']}
        start={{ x: 0.2, y: 0.05 }}
        end={{ x: 0.85, y: 1 }}
        style={[styles.lens, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View
          style={[
            styles.lensInset,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
          ]}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: innerSize, height: innerSize }}
              resizeMode="cover"
            />
          ) : svg ? (
            <SvgXml xml={svg} width={innerSize} height={innerSize} />
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
});

type ProgressProps = {
  segmentStates: VisualizeSegmentState[];
  label: string;
};

const VisualizationPhaseProgressComponent: React.FC<ProgressProps> = ({
  segmentStates,
  label,
}) => (
  <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.progressBlock}>
    <View style={styles.progressSegments}>
      {segmentStates.map((state, index) => (
        <View key={`${state}-${index}`} style={styles.segmentWrap}>
          <View style={[styles.segment, styles[`segment_${state}`]]} />
          {state === 'current' ? <View style={styles.segmentDot} /> : null}
        </View>
      ))}
    </View>
    <Text style={styles.progressLabel}>{label}</Text>
  </View>
);

/**
 * The session screen rebuilds `segmentStates` on every 100ms tick, but its
 * contents only change when the phase advances. Compare element-wise so this
 * bar re-renders a handful of times per session instead of ~10x/second.
 */
export const VisualizationPhaseProgress = React.memo(
  VisualizationPhaseProgressComponent,
  (prev, next) =>
    prev.label === next.label &&
    prev.segmentStates.length === next.segmentStates.length &&
    prev.segmentStates.every((state, index) => state === next.segmentStates[index]),
);

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const VisualizationPrimaryButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  disabled = false,
  style,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.primaryButton, disabled && styles.primaryDisabled, pressed && styles.primaryPressed, style]}
  >
    <LinearGradient colors={['#DDB84D', '#B48729']} style={styles.primaryGradient}>
      <Text style={styles.primaryLabel}>{label}</Text>
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  lensStage: { alignItems: 'center', justifyContent: 'center' },
  lensAmbientGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(68,128,182,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  lens: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.78)',
  },
  lensInset: {
    overflow: 'hidden',
    backgroundColor: '#EEE4D0',
    borderWidth: 2,
    borderColor: 'rgba(8,20,34,0.25)',
  },
  progressBlock: { alignItems: 'center' },
  progressSegments: { flexDirection: 'row', gap: 5, alignSelf: 'stretch' },
  segmentWrap: { flex: 1, height: 12, justifyContent: 'center', position: 'relative' },
  segment: { height: 2, borderRadius: 2, backgroundColor: 'rgba(128,151,170,0.3)' },
  segment_completed: { backgroundColor: 'rgba(212,175,55,0.58)' },
  segment_current: {
    height: 3,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  segment_upcoming: { backgroundColor: 'rgba(126,150,170,0.28)' },
  segmentDot: {
    position: 'absolute',
    top: 2,
    left: '50%',
    width: 6,
    height: 6,
    marginLeft: -3,
    borderRadius: 3,
    backgroundColor: '#F2D982',
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  progressLabel: {
    color: colors.gold,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 2.1,
    marginTop: 7,
  },
  primaryButton: { minHeight: 52, borderRadius: 17, overflow: 'hidden' },
  primaryGradient: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryLabel: { color: '#07111D', fontFamily: typography.fonts.heading, fontSize: 12, letterSpacing: 1.4 },
  primaryDisabled: { opacity: 0.48 },
  primaryPressed: { opacity: 0.86 },
});
