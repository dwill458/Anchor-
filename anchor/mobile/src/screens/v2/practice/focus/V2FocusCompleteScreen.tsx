import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { CircularAnchorRenderer, V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { getCategoryColor, getCategoryFieldColor, getCategoryPalette, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';

export interface V2FocusCompleteScreenProps {
  anchor: Anchor;
  durationSeconds: number;
  beforeStrength?: number | null;
  afterStrength?: number | null;
  contextualRecommendation?: {
    action: string;
    modeTitle: string;
    reason: string;
  } | null;
  onDone: () => void;
  onAgain: () => void;
  onSelectRecommended?: () => void;
}

export function V2FocusCompleteScreen({
  anchor,
  durationSeconds,
  beforeStrength: propBefore,
  afterStrength: propAfter,
  contextualRecommendation,
  onDone,
  onAgain,
  onSelectRecommended,
}: V2FocusCompleteScreenProps) {
  const insets = useSafeAreaInsets();
  const categoryPalette = getCategoryPalette(anchor.category);
  const categoryColor = getCategoryColor(anchor.category);

  // Authoritative thread strength resolution:
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

  // Animation for progress bar and transition into light UI
  const [settled, setSettled] = useState(false);
  const barAnim = useRef(new Animated.Value(fromVal)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      setSettled(true);
      Animated.timing(barAnim, {
        toValue: toVal,
        duration: 900,
        useNativeDriver: false,
      }).start();
    }, 450);

    return () => clearTimeout(timer);
  }, [barAnim, fadeAnim, toVal]);

  const durationLabel =
    durationSeconds === 60 ? '1 min practiced' : `${durationSeconds} sec practiced`;

  return (
    <V2Screen testID="v2-focus-complete-screen" style={styles.screen}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.eyebrow}>FOCUS COMPLETE</Text>

        {/* Real Anchor artwork with completed imprint / category field */}
        <View style={styles.artworkContainer}>
          <View
            style={[
              styles.completedRing,
              { borderColor: `${categoryColor}40` },
            ]}
          />
          <View
            style={[
              styles.halo,
              { backgroundColor: getCategoryFieldColor(anchor.category) },
            ]}
          />
          <CircularAnchorRenderer
            svg={anchorArtworkSvg(anchor)}
            category={anchor.category}
            size={144}
            appearance="paper"
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
          {isUnmeasured ? (
            <View style={styles.unmeasuredContainer}>
              <View style={styles.threadHeader}>
                <Text style={styles.formingTitle}>THREAD FORMING</Text>
              </View>
              <Text style={styles.unmeasuredHint}>
                Each return gives Anchor more signal. Keep reinforcing it and your baseline will take shape.
              </Text>
            </View>
          ) : hasAuthoritativeMovement && delta > 0 ? (
            <View style={styles.measuredCard}>
              <View style={styles.threadHeader}>
                <View style={styles.deltaGroup}>
                  <Text style={styles.threadTitle}>THREAD</Text>
                  <Text
                    testID="focus-thread-delta"
                    style={[
                      styles.threadDelta,
                      { color: categoryPalette.deep, opacity: settled ? 1 : 0 },
                    ]}
                  >
                    +{delta}
                  </Text>
                </View>
                <Text style={styles.strengthenedBadge}>STRENGTHENED</Text>
              </View>

              <View style={styles.valuesRow}>
                <Text
                  style={[
                    styles.strengthValue,
                    { color: settled && delta !== 0 ? colors.text.secondary : colors.text.primary },
                  ]}
                >
                  {fromVal}
                </Text>
                <Text style={styles.arrow}>→</Text>
                <Text
                  style={[
                    styles.strengthValue,
                    { color: settled ? colors.text.primary : colors.text.secondary },
                  ]}
                >
                  {toVal}
                </Text>
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
            </View>
          ) : (
            <View style={styles.measuredCard}>
              <View style={styles.threadHeader}>
                <Text style={styles.formingTitle}>SESSION RECORDED</Text>
                <Text style={styles.currentStrengthLabel}>{toVal}</Text>
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
            </View>
          )}
        </View>

        {/* Contextual Next Recommendation (if available) */}
        {contextualRecommendation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next: ${contextualRecommendation.modeTitle}. ${contextualRecommendation.reason}`}
            onPress={onSelectRecommended}
            style={styles.recommendationCard}
          >
            <View style={styles.recommendationLeft}>
              <Text style={styles.recommendationEyebrow}>NEXT</Text>
              <Text style={styles.recommendationTitle}>
                {contextualRecommendation.modeTitle}
              </Text>
              <Text style={styles.recommendationReason}>
                {contextualRecommendation.reason}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </Animated.View>

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
          style={styles.doneButton}
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
    paddingHorizontal: spacing[6],
  },
  eyebrow: {
    ...typography.labelSM,
    color: practiceColors.focus,
    letterSpacing: 1.4,
    fontWeight: '700',
    fontSize: 11,
  },
  artworkContainer: {
    position: 'relative',
    width: 154,
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  completedRing: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
  },
  halo: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    opacity: 0.65,
  },
  headingBlock: {
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  headline: {
    ...typography.headingXL,
    fontFamily: typography.displayBold,
    fontSize: 27,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  durationSubtitle: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  threadBlock: {
    width: '100%',
    maxWidth: 296,
  },
  unmeasuredContainer: {
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  formingTitle: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.text.primary,
    letterSpacing: 0.8,
  },
  unmeasuredHint: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  measuredCard: {
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deltaGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  threadTitle: {
    ...typography.labelSM,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.text.secondary,
    letterSpacing: 0.6,
  },
  threadDelta: {
    ...typography.labelLG,
    fontFamily: typography.bodyBold,
    fontSize: 16,
  },
  strengthenedBadge: {
    ...typography.caption,
    fontFamily: typography.bodyBold,
    color: practiceColors.focus,
    letterSpacing: 0.8,
    fontSize: 11,
  },
  currentStrengthLabel: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    color: colors.text.primary,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    marginTop: 4,
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
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 296,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    padding: spacing[4],
    marginTop: spacing[4],
  },
  recommendationLeft: {
    flex: 1,
    paddingRight: spacing[2],
  },
  recommendationEyebrow: {
    ...typography.caption,
    fontWeight: '700',
    color: practiceColors.deepPrime,
    letterSpacing: 1,
    fontSize: 10,
  },
  recommendationTitle: {
    ...typography.labelMD,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  recommendationReason: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: 2,
  },
  doneButton: {
    backgroundColor: '#5C3A82',
    borderRadius: radii.round,
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
