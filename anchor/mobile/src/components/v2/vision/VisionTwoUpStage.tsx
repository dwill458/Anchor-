import type { ViewInstance } from 'react-native';
// DEFERRED: replaced by ceremony Develop/Choose.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Modal, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import type { VisionGenerationCandidate, VisionGenerationJob } from '@/hooks/v2/vision';
import { colors, spacing } from '@/theme/v2';
import type { VisionAnchorArt } from './VisionChrome';
import type { VisionImageRect } from './VisionImageArrival';
import { VisionBackButton, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { VisionImageEdge } from './VisionImageEdge';
import { VISION_TWO_UP_COUNT, VISION_TWO_UP_TIMING, visionTwoUpState } from './visionTwoUp';

export type VisionTwoUpSelection = {
  /** Where the chosen photograph is on screen right now. */
  image: VisionImageRect | null;
  /** Where the Anchor mark is on screen right now. */
  anchor: VisionImageRect | null;
};

export interface VisionTwoUpStageProps {
  anchorIntention: string;
  anchorArt?: VisionAnchorArt | null;
  job: VisionGenerationJob | null;
  /** Called only after the person confirms the full-screen preview. */
  onSelect: (candidate: VisionGenerationCandidate, selection: VisionTwoUpSelection) => void;
  onBack: () => void;
  onRetry?: () => void;
  onEditDescription?: () => void;
  /** True while the chosen image is being saved; further taps are ignored. */
  busy?: boolean;
  error?: string | null;
  testID?: string;
}

/** Where a view is on screen. Never hangs the choice: a view that cannot be measured resolves to null. */
function measure(node: ViewInstance | null): Promise<VisionImageRect | null> {
  return new Promise(resolve => {
    if (!node?.measureInWindow) { resolve(null); return; }
    const giveUp = setTimeout(() => resolve(null), 150);
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(giveUp);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

/**
 * Generation and choice on one dark, restrained screen. Two photographs develop
 * from haze into clarity; when they are ready the images themselves are the
 * controls. The copy describes the wait; readiness comes only from the server job.
 */
export const VisionTwoUpStage = memo(function VisionTwoUpStage({
  anchorIntention, anchorArt, job, onSelect, onBack, onRetry, onEditDescription, busy = false, error, testID = 'vision-two-up',
}: VisionTwoUpStageProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => subscription.remove();
  }, []);
  const state = useMemo(() => visionTwoUpState(job), [job]);
  const settling = useRef(false);
  const [preview, setPreview] = useState<VisionGenerationCandidate | null>(null);
  const previewRef = useRef<ViewInstance>(null);
  const previewAnchorRef = useRef<ViewInstance>(null);
  const previewAspect = useRef<{ id: string; ratio: number } | null>(null);
  useEffect(() => { if (!busy) settling.current = false; }, [busy, error, preview?.id]);
  const [waitBeat, setWaitBeat] = useState(0);
  useEffect(() => {
    setWaitBeat(0);
    if (state.selectable || state.phase === 'failed') return;
    const timers = [9000, 20000, 40000].map((delay, index) => setTimeout(() => setWaitBeat(index + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, [job?.id, state.selectable, state.phase === 'failed']);
  const waitCopy = ['Reading your moment…', 'Composing the scene…', 'Developing the images…', 'Giving your images time to develop…'][waitBeat];
  const anchorRef = useRef<ViewInstance>(null);

  const gutter = spacing[5];
  const gap = 14;
  const photoWidth = Math.floor((width - gutter * 2 - gap) / VISION_TWO_UP_COUNT);
  const photoHeight = Math.min(Math.round(photoWidth * 1.5), Math.round(height * 0.46));
  const anchorSize = 76;

  // Surfaces appear shortly after the work starts; the Anchor breathes while it waits.
  const surfaces = useSharedValue(reduceMotion ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    surfaces.value = reduceMotion ? 1 : withTiming(1, { duration: VISION_TWO_UP_TIMING.surfacesInMs, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, state.phase, surfaces]);
  useEffect(() => {
    if (reduceMotion || !foreground || preview || state.selectable || state.phase === 'failed') { cancelAnimation(breath); breath.value = reduceMotion ? 0 : withTiming(0, { duration: 320 }); return; }
    breath.value = withRepeat(withSequence(
      withTiming(1, { duration: VISION_TWO_UP_TIMING.anchorBreathMs, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: VISION_TWO_UP_TIMING.anchorBreathMs, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    return () => cancelAnimation(breath);
  }, [breath, foreground, preview, reduceMotion, state.selectable, state.phase]);
  // Large and centred while nothing exists yet, settling to its place as the photographs appear.
  const anchorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.78, 1]),
    transform: [
      { translateY: (1 - surfaces.value) * 30 },
      { scale: interpolate(surfaces.value, [0, 1], [1.7, 1]) * interpolate(breath.value, [0, 1], [0.97, 1.03]) },
    ],
  }));
  const surfacesStyle = useAnimatedStyle(() => ({ opacity: surfaces.value, transform: [{ translateY: (1 - surfaces.value) * 12 }] }));

  // Selection is a preview; only an explicit confirmation persists an image.
  const choose = useCallback((candidate: VisionGenerationCandidate) => {
    if (!state.selectable || busy || !candidate.imageUrl) return;
    v2Haptics.selection();
    setPreview(candidate);
  }, [busy, state.selectable]);

  const confirm = async () => {
    if (!preview || busy || settling.current) return;
    settling.current = true;
    const [bounds, anchor] = await Promise.all([measure(previewRef.current), measure(previewAnchorRef.current)]);
    const ratio = previewAspect.current?.id === preview.id ? previewAspect.current.ratio : null;
    // Hand off the visible photograph, excluding contain-fit letterboxing.
    let image = bounds;
    if (bounds && ratio) {
      const w = Math.min(bounds.width, bounds.height * ratio);
      const h = w / ratio;
      image = { x: bounds.x + (bounds.width - w) / 2, y: bounds.y + (bounds.height - h) / 2, width: w, height: h };
    }
    onSelect(preview, { image, anchor });
  };

  const editDescription = () => {
    if (busy) return;
    setPreview(null);
    onEditDescription?.();
  };

  const failed = state.phase === 'failed';
  const hasAny = state.ready.length > 0;

  return (
    <View testID={testID} style={styles.stage}>
      <StatusBar barStyle="light-content" animated />
      <LinearGradient pointerEvents="none" colors={[colors.ink.base, colors.ink.deep, '#090D12']} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + spacing[2] }]}>
        <VisionBackButton onPress={onBack} style={styles.back} />
        <View style={styles.kickerRow} accessible accessibilityLabel="Your Vision">
          <View style={styles.flank} /><View style={styles.diamond} /><View style={styles.flank} />
        </View>
        <Text style={styles.kicker}>YOUR VISION</Text>
        <Text testID={`${testID}-title`} accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{state.title}</Text>
        <Animated.Text key={state.selectable ? 'choose' : `wait-${waitBeat}`} entering={reduceMotion ? undefined : FadeIn.duration(350)} testID={`${testID}-subtitle`} accessibilityLiveRegion="polite" style={styles.subtitle}>{state.selectable || failed ? state.subtitle : waitCopy}</Animated.Text>
      </Animated.View>

      <View style={styles.anchorSlot} pointerEvents="none">
        <Animated.View ref={anchorRef} collapsable={false} testID={`${testID}-anchor`} style={[{ width: anchorSize, height: anchorSize }, anchorStyle]}
          accessible accessibilityRole="image" accessibilityLabel="Your Anchor">
          {anchorArt ? <CircularAnchorRenderer {...anchorArt} size={anchorSize} appearance="paper" testID={`${testID}-anchor-artwork`} /> : null}
        </Animated.View>
      </View>

      <Animated.View style={[styles.photos, { gap, paddingHorizontal: gutter, paddingBottom: insets.bottom + 72 }, surfacesStyle]}>
        {state.slots.map((candidate, index) => (
          <DevelopingPhoto
            key={candidate?.id ?? `slot-${index}`}
            index={index}
            candidate={candidate}
            width={photoWidth}
            height={photoHeight}
            selectable={state.selectable && !busy}
            reduceMotion={reduceMotion}
            active={foreground && !preview && state.phase !== 'failed'}
            onPress={() => { if (candidate) void choose(candidate); }}
            testID={candidate ? `scene-candidate-${candidate.id}` : `${testID}-slot-${index}`}
          />
        ))}
      </Animated.View>

      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
        {error && !preview ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {state.phase === 'choose' && onEditDescription ? (
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={editDescription} style={styles.link}>
            <Text style={styles.linkText}>Neither feels right — try again</Text>
          </Pressable>
        ) : null}
        {failed ? (
          <View style={styles.failure} testID={`${testID}-failed`}>
            <Text style={styles.failureTitle}>Your Vision needs another moment.</Text>
            <Text style={styles.failureBody}>{hasAny ? 'The moment that is here is ready to choose. You can also try again.' : 'We could not bring your Vision into view just yet. Please try again.'}</Text>
            <View style={styles.failureActions}>
              {onRetry ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Retry this set" onPress={onRetry} style={styles.retry}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              ) : null}
              {onEditDescription ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Edit description" onPress={onEditDescription} hitSlop={8} style={styles.link}>
                  <Text style={styles.linkText}>Edit description</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </Animated.View>
      <Modal visible={Boolean(preview)} animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => { if (!busy) setPreview(null); }}>
        <View style={[styles.stage, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={{ paddingHorizontal: gutter, paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <VisionBackButton label="Back to images" onPress={() => { if (!busy) setPreview(null); }} />
            <View ref={previewAnchorRef} collapsable={false} style={{ width: 44, height: 44 }}>
              {anchorArt ? <CircularAnchorRenderer {...anchorArt} size={44} appearance="paper" testID={`${testID}-preview-anchor-artwork`} /> : null}
            </View>
          </View>
          <View ref={previewRef} collapsable={false} style={{ flex: 1, marginHorizontal: gutter }}>
            {preview?.imageUrl ? <Image source={{ uri: preview.imageUrl }} resizeMode="contain" onLoad={event => { const source = event.nativeEvent.source; if (source?.width > 0 && source?.height > 0) previewAspect.current = { id: preview.id, ratio: source.width / source.height }; }} style={styles.fill} accessibilityLabel="Selected Vision image" /> : null}
          </View>
          <View style={{ padding: gutter, gap: spacing[2], alignItems: 'center' }}>
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Use this one" disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={() => { void confirm(); }} style={[styles.retry, { alignSelf: 'stretch', opacity: busy ? 0.5 : 1 }]}>
              <Text style={styles.retryText}>{busy ? 'Saving…' : 'Use this one'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={editDescription} style={styles.link}>
              <Text style={styles.linkText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
});

type PhotoProps = {
  index: number;
  candidate: VisionGenerationCandidate | null;
  width: number;
  height: number;
  selectable: boolean;
  reduceMotion: boolean;
  active: boolean;
  onPress: () => void;
  testID: string;
};

/** One photograph: haze while it is being made, then blur to clarity, then a control. */
const DevelopingPhoto = memo(function DevelopingPhoto({
  index, candidate, width, height, selectable, reduceMotion, active, onPress, testID,
}: PhotoProps) {
  const url = candidate?.imageUrl ?? null;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const decoded = Boolean(url && loadedUrl === url);
  const develop = useSharedValue(reduceMotion ? 1 : 0);
  const haze = useSharedValue(0.4);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (decoded || reduceMotion || !active) return;
    sweep.value = withRepeat(withTiming(1, { duration: 4200 + index * 500, easing: Easing.linear }), -1, false);
    haze.value = withRepeat(withSequence(
      withTiming(0.8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.35, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    return () => { cancelAnimation(haze); cancelAnimation(sweep); };
  }, [active, decoded, haze, index, reduceMotion, sweep]);

  useEffect(() => {
    if (!decoded) return;
    cancelAnimation(haze);
    cancelAnimation(sweep);
    develop.value = reduceMotion ? 1 : withTiming(1, { duration: VISION_TWO_UP_TIMING.developMs + index * 160, easing: Easing.out(Easing.cubic) });
  }, [decoded, develop, haze, index, reduceMotion, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion || decoded ? 0 : Math.sin(sweep.value * Math.PI) * 0.55,
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-width, width]) }, { rotate: '-18deg' }],
  }));
  const sharpStyle = useAnimatedStyle(() => ({ opacity: develop.value }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: 1 - interpolate(develop.value, [0, 0.85], [0, 1], 'clamp') }));
  const hazeStyle = useAnimatedStyle(() => ({ opacity: haze.value * (1 - develop.value) }));
  const label = candidate && url
    ? `Choose this moment, option ${index + 1} of ${VISION_TWO_UP_COUNT}`
    : `Moment ${index + 1} of ${VISION_TWO_UP_COUNT} is still being made`;

  return (
    <View>
      <Pressable
        collapsable={false}
        testID={testID}
        accessibilityRole={selectable && url ? 'button' : 'image'}
        accessibilityLabel={label}
        accessibilityState={{ selected: false, disabled: !(selectable && url) }}
        disabled={!(selectable && url)}
        onPress={onPress}
        style={[styles.photo, { width, height }]}
      >
        <View style={styles.hazeSurface} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id={`haze-a-${index}`} cx={index === 0 ? '32%' : '66%'} cy="34%" r="70%">
                <Stop offset="0" stopColor="#D2B48A" stopOpacity="0.34" />
                <Stop offset="1" stopColor="#D2B48A" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id={`haze-b-${index}`} cx={index === 0 ? '70%' : '30%'} cy="72%" r="64%">
                <Stop offset="0" stopColor="#9C8480" stopOpacity="0.28" />
                <Stop offset="1" stopColor="#9C8480" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="#1A222B" />
            <Rect width="100%" height="100%" fill={`url(#haze-a-${index})`} />
            <Rect width="100%" height="100%" fill={`url(#haze-b-${index})`} />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, styles.hazeGlow, hazeStyle]} />
        </View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -height * 0.2, width: width * 0.8, height: height * 1.4 }, sweepStyle]}>
          <LinearGradient colors={['transparent', 'rgba(241,232,214,0.32)', 'transparent']} style={styles.fill} />
        </Animated.View>
        {url ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
              <Image source={{ uri: url }} blurRadius={22} resizeMode="cover" accessible={false} style={styles.fill} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, sharpStyle]} pointerEvents="none">
              <Image source={{ uri: url }} onLoad={() => setLoadedUrl(url)} onError={() => setLoadedUrl(null)} resizeMode="cover"
                accessible={false} accessibilityIgnoresInvertColors style={styles.fill} />
            </Animated.View>
          </>
        ) : null}
        <VisionImageEdge color={colors.ink.base} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.ink.base },
  top: { alignItems: 'center', paddingHorizontal: spacing[5] },
  back: { alignSelf: 'flex-start', marginBottom: spacing[1] },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing[1] },
  flank: { width: 34, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.6 },
  diamond: { width: 5, height: 5, backgroundColor: VISION_GOLD, transform: [{ rotate: '45deg' }] },
  kicker: { marginTop: spacing[2], fontFamily: 'Inter-SemiBold', fontSize: 11, letterSpacing: 2.4, color: VISION_GOLD },
  title: { alignSelf: 'stretch', marginTop: spacing[3], fontFamily: VISION_SERIF, fontSize: 30, lineHeight: 34, letterSpacing: -0.4, textAlign: 'center', color: colors.ink.text.primary },
  subtitle: { alignSelf: 'stretch', marginTop: spacing[2], fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, textAlign: 'center', color: colors.ink.text.secondary },
  anchorSlot: { alignItems: 'center', justifyContent: 'center', marginTop: spacing[5], minHeight: 76 },
  photos: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginTop: spacing[5] },
  photo: { overflow: 'hidden', borderRadius: 2, backgroundColor: '#10161D' },
  fill: { width: '100%', height: '100%' },
  hazeSurface: { ...StyleSheet.absoluteFill },
  hazeGlow: { backgroundColor: 'rgba(226,208,176,0.10)' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[5], alignItems: 'center', gap: spacing[3] },
  error: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, textAlign: 'center', color: colors.ink.text.secondary },
  failure: { alignItems: 'center', gap: spacing[2] },
  failureTitle: { fontFamily: VISION_SERIF, fontSize: 22, lineHeight: 28, textAlign: 'center', color: colors.ink.text.primary },
  failureBody: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, textAlign: 'center', color: colors.ink.text.secondary },
  failureActions: { alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  retry: { minHeight: 48, minWidth: 160, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5], backgroundColor: colors.ink.text.primary },
  retryText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: colors.ink.deep },
  link: { minHeight: 36, justifyContent: 'center' },
  linkText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: colors.ink.text.primary, textDecorationLine: 'underline' },
});
