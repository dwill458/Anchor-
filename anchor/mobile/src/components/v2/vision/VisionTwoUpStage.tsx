import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SigilSvg } from '@/components/common/SigilSvg';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import type { VisionGenerationCandidate, VisionGenerationJob } from '@/hooks/v2/vision';
import { colors, spacing } from '@/theme/v2';
import type { VisionAnchorArt } from './VisionChrome';
import type { VisionImageRect } from './VisionImageArrival';
import { VisionBackButton, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { VisionImageEdge } from './VisionImageEdge';
import { VISION_TWO_UP_COUNT, VISION_TWO_UP_TIMING, visionTwoUpState } from './visionTwoUp';

/** The Anchor's strokes, in the same cream the creation formation uses on ink. */
const ANCHOR_CREAM = '#F1E8D6';

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
  /** Called once the person has tapped an image and the choice has settled. */
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
function measure(node: View | null): Promise<VisionImageRect | null> {
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
 * controls. Progress is real (the job's state), never a percentage or a stage.
 */
export const VisionTwoUpStage = memo(function VisionTwoUpStage({
  anchorIntention, anchorArt, job, onSelect, onBack, onRetry, onEditDescription, busy = false, error, testID = 'vision-two-up',
}: VisionTwoUpStageProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const state = useMemo(() => visionTwoUpState(job), [job]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const settling = useRef(false);
  const photoRefs = useRef<Record<string, View | null>>({});
  const anchorRef = useRef<View>(null);

  const gutter = spacing[5];
  const gap = 14;
  const photoWidth = Math.floor((width - gutter * 2 - gap) / VISION_TWO_UP_COUNT);
  const photoHeight = Math.min(Math.round(photoWidth * 1.5), Math.round(height * 0.46));
  const anchorSize = 76;

  // Surfaces appear shortly after the work starts; the Anchor breathes while it waits.
  const surfaces = useSharedValue(reduceMotion ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (state.phase === 'starting') return;
    surfaces.value = reduceMotion ? 1 : withTiming(1, { duration: VISION_TWO_UP_TIMING.surfacesInMs, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, state.phase, surfaces]);
  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withSequence(
      withTiming(1, { duration: VISION_TWO_UP_TIMING.anchorBreathMs, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: VISION_TWO_UP_TIMING.anchorBreathMs, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);
  // Large and centred while nothing exists yet, settling to its place as the photographs appear.
  const anchorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.78, 1]),
    transform: [
      { translateY: (1 - surfaces.value) * 30 },
      { scale: interpolate(surfaces.value, [0, 1], [1.7, 1]) * interpolate(breath.value, [0, 1], [0.97, 1.03]) },
    ],
  }));
  const surfacesStyle = useAnimatedStyle(() => ({ opacity: surfaces.value, transform: [{ translateY: (1 - surfaces.value) * 12 }] }));
  const chrome = useSharedValue(1);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  const choose = useCallback(async (candidate: VisionGenerationCandidate) => {
    if (!state.selectable || busy || settling.current || !candidate.imageUrl) return;
    settling.current = true;
    v2Haptics.selection();
    setSelectedId(candidate.id);
    chrome.value = reduceMotion ? 0 : withTiming(0, { duration: VISION_TWO_UP_TIMING.selectLiftMs * 1.4 });
    const [image, anchor] = await Promise.all([measure(photoRefs.current[candidate.id] ?? null), measure(anchorRef.current)]);
    setTimeout(() => {
      settling.current = false;
      onSelect(candidate, { image, anchor });
    }, reduceMotion ? 0 : VISION_TWO_UP_TIMING.selectHandoffMs);
  }, [busy, chrome, onSelect, reduceMotion, state.selectable]);

  // A hand-off that did not complete returns the screen to a choosable state.
  useEffect(() => {
    if (!error) return;
    setSelectedId(null);
    chrome.value = 1;
  }, [chrome, error]);

  const failed = state.phase === 'failed';
  const hasAny = state.ready.length > 0;

  return (
    <View testID={testID} style={styles.stage}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <LinearGradient pointerEvents="none" colors={[colors.ink.base, colors.ink.deep, '#090D12']} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + spacing[2] }, chromeStyle]}>
        <VisionBackButton onPress={onBack} style={styles.back} />
        <View style={styles.kickerRow} accessible accessibilityLabel="Your Vision">
          <View style={styles.flank} /><View style={styles.diamond} /><View style={styles.flank} />
        </View>
        <Text style={styles.kicker}>YOUR VISION</Text>
        <Text testID={`${testID}-title`} accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{state.title}</Text>
        <Text testID={`${testID}-subtitle`} style={styles.subtitle}>{state.subtitle}</Text>
      </Animated.View>

      <View style={styles.anchorSlot} pointerEvents="none">
        <Animated.View ref={anchorRef} collapsable={false} testID={`${testID}-anchor`} style={[{ width: anchorSize, height: anchorSize }, anchorStyle]}
          accessible accessibilityRole="image" accessibilityLabel="Your Anchor">
          {anchorArt?.svg ? <SigilSvg xml={anchorArt.svg} width="100%" height="100%" color={ANCHOR_CREAM} /> : null}
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
            selected={Boolean(candidate && candidate.id === selectedId)}
            otherSelected={Boolean(selectedId && candidate?.id !== selectedId)}
            reduceMotion={reduceMotion}
            holder={node => { if (candidate) photoRefs.current[candidate.id] = node; }}
            onPress={() => { if (candidate) void choose(candidate); }}
            testID={candidate ? `scene-candidate-${candidate.id}` : `${testID}-slot-${index}`}
          />
        ))}
      </Animated.View>

      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }, chromeStyle]}>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
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
    </View>
  );
});

type PhotoProps = {
  index: number;
  candidate: VisionGenerationCandidate | null;
  width: number;
  height: number;
  selectable: boolean;
  selected: boolean;
  otherSelected: boolean;
  reduceMotion: boolean;
  holder: (node: View | null) => void;
  onPress: () => void;
  testID: string;
};

/** One photograph: haze while it is being made, then blur to clarity, then a control. */
const DevelopingPhoto = memo(function DevelopingPhoto({
  index, candidate, width, height, selectable, selected, otherSelected, reduceMotion, holder, onPress, testID,
}: PhotoProps) {
  const url = candidate?.imageUrl ?? null;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const decoded = Boolean(url && loadedUrl === url);
  const develop = useSharedValue(reduceMotion ? 1 : 0);
  const haze = useSharedValue(0.4);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (decoded) return;
    if (reduceMotion) return;
    haze.value = withRepeat(withSequence(
      withTiming(0.8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.35, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    return () => cancelAnimation(haze);
  }, [decoded, haze, reduceMotion]);

  useEffect(() => {
    if (!decoded) return;
    cancelAnimation(haze);
    develop.value = reduceMotion ? 1 : withTiming(1, { duration: VISION_TWO_UP_TIMING.developMs + index * 160, easing: Easing.out(Easing.cubic) });
  }, [decoded, develop, haze, index, reduceMotion]);

  useEffect(() => {
    const target = selected ? 1 : otherSelected ? -1 : 0;
    lift.value = reduceMotion ? target : withTiming(target, { duration: VISION_TWO_UP_TIMING.selectLiftMs, easing: Easing.out(Easing.cubic) });
  }, [lift, otherSelected, reduceMotion, selected]);

  const sharpStyle = useAnimatedStyle(() => ({ opacity: develop.value }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: 1 - interpolate(develop.value, [0, 0.85], [0, 1], 'clamp') }));
  const hazeStyle = useAnimatedStyle(() => ({ opacity: haze.value * (1 - develop.value) }));
  const frameStyle = useAnimatedStyle(() => ({
    opacity: lift.value < 0 ? 1 + lift.value * 0.65 : 1,
    transform: [{ scale: lift.value >= 0 ? 1 + lift.value * 0.045 : 1 + lift.value * 0.04 }, { translateY: lift.value > 0 ? -lift.value * 6 : 0 }],
  }));

  const label = candidate && url
    ? `Choose this moment, option ${index + 1} of ${VISION_TWO_UP_COUNT}`
    : `Moment ${index + 1} of ${VISION_TWO_UP_COUNT} is still being made`;

  return (
    <Animated.View style={frameStyle}>
      <Pressable
        ref={holder}
        collapsable={false}
        testID={testID}
        accessibilityRole={selectable && url ? 'button' : 'image'}
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled: !(selectable && url) }}
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
    </Animated.View>
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
  hazeSurface: { ...StyleSheet.absoluteFillObject },
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
