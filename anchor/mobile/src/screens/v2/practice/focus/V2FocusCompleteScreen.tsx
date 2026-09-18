import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircularAnchorRenderer, V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { getCategoryColor, getCategoryFieldColor, getCategoryPalette, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { threadQualitativeLabel } from '@/adapters/v2/home/threadAdapter';

export interface V2FocusCompleteScreenProps {
  anchor: Anchor;
  durationSeconds: number;
  beforeStrength?: number | null;
  afterStrength?: number | null;
  onDone: () => void;
  onAgain: () => void;
}

export function V2FocusCompleteScreen({
  anchor,
  durationSeconds,
  beforeStrength: propBefore,
  afterStrength: propAfter,
  onDone,
  onAgain,
}: V2FocusCompleteScreenProps) {
  const insets = useSafeAreaInsets();
  const categoryPalette = getCategoryPalette(anchor.category);

  // Authoritative thread strength resolution:
  // If explicitly passed (from backend movement), use it.
  // Otherwise, check anchor.threadStrength.
  const hasAuthoritativeMovement =
    typeof propBefore === 'number' && typeof propAfter === 'number';
  const baselineStored = typeof anchor.threadStrength === 'number';

  const isUnmeasured = !hasAuthoritativeMovement && !baselineStored;

  const fromVal = hasAuthoritativeMovement
    ? Math.max(0, Math.min(100, propBefore!))
    : baselineStored
    ? Math.max(0, Math.min(100, anchor.threadStrength!))
    : 0;

  const toVal = hasAuthoritativeMovement
    ? Math.max(0, Math.min(100, propAfter!))
    : fromVal;

  const delta = hasAuthoritativeMovement ? toVal - fromVal : 0;

  // Animation for progress bar
  const [settled, setSettled] = useState(false);
  const barAnim = useRef(new Animated.Value(fromVal)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(true);
      Animated.timing(barAnim, {
        toValue: toVal,
        duration: 900,
        useNativeDriver: false,
      }).start();
    }, 450);

    return () => clearTimeout(timer);
  }, [barAnim, toVal]);

  const durationLabel =
    durationSeconds === 60 ? '1 min practiced' : `${durationSeconds} sec practiced`;

  return (
    <V2Screen testID="v2-focus-complete-screen" style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>FOCUS COMPLETE</Text>

        {/* Real Anchor artwork */}
        <View style={styles.artworkContainer}>
          <View
            style={[
              styles.halo,
              { backgroundColor: getCategoryFieldColor(anchor.category) },
            ]}
          />
          <CircularAnchorRenderer
            svg={anchorArtworkSvg(anchor)}
            category={anchor.category}
            size={140}
            accessibilityLabel={`${anchor.category} Anchor artwork`}
          />
        </View>

        {/* Heading & practiced duration */}
        <View style={styles.headingBlock}>
          <Text style={styles.headline}>You returned.</Text>
          <Text style={styles.durationSubtitle}>{durationLabel}</Text>
        </View>

        {/* Authoritative Thread Strength Feedback */}
        <View testID="focus-complete-thread-bar" style={styles.threadBlock}>
          <View style={styles.threadHeader}>
            <Text style={styles.threadTitle}>Thread Strength</Text>
            {hasAuthoritativeMovement && delta > 0 ? (
              <Text
                testID="focus-thread-delta"
                style={[
                  styles.threadDelta,
                  { color: categoryPalette.deep, opacity: settled ? 1 : 0 },
                ]}
              >
                +{delta}
              </Text>
            ) : isUnmeasured ? (
              <Text style={styles.unmeasuredBadge}>
                {threadQualitativeLabel(0, true)}
              </Text>
            ) : null}
          </View>

          {isUnmeasured ? (
            <View style={styles.unmeasuredContainer}>
              <Text style={styles.unmeasuredHint}>
                Session recorded. Baseline calculation takes shape with daily practice.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.valuesRow}>
                <Text
                  style={[
                    styles.strengthValue,
                    { color: settled && delta !== 0 ? colors.text.secondary : colors.text.primary },
                  ]}
                >
                  {fromVal}
                </Text>
                {delta !== 0 ? (
                  <>
                    <Text style={styles.arrow}>→</Text>
                    <Text
                      style={[
                        styles.strengthValue,
                        { color: settled ? colors.text.primary : colors.text.secondary },
                      ]}
                    >
                      {toVal}
                    </Text>
                  </>
                ) : null}
              </View>

              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: barAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: categoryPalette.deep,
                    },
                  ]}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Action buttons */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(24, insets.bottom + 12) },
        ]}
      >
        <V2Button
          size="large"
          onPress={onDone}
          accessibilityLabel="Done"
          testID="focus-complete-done-button"
          style={{ backgroundColor: '#5C3A82' }}
        >
          Done
        </V2Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Focus again"
          testID="focus-complete-again-button"
          onPress={onAgain}
          style={styles.againLink}
        >
          <Text style={styles.againText}>Focus again</Text>
        </Pressable>
      </View>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  artworkContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 22,
  },
  halo: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    opacity: 0.7,
  },
  headingBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headline: {
    ...typography.headingXL,
    fontFamily: typography.displayBold,
    fontSize: 26,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  durationSubtitle: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 6,
  },
  threadBlock: {
    width: '100%',
    maxWidth: 280,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  threadTitle: {
    ...typography.labelSM,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  threadDelta: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },
  unmeasuredBadge: {
    ...typography.caption,
    fontFamily: typography.bodySemiBold,
    color: colors.text.secondary,
  },
  unmeasuredContainer: {
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  unmeasuredHint: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    marginTop: 10,
  },
  strengthValue: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 19,
  },
  arrow: {
    ...typography.bodyMD,
    fontSize: 14,
    color: colors.text.secondary,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.border.default,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  footer: {
    paddingHorizontal: 26,
    gap: 2,
  },
  againLink: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againText: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 14.5,
    color: colors.text.secondary,
  },
});
