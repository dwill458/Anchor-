import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolateColor, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, spacing } from '@/theme/v2';
import { RELEASE_COPY } from '@/constants/v2/release';
import { releaseTypography } from './releaseTypography';

interface Props {
  artworkSvg: string;
  category?: string | null;
  progress: number;
  visualProgress?: SharedValue<number>;
  isHolding: boolean;
  accessibilityLabel: string;
  disabled?: boolean;
  showArtwork?: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  testID?: string;
}

/** Deliberate hold target; progress is neutral ink and runs on the UI thread. */
export function V2HoldToReleaseControl({ artworkSvg, category, progress, visualProgress,
  isHolding, accessibilityLabel, disabled = false, showArtwork = true,
  onHoldStart, onHoldEnd, testID }: Props) {
  const fallback = useSharedValue(progress);
  useEffect(() => { if (!visualProgress) fallback.value = withTiming(progress, { duration: 50 }); }, [fallback, progress, visualProgress]);
  const fill = visualProgress ?? fallback;
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value * 0.12 }));
  const controlStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - fill.value * 0.012 }], borderColor: interpolateColor(fill.value, [0, 1], ['#3D4447', '#A9A79F']) }));
  return (
    <View style={styles.wrapper} testID={testID ?? 'v2-hold-to-release'}>
      {showArtwork ? <CircularAnchorRenderer svg={artworkSvg} category={category} size={244} appearance="paper" /> : null}
      <Animated.View style={[styles.pressable, controlStyle]}>
      <Pressable onPressIn={disabled ? undefined : onHoldStart} onPressOut={disabled ? undefined : onHoldEnd}
        onResponderTerminate={onHoldEnd} onTouchCancel={onHoldEnd} onBlur={onHoldEnd}
        disabled={disabled} accessibilityRole="button"
        accessibilityLabel={`${RELEASE_COPY.holdPrompt}: ${accessibilityLabel}`}
        accessibilityHint={RELEASE_COPY.holdHint} accessibilityState={{ disabled, busy: isHolding }}
        style={styles.target} testID="v2-hold-to-release-target">
        <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} testID="v2-hold-progress-fill" />
        <Text style={styles.label} testID="v2-hold-to-release-label">
          {isHolding || progress > 0 ? RELEASE_COPY.holdSustainPrompt : RELEASE_COPY.holdPrompt}
        </Text>
      </Pressable>
      </Animated.View>
      {isHolding ? <Text style={styles.hint}>Lift to cancel</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing[2], width: '100%' },
  pressable: { width: '100%', minHeight: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: '#182027', borderWidth: 1,
    justifyContent: 'center', alignItems: 'center' },
  target: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.frame },
  label: { ...releaseTypography.label, color: colors.frame, paddingVertical: 17, paddingHorizontal: 16 },
  hint: { position: 'absolute', top: 61, left: 0, right: 0, textAlign: 'center', ...releaseTypography.small, color: 'rgba(244,237,224,0.5)' },
});
