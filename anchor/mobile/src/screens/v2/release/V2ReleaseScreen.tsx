import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, ScrollView, StatusBar, StyleSheet, type LayoutChangeEvent, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2Button, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { V2DissolutionCeremony, V2HoldToReleaseControl, V2ReleaseChamberStatus,
  V2ReleaseCompletion, V2ReleaseConsequenceCard } from '@/components/v2/release';
import { V2ReleaseArtwork } from '@/components/v2/release/V2ReleaseArtwork';
import { releaseArtworkRect, segment } from '@/components/v2/release/releaseBurn';
import { releaseTypography } from '@/components/v2/release/releaseTypography';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useReleaseHold, useV2Release } from '@/hooks/v2/release';
import { useReleaseBurnFeel } from '@/hooks/v2/release/useReleaseBurnFeel';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';
import { RELEASE_COPY, RELEASE_CEREMONY_CHAMBER_BG, RELEASE_FIRE_PREPARE_AT, type V2ReleaseActionId } from '@/constants/v2/release';
import { colors, getCategoryColor, spacing } from '@/theme/v2';
import { releaseHoldHint, type V2ReleaseAdapter } from '@/adapters/v2/release';
import type { V2ReleaseContinuationCallbacks, V2ReleaseRouteParams } from './releaseRoutes';
import { useAnchorTransitionPlace } from '@/navigation/v2/ProgressiveFocusTransition';

export interface V2ReleaseScreenProps extends Partial<V2ReleaseRouteParams>, V2ReleaseContinuationCallbacks {
  releaseAdapter?: V2ReleaseAdapter;
  hasLinkedVision?: boolean;
  /** Navigation host can lock gestures/removal while a committed operation resolves. */
  onSessionActiveChange?: (active: boolean) => void;
  /** False while another screen covers this one: an unfinished hold is cancelled. */
  focused?: boolean;
  testID?: string;
}

/** One scene transforms around the same Anchor; the mutation hook remains authoritative. */
export function V2ReleaseScreen({ anchorId = '', reason, successor, releaseAdapter, hasLinkedVision,
  onReleaseCompleted, onCancel, onViewHistory, onViewProgress, onContinueToChart, onViewCompletedChart,
  onContinueWithSuccessor, onCreateSuccessor, onSessionActiveChange, focused = true, testID }: V2ReleaseScreenProps) {
  const reduceMotion = useV2ReduceMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useSharedValue(0);
  const entranceStarted = useRef(false);
  const entranceHeader = useSharedValue(0);
  const entranceRows = useSharedValue(0);
  const entranceControls = useSharedValue(0);
  useEffect(() => {
    if (entranceStarted.current) return;
    entranceStarted.current = true;
    const config = { duration: reduceMotion ? 120 : 420, easing: reduceMotion ? Easing.linear : Easing.out(Easing.cubic) };
    entranceHeader.value = withDelay(reduceMotion ? 0 : 40, withTiming(1, config));
    entranceRows.value = withDelay(reduceMotion ? 0 : 120, withTiming(1, config));
    entranceControls.value = withDelay(reduceMotion ? 0 : 220, withTiming(1, config));
  }, [reduceMotion, entranceHeader, entranceRows, entranceControls]);
  useEffect(() => () => {
    cancelAnimation(entranceHeader);
    cancelAnimation(entranceRows);
    cancelAnimation(entranceControls);
  }, [entranceHeader, entranceRows, entranceControls]);
  const [silent, setSilent] = useState(false);
  const [controlsHeight, setControlsHeight] = useState(120);
  const release = useV2Release({ anchorId, adapter: releaseAdapter, reason, successor, hasLinkedVision });
  const feel = useReleaseBurnFeel();
  const releaseFall = useRef<CreationSoundHandle | null>(null);
  const stopReleaseFall = useCallback(() => { releaseFall.current?.stop(); releaseFall.current = null; }, []);
  // Commitment is tactile, not a success notification: the medium pulse is the ignition, and the
  // burn's sound + swell start on the same instant. Success belongs to the result reveal.
  const holdHaptics = useMemo(() => ({ selection: v2Haptics.selection,
    completion: () => { stopReleaseFall(); feel.begin(reduceMotion); return safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium); } }), [feel.begin, reduceMotion, stopReleaseFall]);
  const hold = useReleaseHold({ reduceMotion, haptics: holdHaptics, onComplete: release.startRelease,
    onCancel: () => { stopReleaseFall(); AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.cancelAnnouncement); },
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
  // The relationships changed under the hold: it was rejected, so it must be repeated.
  useEffect(() => {
    if (!release.stale) return;
    stopReleaseFall();
    feel.end();
    hold.reset();
    AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.staleNotice);
  }, [release.stale, hold.reset, feel.end, stopReleaseFall]);
  // Backstop: if the release never reaches (or leaves) the burn, nothing keeps sounding or buzzing.
  useEffect(() => { if (release.stage !== 'preflight' && release.stage !== 'dissolving') feel.end(); }, [release.stage, feel.end]);
  useEffect(() => {
    if (release.stage === 'failed') AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.failureAnnouncement);
  }, [release.stage]);
  // An unknown result reconciles the same operation (same key) when the app returns; it never replays the ceremony.
  useEffect(() => {
    if (release.stage !== 'confirming') return undefined;
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && release.retryable) release.retry(); });
    return () => subscription.remove();
  }, [release.stage, release.retryable, release.retry]);

  // The cream surface is one sheet that gives way to the chamber as the hold fills.
  const creamStyle = useAnimatedStyle(() => ({
    backgroundColor: colors.frame,
    opacity: active ? 0 : 1 - segment(hold.visualProgress.value, 0.12, 0.9),
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: active ? 0 : entranceHeader.value * (1 - segment(hold.visualProgress.value, 0.05, 0.65)),
    transform: [{ translateY: reduceMotion ? 0 : (1 - entranceHeader.value) * 8 }],
  }));
  const rowsStyle = useAnimatedStyle(() => ({
    opacity: active ? 0 : entranceRows.value * (1 - segment(hold.visualProgress.value, 0, 0.45)),
    transform: [{ translateY: reduceMotion ? 0 : (1 - entranceRows.value) * 8 }],
  }));
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: active ? 0 : entranceControls.value * (1 - segment(hold.visualProgress.value, 0.86, 1)),
    transform: [{ translateY: reduceMotion ? 0 : (1 - entranceControls.value) * 8 }],
  }));
  const keepStyle = useAnimatedStyle(() => ({ opacity: 1 - segment(hold.visualProgress.value, 0.02, 0.35) }));
  const handleArtworkLayout = useCallback((event: LayoutChangeEvent) => {
    place.onLayout();
    const { x, y, width: w, height: h } = event.nativeEvent.layout;
    if (!active && !hold.isHolding && w > 0 && h > 0) measuredRect.current = { x, y, width: w, height: h };
  }, [place.onLayout, active, hold.isHolding]);
  const handleControlsLayout = useCallback((event: LayoutChangeEvent) => setControlsHeight(Math.ceil(event.nativeEvent.layout.height)), []);
  const handleHoldStart = useCallback(() => { stopReleaseFall(); releaseFall.current = playCreationSound('releaseFall'); setHeldRect(measuredRect.current); release.beginHold(); hold.beginHold(); }, [hold.beginHold, release.beginHold, stopReleaseFall]);
  const handleHoldEnd = useCallback(() => { stopReleaseFall(); hold.endHold(); }, [hold.endHold, stopReleaseFall]);
  // Another screen covering this one is a cancellation: no request, no completion haptic.
  useEffect(() => { if (!focused) handleHoldEnd(); }, [focused, handleHoldEnd]);
  const handleCancel = useCallback(() => { handleHoldEnd(); onCancel(); }, [handleHoldEnd, onCancel]);
  const handleFreshHold = useCallback(() => { stopReleaseFall(); release.reset(); hold.reset(); setSilent(false); }, [release.reset, hold.reset, stopReleaseFall]);
  // The coin is gone: sound and haptics stop in the same beat the screen goes black.
  const startSilence = useCallback(() => { feel.end(); if (!reduceMotion) playCreationSound('releaseResolve'); setSilent(true); }, [feel.end, reduceMotion]);
  useEffect(() => () => stopReleaseFall(), [stopReleaseFall]);
  const courseId = release.snapshot?.courseId ?? null;
  const handleAction = useCallback((action: V2ReleaseActionId) => {
    const ending = release.ending;
    if (!ending) return;
    const home = () => onReleaseCompleted(anchorId, ending);
    switch (action) {
      case 'progress':
        if (onViewProgress) onViewProgress(anchorId); else if (onViewHistory) onViewHistory(); else home();
        break;
      case 'chart':
        if (onContinueToChart) onContinueToChart(courseId, anchorId); else home();
        break;
      case 'completed_chart':
        if (onViewCompletedChart) onViewCompletedChart(courseId, anchorId); else home();
        break;
      case 'successor':
        if (onContinueWithSuccessor && release.snapshot?.successor) onContinueWithSuccessor(release.snapshot.successor.anchorId); else home();
        break;
      default:
        home();
    }
  }, [release.ending, release.snapshot, anchorId, courseId, onReleaseCompleted, onViewProgress, onViewHistory,
    onContinueToChart, onViewCompletedChart, onContinueWithSuccessor]);

  if (release.anchorMissing || !release.snapshot) return (
    <V2Screen testID={testID ?? 'v2-release-screen'}>
      <V2TopBar title="Release" onBackPress={handleCancel} />
      <V2EmptyState title="Anchor unavailable" message="This Anchor is no longer available to release." />
    </V2Screen>
  );
  const { snapshot, stage } = release;
  const showArtwork = !silent && (stage === 'preflight' || stage === 'dissolving');
  const headerTop = insets.top + 8;
  const headerHeight = Math.max(72, art.y - headerTop - 12);
  const rowsTop = art.y + art.height + 16;
  const rowsBottom = controlsHeight + insets.bottom + 24;

  return (
    <View style={styles.scene} testID={testID ?? 'v2-release-screen'}>
      {/* 4.85–5.15s is pure #0B0C0D, status bar content included. */}
      <StatusBar hidden={silent} barStyle={active ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, creamStyle]} />
      <View pointerEvents={active ? 'none' : 'auto'} accessibilityElementsHidden={active}
        importantForAccessibility={active ? 'no-hide-descendants' : 'auto'} style={StyleSheet.absoluteFill} testID="v2-release-preflight">
        <Animated.View style={[styles.header, { top: headerTop, height: headerHeight }, headerStyle]}>
          <View style={styles.identifierRow}>
            <Pressable onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back} testID="v2-release-back">
              <ArrowLeft size={22} color={colors.ink.base} />
            </Pressable>
            <Text style={styles.kicker}>{RELEASE_COPY.preflightKicker}</Text>
          </View>
          {/* DEFERRED: The old heading/subtitle block is no longer rendered; copy is retained in RELEASE_COPY. */}
        </Animated.View>
        <Animated.View style={[styles.rows, { top: rowsTop, bottom: rowsBottom }, rowsStyle]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rowsContent}>
            <View style={styles.intentionRow}>
              <View style={[styles.dot, { backgroundColor: getCategoryColor(snapshot.category) }]} testID="v2-release-category-dot" />
              <Text style={styles.intention} testID="v2-release-intention" accessibilityRole="header">{snapshot.intentionText}</Text>
            </View>
            {release.stale ? <Text style={styles.notice} accessibilityLiveRegion="polite" testID="v2-release-stale">{RELEASE_COPY.staleNotice}</Text> : null}
            <V2ReleaseConsequenceCard consequences={snapshot.consequences} />
          </ScrollView>
        </Animated.View>
        <Animated.View onLayout={handleControlsLayout} style={[styles.controls, { bottom: insets.bottom + 12 }, controlsStyle]}>
          {release.canRelease ? (
            <V2HoldToReleaseControl artworkSvg={snapshot.artworkSvg} imageUrl={snapshot.imageUrl} category={snapshot.category}
              progress={hold.progress} visualProgress={hold.visualProgress} isHolding={hold.isHolding}
              disabled={hold.isComplete} accessibilityHint={releaseHoldHint(snapshot.reason, RELEASE_COPY)}
              onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
          ) : (
            <View style={styles.successorMissing} testID="v2-release-successor-missing">
              <Text style={styles.heading} accessibilityRole="header">{RELEASE_COPY.successorMissingTitle}</Text>
              <Text style={styles.subtitle}>{RELEASE_COPY.successorMissingBody}</Text>
              <V2Button variant="primary" size="large" onPress={() => (onCreateSuccessor ?? handleCancel)()} testID="v2-release-create-successor">{RELEASE_COPY.successorMissingCta}</V2Button>
            </View>
          )}
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
          expression={snapshot.expression} category={snapshot.category} size={art.width} active={stage === 'dissolving'} reduceMotion={reduceMotion} clock={clock}
          prepare={hold.progress >= RELEASE_FIRE_PREPARE_AT} />
      </View>
      {stage === 'confirming' || stage === 'failed' ? <V2ReleaseChamberStatus variant={stage === 'failed' ? 'failed' : 'confirming'}
        message={release.message} retryable={stage === 'failed' || release.retryable} onRetry={stage === 'failed' ? handleFreshHold : release.retry}
        onDismiss={stage === 'failed' ? handleCancel : undefined} /> : null}
      {stage === 'completed' && release.ending ? <V2ReleaseCompletion ending={release.ending} reduceMotion={reduceMotion}
        ghostSvg={snapshot.artworkSvg} ghostImageUrl={snapshot.imageUrl} category={snapshot.category} expression={snapshot.expression}
        onAction={handleAction} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: RELEASE_CEREMONY_CHAMBER_BG },
  identifierRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  keepControl: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  keepLabel: { ...releaseTypography.small, color: colors.text.secondary },
  header: { position: 'absolute', left: spacing[6], right: spacing[6] },
  heading: { ...releaseTypography.title, color: colors.ink.base },
  kicker: { ...releaseTypography.kicker, color: colors.text.secondary, flex: 1 },
  subtitle: { ...releaseTypography.small, color: colors.text.secondary, marginTop: spacing[1] },
  intentionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 13 },
  intention: { ...releaseTypography.serifIntention, color: colors.ink.base, flex: 1 },
  notice: { ...releaseTypography.small, color: colors.semantic.warning },
  artwork: { position: 'absolute' },
  rows: { position: 'absolute', left: spacing[6], right: spacing[6] },
  rowsContent: { gap: spacing[3], paddingBottom: spacing[2] },
  controls: { position: 'absolute', left: spacing[6], right: spacing[6], gap: spacing[1] },
  successorMissing: { gap: spacing[2] },
});
