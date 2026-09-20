import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { CircularAnchorRenderer, V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { AnchorMotion, getCategoryFieldColor, getCategoryPalette, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { useV2ReduceMotion } from '@/hooks/v2';
import { V2FocusField } from './V2FocusField';

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
  const reduceMotion = useV2ReduceMotion();
  const categoryPalette = getCategoryPalette(anchor.category);

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

  // Presentation only: the authoritative Thread values above are already
  // resolved before this screen mounts. Reanimated owns the entrance and fill.
  const contentOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const barProgress = useSharedValue(fromVal / 100);
  const deltaOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const completionProgress = useSharedValue(1);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: barProgress.value }] }));
  const deltaStyle = useAnimatedStyle(() => ({ opacity: deltaOpacity.value }));

  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.value = 1;
      barProgress.value = toVal / 100;
      deltaOpacity.value = 1;
      return;
    }

    contentOpacity.value = withTiming(1, {
      duration: AnchorMotion.duration.expressive,
      easing: AnchorMotion.easing.enter,
    });
    barProgress.value = withDelay(
      AnchorMotion.duration.quick,
      withTiming(toVal / 100, {
        duration: AnchorMotion.duration.expressive,
        easing: AnchorMotion.easing.emphasized,
      }),
    );
    deltaOpacity.value = withDelay(
      AnchorMotion.duration.quick,
      withTiming(1, { duration: AnchorMotion.duration.quick, easing: AnchorMotion.easing.enter }),
    );
  }, [barProgress, contentOpacity, deltaOpacity, reduceMotion, toVal]);

  const durationLabel =
    durationSeconds === 60 ? '1 min practiced' : `${durationSeconds} sec practiced`;

  return (
    <V2Screen testID="v2-focus-complete-screen" style={styles.screen}>
      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.eyebrow}>FOCUS COMPLETE</Text>

        {/* Real Anchor artwork with completed imprint / category field */}
        <View style={styles.artworkContainer}>
          <View style={styles.fieldImprint}>
            <V2FocusField
              size={220}
              progress={completionProgress}
              category={anchor.category}
              reduceMotion={reduceMotion}
              motionActive={false}
              imprint
            />
          </View>
          <View
            style={[
              styles.completedRing,
              { borderColor: `${practiceColors.focus}70` },
            ]}
          />
          <View
            style={[
              styles.halo,
              { backgroundColor: getCategoryFieldColor(anchor.category) },
            ]}
          />
          <CircularAnchorRenderer
            svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl}
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
                  <Animated.Text
                    testID="focus-thread-delta"
                    style={[
                      styles.threadDelta,
                      { color: categoryPalette.deep },
                      deltaStyle,
                    ]}
                  >
                    +{delta}
                  </Animated.Text>
                </View>
                <Text style={styles.strengthenedBadge}>STRENGTHENED</Text>
              </View>

              <View style={styles.valuesRow}>
                <Text
                  style={[styles.strengthValue, { color: colors.text.secondary }]}
                >
                  {fromVal}
                </Text>
                <Text style={styles.arrow}>→</Text>
                <Text
                  style={[styles.strengthValue, { color: colors.text.primary }]}
                >
                  {toVal}
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: categoryPalette.deep,
                    },
                    barStyle,
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
                      backgroundColor: categoryPalette.deep,
                    },
                    barStyle,
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
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  fieldImprint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedRing: {
    position: 'absolute',
    width: 176,
    height: 176,
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
    width: '100%',
    height: '100%',
    borderRadius: 5,
    transformOrigin: 'left center',
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
