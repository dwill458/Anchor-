import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StatusBar, StyleSheet, type LayoutChangeEvent, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { V2DissolutionCeremony, V2HoldToReleaseControl, V2ReleaseChamberStatus,
  V2ReleaseCompletion, V2ReleaseConsequenceCard } from '@/components/v2/release';
import { V2ReleaseArtwork } from '@/components/v2/release/V2ReleaseArtwork';
import { releaseArtworkRect, segment } from '@/components/v2/release/releaseBurn';
import { releaseTypography } from '@/components/v2/release/releaseTypography';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useReleaseHold, useV2Release } from '@/hooks/v2/release';
import { safeHaptics } from '@/utils/haptics';
import { RELEASE_COPY, RELEASE_CEREMONY_CHAMBER_BG } from '@/constants/v2/release';
import { colors, spacing } from '@/theme/v2';
import type { V2ReleaseAdapter } from '@/adapters/v2/release';
import type { V2ReleaseContinuationCallbacks, V2ReleaseRouteParams } from './releaseRoutes';
import { useAnchorTransitionPlace } from '@/navigation/v2/ProgressiveFocusTransition';

export interface V2ReleaseScreenProps extends Partial<V2ReleaseRouteParams>, V2ReleaseContinuationCallbacks {
  releaseAdapter?: V2ReleaseAdapter;
  hasLinkedVision?: boolean;
  /** Navigation host can lock gestures/removal while a committed operation resolves. */
  onSessionActiveChange?: (active: boolean) => void;
  testID?: string;
}

// Commitment is tactile, not a success notification. Success belongs to the result reveal.
const holdHaptics = { selection: v2Haptics.selection,
  completion: () => safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium) };

/** One scene transforms around the same Anchor; the mutation hook remains authoritative. */
export function V2ReleaseScreen({ anchorId = '', reason, releaseAdapter, hasLinkedVision,
  onReleaseCompleted, onCancel, onViewHistory, onSessionActiveChange, testID }: V2ReleaseScreenProps) {
  const reduceMotion = useV2ReduceMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useSharedValue(0);
  const [silent, setSilent] = useState(false);
  const release = useV2Release({ anchorId, adapter: releaseAdapter, reason, hasLinkedVision });
  const hold = useReleaseHold({ reduceMotion, haptics: holdHaptics, onComplete: release.startRelease,
    onCancel: () => AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.cancelAnnouncement),
    onSustainStart: () => AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.sustainAnnouncement) });
  const restingRect = useMemo(() => releaseArtworkRect(width, height), [width, height]);
  const measuredRect = useRef(restingRect);
  const [heldRect, setHeldRect] = useState<typeof restingRect | null>(null);
  const art = heldRect ?? restingRect;
  const place = useAnchorTransitionPlace('release', anchorId, 'paper');
  const active = release.stage !== 'preflight';
  const locked = release.stage === 'dissolving' || release.stage === 'confirming';
  useEffect(() => { onSessionActiveChange?.(locked); }, [locked, onSessionActiveChange]);
  useEffect(() => { if (!active) setSilent(false); }, [active]);
  useEffect(() => { if (!active && !hold.isHolding) setHeldRect(null); }, [active, hold.isHolding]);

  const creamStyle = useAnimatedStyle(() => ({
    height: height * 0.34 * (reduceMotion ? 1 : active ? 0 : 1 - segment(hold.visualProgress.value, 0.3, 0.95)),
    backgroundColor: active ? RELEASE_CEREMONY_CHAMBER_BG : colors.frame,
    opacity: active ? 0 : 1 - segment(hold.visualProgress.value, 0.12, 0.9),
  }));
  const headerStyle = useAnimatedStyle(() => ({ opacity: active ? 0 : 1 - segment(hold.visualProgress.value, 0.05, 0.65) }));
  const rowsStyle = useAnimatedStyle(() => ({ opacity: active ? 0 : 1 - segment(hold.visualProgress.value, 0, 0.45) }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: active ? 0 : 1 - segment(hold.visualProgress.value, 0.86, 1) }));
  const keepStyle = useAnimatedStyle(() => ({ opacity: 1 - segment(hold.visualProgress.value, 0.02, 0.35) }));
  const handleArtworkLayout = useCallback((event: LayoutChangeEvent) => {
    place.onLayout();
    const { x, y, width: w, height: h } = event.nativeEvent.layout;
    if (!active && !hold.isHolding && w > 0 && h > 0) measuredRect.current = { x, y, width: w, height: h };
  }, [place.onLayout, active, hold.isHolding]);
  const handleHoldStart = useCallback(() => { setHeldRect(measuredRect.current); hold.beginHold(); }, [hold.beginHold]);
  const handleCancel = useCallback(() => { hold.endHold(); onCancel(); }, [hold.endHold, onCancel]);
  const handleFreshHold = useCallback(() => { release.reset(); hold.reset(); setSilent(false); }, [release.reset, hold.reset]);
  const handleComplete = useCallback(() => onReleaseCompleted(anchorId), [onReleaseCompleted, anchorId]);
  const startSilence = useCallback(() => setSilent(true), []);

  if (release.anchorMissing || !release.snapshot) return (
    <V2Screen testID={testID ?? 'v2-release-screen'}>
      <V2TopBar title="Release" onBackPress={handleCancel} />
      <V2EmptyState title="Anchor unavailable" message="This Anchor is no longer available to release." />
    </V2Screen>
  );
  const { snapshot, stage } = release;
  const showArtwork = !silent && (stage === 'preflight' || stage === 'dissolving');

  return (
    <View style={styles.scene} testID={testID ?? 'v2-release-screen'}>
      <StatusBar hidden={false} barStyle={active ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <Animated.View pointerEvents="none" style={[styles.creamSurface, creamStyle]} />
      <View pointerEvents={active ? 'none' : 'auto'} accessibilityElementsHidden={active}
        importantForAccessibility={active ? 'no-hide-descendants' : 'auto'} style={StyleSheet.absoluteFill} testID="v2-release-preflight">
        <Animated.View style={[styles.header, { top: insets.top + 8, height: height * 0.34 - insets.top - 24 }, headerStyle]}>
          <View style={styles.identifierRow}>
            <Pressable onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID="v2-release-back">
              <ArrowLeft size={22} color={colors.ink.base} />
            </Pressable>
            <Text style={styles.kicker}>Release</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.intention} testID="v2-release-intention" accessibilityRole="header">{snapshot.intentionText}</Text>
            <Text style={styles.subtitle}>Release this Anchor when you're ready to stop reinforcing it.</Text>
          </ScrollView>
        </Animated.View>
        <Animated.View style={[styles.rows, { top: art.y + art.height + 14, bottom: insets.bottom + 140 }, rowsStyle]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <V2ReleaseConsequenceCard consequences={snapshot.consequences} />
          </ScrollView>
        </Animated.View>
        <Animated.View style={[styles.controls, { bottom: insets.bottom + 12 }, controlsStyle]}>
          <V2HoldToReleaseControl artworkSvg={snapshot.artworkSvg} imageUrl={snapshot.imageUrl} category={snapshot.category}
            progress={hold.progress} visualProgress={hold.visualProgress} isHolding={hold.isHolding} showArtwork={false}
            disabled={hold.isComplete} accessibilityLabel={snapshot.intentionText} onHoldStart={handleHoldStart} onHoldEnd={hold.endHold} />
          <Animated.View style={keepStyle}><Pressable accessibilityRole="button" onPress={handleCancel} style={styles.keepControl} testID="v2-release-keep-active"><Text style={styles.keepLabel}>{RELEASE_COPY.keepAnchorCta}</Text></Pressable></Animated.View>
        </Animated.View>
      </View>
      {stage === 'dissolving' ? <V2DissolutionCeremony artworkSvg={snapshot.artworkSvg} anchorId={anchorId}
        category={snapshot.category} reduceMotion={reduceMotion} clock={clock} artworkAlreadyMounted
        onEmptyPause={startSilence} onDissolutionComplete={release.markDissolutionComplete} /> : null}
      <View ref={place.ref} collapsable={false} onLayout={handleArtworkLayout} pointerEvents="none"
        accessibilityElementsHidden={!showArtwork || place.hidden} importantForAccessibility={!showArtwork || place.hidden ? 'no-hide-descendants' : 'auto'}
        style={[styles.artwork, { left: art.x, top: art.y, width: art.width, height: art.height, opacity: showArtwork && !place.hidden ? 1 : 0 }]}>
        <V2ReleaseArtwork anchorId={snapshot.anchorId} artworkSvg={snapshot.artworkSvg} imageUrl={snapshot.imageUrl}
          expression={snapshot.expression} category={snapshot.category} size={art.width} active={stage === 'dissolving'} reduceMotion={reduceMotion} clock={clock} />
      </View>
      {stage === 'confirming' || stage === 'failed' ? <V2ReleaseChamberStatus variant={stage === 'failed' ? 'failed' : 'confirming'}
        message={release.message} retryable={stage === 'failed' || release.retryable} onRetry={stage === 'failed' ? handleFreshHold : release.retry}
        onDismiss={stage === 'failed' ? handleCancel : undefined} /> : null}
      {stage === 'completed' ? <V2ReleaseCompletion intentionText={snapshot.intentionText} reduceMotion={reduceMotion}
        onPrimary={handleComplete} onSecondary={onViewHistory} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: RELEASE_CEREMONY_CHAMBER_BG },
  creamSurface: { position: 'absolute', top: 0, left: 0, right: 0 },
  identifierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  keepControl: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  keepLabel: { ...releaseTypography.small, color: 'rgba(244,237,224,0.55)' },
  header: { position: 'absolute', left: spacing[6], right: spacing[6] },
  kicker: { ...releaseTypography.small, color: colors.text.secondary },
  intention: { ...releaseTypography.title, color: colors.ink.base },
  subtitle: { ...releaseTypography.small, color: colors.text.secondary, marginTop: spacing[3] },
  artwork: { position: 'absolute' },
  rows: { position: 'absolute', left: spacing[6], right: spacing[6] },
  controls: { position: 'absolute', left: spacing[6], right: spacing[6], gap: spacing[1] },
});
