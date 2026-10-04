import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, spacing } from '@/theme/v2';
import { RELEASE_COPY } from '@/constants/v2/release';
import { releaseTypography } from './releaseTypography';

interface Props {
  artworkSvg: string;
  imageUrl?: string | null;
  category?: string | null;
  progress: number;
  visualProgress?: SharedValue<number>;
  isHolding: boolean;
  accessibilityLabel?: string;
  /** Describes the real effect of this release (waypoint, destination, evolve). */
  accessibilityHint?: string;
  disabled?: boolean;
  showArtwork?: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  testID?: string;
}

/**
 * Deliberate hold target: a 56px ink button on the cream surface. Progress fills
 * left to right in a lighter ink, driven on the UI thread. A short activation
 * never commits; lifting early retreats the fill (see useReleaseHold).
 */
export function V2HoldToReleaseControl({ artworkSvg, imageUrl, category, progress, visualProgress,
  isHolding, accessibilityLabel = RELEASE_COPY.holdAction, accessibilityHint = RELEASE_COPY.holdHint,
  disabled = false, showArtwork = false, onHoldStart, onHoldEnd, testID }: Props) {
  const fallback = useSharedValue(progress);
  useEffect(() => { if (!visualProgress) fallback.value = withTiming(progress, { duration: 50 }); }, [fallback, progress, visualProgress]);
  const fill = visualProgress ?? fallback;
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, fill.value)) * 100}%` }));
  return (
    <View style={styles.wrapper} testID={testID ?? 'v2-hold-to-release'}>
      {showArtwork ? <CircularAnchorRenderer svg={artworkSvg} imageUrl={imageUrl} category={category} size={244} appearance="paper" /> : null}
      <Pressable onPressIn={disabled ? undefined : onHoldStart} onPressOut={disabled ? undefined : onHoldEnd}
        onBlur={onHoldEnd} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, busy: isHolding }}
        style={[styles.target, disabled && styles.disabled]} testID="v2-hold-to-release-target">
        <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} testID="v2-hold-progress-fill" />
        <Text style={styles.label} testID="v2-hold-to-release-label">
          {isHolding || progress > 0 ? RELEASE_COPY.holdSustainPrompt : RELEASE_COPY.holdPrompt}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing[2], width: '100%' },
  // minHeight, not height: the label may wrap at large dynamic type and the target must never clip it.
  target: { width: '100%', minHeight: 56, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.ink.base,
    alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  // No lighter-ink token exists yet: a white wash over ink.base reads as the prototype's lighter ink.
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.ink.hairlineStrong },
  label: { ...releaseTypography.label, color: colors.frame, paddingVertical: 17, paddingHorizontal: 16, textAlign: 'center' },
});
