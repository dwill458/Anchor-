import React, { useEffect } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { AnchorMotion, getCategoryPalette, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { useV2ReduceMotion } from '@/hooks/v2';
import { V2FocusAnchorArtwork } from './V2FocusAnchorArtwork';

export interface V2FocusCompleteScreenProps {
  anchor: Anchor;
  durationSeconds: number;
  beforeStrength?: number | null;
  afterStrength?: number | null;
  sessionSaved?: boolean;
  onDone: () => void;
  onAgain: () => void;
}

export function V2FocusCompleteScreen({
  anchor,
  beforeStrength: propBefore,
  afterStrength: propAfter,
  sessionSaved = true,
  onDone,
  onAgain,
}: V2FocusCompleteScreenProps) {
  const { height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const categoryPalette = getCategoryPalette(anchor.category);
  const artworkSize = Math.round(Math.min(188, Math.max(148, height * 0.22)));
  // V2Screen already applies the bottom safe-area inset.
  const footerBottomPadding = Math.round(Math.min(20, Math.max(12, height * 0.018)));

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
  // The Anchor is visible on the first cream frame. This avoids a blank beat
  // between the resolving session field and the same Anchor on completion.
  const contentOpacity = useSharedValue(reduceMotion ? 1 : 0.34);
  const inkOverlayOpacity = useSharedValue(reduceMotion ? 0 : 1);
  const barProgress = useSharedValue(fromVal / 100);
  const deltaOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const artworkScale = useSharedValue(reduceMotion ? 1 : 0.94);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const inkOverlayStyle = useAnimatedStyle(() => ({ opacity: inkOverlayOpacity.value }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: barProgress.value }] }));
  const deltaStyle = useAnimatedStyle(() => ({ opacity: deltaOpacity.value }));
  const artworkStyle = useAnimatedStyle(() => ({ transform: [{ scale: artworkScale.value }] }));

  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.value = 1;
      inkOverlayOpacity.value = 0;
      barProgress.value = toVal / 100;
      deltaOpacity.value = 1;
      return;
    }

    contentOpacity.value = withTiming(1, {
      duration: 600,
      easing: AnchorMotion.easing.enter,
    });
    inkOverlayOpacity.value = withTiming(0, { duration: 600, easing: AnchorMotion.easing.enter });
    artworkScale.value = withTiming(1, { duration: 700, easing: AnchorMotion.easing.enter });
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
  }, [artworkScale, barProgress, contentOpacity, deltaOpacity, inkOverlayOpacity, reduceMotion, toVal]);

  return (
    <V2Screen testID="v2-focus-complete-screen" style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} animated />
      <Animated.View style={[styles.content, contentStyle]}>
        <Animated.View style={[styles.artworkContainer, { width: artworkSize, height: artworkSize }, artworkStyle]}>
          <View style={[styles.artworkAtmosphere, { backgroundColor: categoryPalette.soft }]} />
          <V2FocusAnchorArtwork
            svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl}
            category={anchor.category}
            size={artworkSize}
            surface={colors.background}
            accessibilityLabel={`${anchor.category} Anchor artwork`}
            testID="focus-complete-anchor-artwork"
          />
        </Animated.View>

        <View style={styles.headingBlock}>
          <Text style={styles.headline}>Focus complete</Text>
        </View>

        {sessionSaved ? <>
        {/* Authoritative Consistency (Thread Strength) feedback */}
        <View testID="focus-complete-thread-bar" style={styles.threadBlock}>
          {isUnmeasured ? (
            <View style={styles.unmeasuredContainer}>
              <View style={styles.threadHeader}>
                <Text style={styles.threadTitle}>THREAD STRENGTH</Text>
              </View>
              <Text style={styles.unmeasuredHint}>Session recorded. Strength will appear as data builds.</Text>
            </View>
          ) : hasAuthoritativeMovement ? (
            <View style={styles.measuredCard}>
              <View style={styles.threadHeader}>
                <View style={styles.deltaGroup}>
                    <Text style={styles.threadTitle}>THREAD STRENGTH</Text>
                  {delta !== 0 ? (
                    <Animated.Text
                      testID="focus-thread-delta"
                      style={[
                        styles.threadDelta,
                        { color: categoryPalette.deep },
                        deltaStyle,
                      ]}
                    >
                      {delta > 0 ? '+' : ''}{delta}
                    </Animated.Text>
                  ) : null}
                </View>
              </View>

              {delta !== 0 ? (
                <View style={styles.valuesRow}>
                  <Text style={[styles.strengthValue, { color: colors.text.secondary }]}>{fromVal}%</Text>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={[styles.strengthValue, { color: colors.text.primary }]}>{toVal}%</Text>
                </View>
              ) : (
                <Text style={styles.currentStrengthLabel}>{toVal}%</Text>
              )}

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
                <Text style={styles.threadTitle}>THREAD STRENGTH</Text>
                <Text style={styles.currentStrengthLabel}>{toVal}%</Text>
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

        <Text style={styles.reinforcedToday}>Reinforced today ✓</Text>
        </> : (
          <View style={styles.unmeasuredContainer}>
            <Text style={styles.unmeasuredHint}>
              This session could not be saved. Thread Strength was not updated.
            </Text>
          </View>
        )}
      </Animated.View>
      {/* Action buttons */}
      <View
        style={[
          styles.footer,
          { paddingBottom: footerBottomPadding },
        ]}
      >
        <V2Button
          size="large"
          onPress={onDone}
          accessibilityLabel="Continue"
          testID="focus-complete-done-button"
          style={styles.doneButton}
        >
          Continue
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
      <Animated.View pointerEvents="none" style={[styles.inkOverlay, inkOverlayStyle]} />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ink.base,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  artworkContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  artworkAtmosphere: {
    position: 'absolute',
    width: '84%',
    height: '84%',
    borderRadius: 999,
    opacity: 0.32,
  },
  headingBlock: {
    alignItems: 'center',
    marginBottom: spacing[5],
    gap: 6,
  },
  headline: {
    ...typography.headingXL,
    fontFamily: typography.display,
    fontSize: 26,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  threadBlock: {
    width: '100%',
    maxWidth: 296,
  },
  unmeasuredContainer: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
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
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
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
    fontSize: 14,
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
    fontFamily: typography.display,
    fontSize: 18,
  },
  arrow: {
    ...typography.bodyMD,
    fontSize: 14,
    color: colors.text.secondary,
  },
  progressBarTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border.strong,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
    transformOrigin: 'left center',
  },
  reinforcedToday: {
    ...typography.labelMD,
    color: colors.text.primary,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: 0,
  },
  doneButton: {
    width: '100%',
    maxWidth: 320,
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
