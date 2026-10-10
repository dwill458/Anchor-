import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { useV2ReduceMotion } from '@/hooks/v2';
import { playCreationSound } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { VISION_SERIF_ITALIC } from '../VisionPaperChrome';
import { CEREMONY, ceremonyDuration, useDevelopReveal } from './VisionDevelop';
import { visionCeremonyCopy as copy } from './visionCeremonyCopy';
import { VisionHairline } from './VisionHairline';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
export type PrintPlacement = { x: number; y: number; width: number; height: number; rotation?: number; opacity?: number };

/** A stable string for an image source, so a bundled picture can be tracked the way a remote URL is. */
function sourceUri(source?: ImageSourcePropType): string | undefined {
  if (source == null) return undefined;
  const first = Array.isArray(source) ? source[0] : source;
  if (typeof first === 'number') {
    const resolved = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(first) : null;
    return resolved?.uri ?? `asset:${first}`;
  }
  return first && typeof first === 'object' && 'uri' in first ? first.uri : undefined;
}

/** Stable slot: the frame and its photograph keep the same native view through every beat. */
export function VisionPrintSlot({ placement, children, nodeRef, testID, zIndex = 30 }: {
  placement: PrintPlacement; children: React.ReactNode; nodeRef?: React.Ref<View>; testID?: string; zIndex?: number;
}) {
  const reduced = useV2ReduceMotion();
  const x = useSharedValue(placement.x), y = useSharedValue(placement.y);
  const width = useSharedValue(placement.width), height = useSharedValue(placement.height);
  const rotation = useSharedValue(placement.rotation ?? 0), opacity = useSharedValue(placement.opacity ?? 1);
  useEffect(() => {
    const motion = { duration: CEREMONY.printMoveMs, easing: Easing.bezier(.2, .8, .2, 1) };
    x.value = reduced ? placement.x : withTiming(placement.x, motion);
    y.value = reduced ? placement.y : withTiming(placement.y, motion);
    width.value = reduced ? placement.width : withTiming(placement.width, motion);
    height.value = reduced ? placement.height : withTiming(placement.height, motion);
    rotation.value = reduced ? 0 : withTiming(placement.rotation ?? 0, motion);
    opacity.value = withTiming(placement.opacity ?? 1, { duration: ceremonyDuration(CEREMONY.stageFadeMs, reduced) });
  }, [placement.x, placement.y, placement.width, placement.height, placement.rotation, placement.opacity, reduced]);
  const style = useAnimatedStyle(() => ({ left: x.value, top: y.value, width: width.value, height: height.value,
    opacity: opacity.value, transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View ref={nodeRef} collapsable={false} testID={testID} style={[styles.slot, { zIndex }, style]}>{children}</Animated.View>;
}

export interface VisionPrintProps {
  uri?: string;
  /** A bundled picture (the Ask examples). Used in place of `uri` when given. */
  source?: ImageSourcePropType;
  developing: boolean;
  revealed: boolean;
  showCaption: boolean;
  caption: string;
  onChangeCaption?: (caption: string) => void;
  pinned: boolean;
  reframe?: { x: number; y: number };
  onReframe?: (offset: { x: number; y: number }) => void;
  empty?: boolean;
  active?: boolean;
  revealDelayMs?: number;
  onDeveloped?: (uri: string) => void;
  /** Reports an asset that failed to load so the owning flow can offer recovery. */
  onImageError?: (uri: string) => void;
  /** Fires once per image, the moment its reveal begins. */
  onRevealStart?: (uri: string) => void;
  imageRef?: React.Ref<View>;
  pressed?: boolean;
  /** A tiny line above the caption ("Example", "Yours"); also switches the caption to the compact entrance size. */
  label?: string;
  /** Caption strip height; defaults to the ceremony's. */
  captionStripPts?: number;
  captionHint?: boolean;
  /** Reveal duration; defaults to the Develop reveal. The ink layer keeps its ratio to it. */
  revealMs?: number;
  /** Optional ceremony timing for ink, independent of the blur; entrance examples keep their existing ratio. */
  inkRevealMs?: number;
  /** Increment to retry the same failed URI without remounting the enclosing print stack. */
  retryToken?: number;
  /** An empty frame that hides whatever is behind it. */
  opaque?: boolean;
  /** Reveals without the settle sound or haptic. */
  silent?: boolean;
  /** Already developed: no reveal at all. */
  instant?: boolean;
  testID?: string;
}

export function VisionPrint({ uri: uriProp, source, developing, revealed, showCaption, caption, onChangeCaption, pinned,
  reframe, onReframe, empty = false, active = true, revealDelayMs = 0, onDeveloped, onImageError, onRevealStart, imageRef, pressed = false,
  label, captionStripPts, captionHint = false, revealMs, inkRevealMs, opaque = false, silent = false, instant = false, retryToken = 0, testID = 'vision-print' }: VisionPrintProps) {
  const reduced = useV2ReduceMotion();
  const uri = uriProp ?? sourceUri(source);
  const imageSource = source ?? (uri ? { uri } : undefined);
  const strip = captionStripPts ?? CEREMONY.captionStripPts;
  const blurMs = revealMs ?? CEREMONY.revealBlurMs;
  const inkMs = inkRevealMs ?? (revealMs ? Math.round(revealMs * CEREMONY.revealInkMs / CEREMONY.revealBlurMs) : CEREMONY.revealInkMs);
  const prefetched = useDevelopReveal(uri, active, revealDelayMs);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  // Once a print has developed, its blurred layer is invisible; unmount it so each print holds one bitmap, not two.
  const [settledUri, setSettledUri] = useState<string | null>(null);
  const startedUri = useRef<string | null>(null);
  const finishedUri = useRef<string | null>(null);
  const completed = useRef(onDeveloped); completed.current = onDeveloped;
  const revealing = useRef(onRevealStart); revealing.current = onRevealStart;
  const ink = useSharedValue(instant ? 0 : 1), blur = useSharedValue(instant ? 0 : 1), scale = useSharedValue<number>(instant ? 1 : CEREMONY.revealScaleFrom);
  const sheen = useSharedValue(-1), march = useSharedValue(0);
  const inset = useSharedValue(showCaption ? strip : 8), paper = useSharedValue(empty ? 0 : 1), press = useSharedValue(1);
  const offsetX = useSharedValue(reframe?.x ?? 0), offsetY = useSharedValue(reframe?.y ?? 0);
  const originX = useSharedValue(0), originY = useSharedValue(0);
  const photoSettle = useSharedValue(0);
  useEffect(() => { offsetX.value = reframe?.x ?? 0; offsetY.value = reframe?.y ?? 0; }, [reframe?.x, reframe?.y]);

  useEffect(() => {
    startedUri.current = null; finishedUri.current = null;
    setLoadedUri(null); setFailedUri(null); setSettledUri(null);
    ink.value = instant ? 0 : 1; blur.value = instant ? 0 : 1; scale.value = instant ? 1 : CEREMONY.revealScaleFrom;
    photoSettle.value = 0;
  }, [uri, instant, retryToken]);
  const canReveal = Boolean(uri && prefetched && loadedUri === uri && revealed && active && !instant);
  useEffect(() => {
    if (!instant || !uri || loadedUri !== uri || !revealed || !active || finishedUri.current === uri) return;
    revealing.current?.(uri);
    photoSettle.value = withTiming(1, { duration: reduced ? 180 : 600 });
    const timer = setTimeout(() => { finishedUri.current = uri; setSettledUri(uri); completed.current?.(uri); }, reduced ? 180 : 600);
    return () => clearTimeout(timer);
  }, [instant, uri, loadedUri, revealed, active, reduced]);
  useEffect(() => {
    if (!canReveal || !uri || finishedUri.current === uri) return;
    const firstReveal = startedUri.current !== uri;
    startedUri.current = uri;
    if (firstReveal) {
      ink.value = .86;
      if (!silent) { playCreationSound('revealSettle'); void safeHaptics.impact(ImpactFeedbackStyle.Light); }
      revealing.current?.(uri);
    }
    ink.value = withTiming(0, { duration: ceremonyDuration(inkMs, reduced) });
    const config = { duration: ceremonyDuration(blurMs, reduced), easing: Easing.bezier(.4, .1, .2, 1) };
    blur.value = withTiming(0, config); scale.value = reduced ? 1 : withTiming(1, config);
    const timer = setTimeout(() => { finishedUri.current = uri; setSettledUri(uri); completed.current?.(uri); }, config.duration);
    return () => { clearTimeout(timer); cancelAnimation(ink); cancelAnimation(blur); cancelAnimation(scale); };
  }, [canReveal, uri, reduced]);
  useEffect(() => {
    paper.value = withTiming(empty ? 0 : 1, { duration: ceremonyDuration(CEREMONY.stageFadeMs, reduced) });
    inset.value = withTiming(showCaption ? strip : 8, { duration: ceremonyDuration(CEREMONY.printMoveMs, reduced) });
  }, [empty, showCaption, strip, reduced]);
  useEffect(() => {
    if (pressed) press.value = reduced ? 1 : withSequence(withTiming(.975, { duration: 150 }), withTiming(1, { duration: 350 }));
  }, [pressed, reduced]);
  useEffect(() => {
    if (reduced || !active) { cancelAnimation(sheen); cancelAnimation(march); return; }
    // One slow, soft pass every ~4.8s instead of a constant sweep (read as flicker on device).
    if (developing && !canReveal) sheen.value = withRepeat(withSequence(withTiming(-1, { duration: 0 }),
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), withDelay(3900, withTiming(1, { duration: 0 }))), -1, false);
    if (empty) march.value = withRepeat(withTiming(-180, { duration: CEREMONY.frameMarchMs, easing: Easing.linear }), -1, false);
    return () => { cancelAnimation(sheen); cancelAnimation(march); };
  }, [developing, canReveal, empty, active, reduced]);
  const paperStyle = useAnimatedStyle(() => ({ opacity: paper.value, transform: [
    { translateY: instant && !reduced ? 18 * (1 - photoSettle.value) : 0 },
    { scale: press.value * (instant && !reduced ? .96 + .04 * photoSettle.value : 1) },
  ] }));
  const frameStyle = useAnimatedStyle(() => ({ opacity: 1 - paper.value }));
  const dash = useAnimatedProps(() => ({ strokeDashoffset: march.value }));
  const windowStyle = useAnimatedStyle(() => ({ bottom: inset.value }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: (inset.value - 8) / Math.max(1, strip - 8) }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: ink.value }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));
  // DEFERRED: caption-beat overscan (1.16) returns with persisted reframe; the arrival flight measures the unzoomed window.
  const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }] }));
  const sheenStyle = useAnimatedStyle(() => ({ opacity: canReveal ? 0 : 1, transform: [{ translateX: sheen.value * 280 }] }));
  // DEFERRED: reframe returns when crop offset is persisted. `reframe`/`onReframe` stay in the props, inert.
  const pan = Gesture.Pan().enabled(false).onBegin(() => { originX.value = offsetX.value; originY.value = offsetY.value; })
    .onUpdate(event => { offsetX.value = Math.max(-22, Math.min(22, originX.value + event.translationX)); offsetY.value = Math.max(-28, Math.min(28, originY.value + event.translationY)); })
    .onEnd(() => { if (onReframe) runOnJS(onReframe)({ x: offsetX.value, y: offsetY.value }); });

  return <View testID={testID} style={styles.fill}>
    <Animated.View pointerEvents="none" style={[styles.fill, frameStyle]}>
      {opaque ? <View style={[styles.fill, styles.opaqueFill]} /> : null}
      <Svg width="100%" height="100%" viewBox="0 0 240 300" preserveAspectRatio="none">
        <AnimatedRect x="1" y="1" width="238" height="298" stroke="#F4EDE06B" strokeWidth="1" strokeDasharray="3 6" fill="none" animatedProps={dash} />
        <Path d="M0 20V0H20 M220 0H240V20 M240 280V300H220 M20 300H0V280" stroke="#F4EDE0" strokeWidth="1.4" fill="none" />
      </Svg>
      {/* DEFERRED: the empty frame's radial breath; the Ask suggestion text now fills the frame. */}
    </Animated.View>
    <Animated.View style={[styles.paper, paperStyle]}>
      {/* Deterministic fine paper flecks, no remote texture or placeholder photography. */}
      <View pointerEvents="none" style={styles.grain}>{Array.from({ length: 28 }, (_, i) => <View key={i} style={[styles.fleck, { left: `${(i * 37) % 100}%`, top: `${(i * 23) % 100}%` }]} />)}</View>
      <GestureDetector gesture={pan}><Animated.View ref={imageRef} collapsable={false} style={[styles.window, instant && { backgroundColor: '#F7F1E6' }, windowStyle]}>
        {uri ? <Animated.View style={[styles.fill, imageStyle]}>
          <Image key={`${uri}:${retryToken}`} testID={`${testID}-sharp`} source={imageSource!} resizeMode="cover" resizeMethod="resize" style={styles.photo} onLoad={() => setLoadedUri(uri)} onError={() => { setFailedUri(uri); if (uri) onImageError?.(uri); }} accessible={false} />
          {instant || settledUri === uri ? null : <Animated.View pointerEvents="none" style={[styles.fill, blurStyle]}><Image key={`blur:${uri}:${retryToken}`} source={imageSource!} blurRadius={24} resizeMode="cover" resizeMethod="resize" style={styles.photo} accessible={false} /></Animated.View>}
        </Animated.View> : null}
        {!instant ? <Animated.View pointerEvents="none" testID={`${testID}-ink`} style={[styles.fill, styles.ink, inkStyle]} /> : null}
        {developing ? <Animated.View pointerEvents="none" style={[styles.fill, sheenStyle]}><LinearGradient colors={['transparent', '#FFFFFF14', 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.fill} /></Animated.View> : null}
        {failedUri === uri && uri ? <Text style={styles.error}>{copy.unavailable}</Text> : null}
        {instant && uri && loadedUri !== uri && failedUri !== uri ? <View style={{ position: 'absolute', bottom: 4, alignSelf: 'center' }}><VisionHairline pending label="Reading your photo" /></View> : null}
      </Animated.View></GestureDetector>
      <Animated.View style={[styles.caption, { height: strip }, label ? styles.captionCompact : null, captionStyle]}>
        {label ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
        {onChangeCaption ? <TextInput testID={`${testID}-caption`} accessibilityLabel={copy.captionLabel} value={caption} maxLength={80} multiline={false}
          onChangeText={text => onChangeCaption(text.replace(/[\r\n]/g, ' ').slice(0, 80))} returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
          style={styles.captionText} /> : <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.captionText, label ? styles.captionTextCompact : null]}>{caption}</Text>}
        {onChangeCaption || captionHint ? <Text style={styles.captionHint}>{copy.hint}</Text> : null}
      </Animated.View>
      {pinned ? <View style={styles.pin} /> : null}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', zIndex: 30 }, fill: { ...StyleSheet.absoluteFillObject },
  // A bundled picture carries its own pixel size, which absoluteFill alone does not override: pin it to the window.
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  paper: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F7F1E6', borderRadius: 3, shadowColor: '#000', shadowOpacity: .5, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 8 },
  grain: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: .3 }, fleck: { position: 'absolute', width: 1, height: 1, backgroundColor: '#B5A98D' },
  window: { position: 'absolute', top: 8, left: 8, right: 8, overflow: 'hidden', backgroundColor: '#121427' }, ink: { backgroundColor: '#14162B' },
  caption: { position: 'absolute', left: 14, right: 14, bottom: 0, height: CEREMONY.captionStripPts, justifyContent: 'center' },
  captionText: { fontFamily: VISION_SERIF_ITALIC, fontSize: 21, color: '#14162B', textAlign: 'center', padding: 0 },
  captionHint: { fontFamily: 'Inter-Regular', fontSize: 9, color: '#726B60', textAlign: 'center', marginTop: 3 },
  captionCompact: { left: 10, right: 10, gap: 2 }, captionTextCompact: { fontSize: 15, lineHeight: 17 },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 8.5, letterSpacing: 2.2, textTransform: 'uppercase', color: '#8D8778', textAlign: 'center' },
  opaqueFill: { backgroundColor: '#1A1D36' },
  pin: { position: 'absolute', top: -8, alignSelf: 'center', width: 16, height: 16, borderRadius: 8, backgroundColor: '#B08A4A' },
  error: { margin: 12, color: '#F4EDE0', textAlign: 'center', fontSize: 12 },
});
