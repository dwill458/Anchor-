import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { AnalyticsService } from '@/services/AnalyticsService';
import { playCreationSound } from '@/services/CreationSounds';
import type { AnchorCategory } from '@/types';
import type { VisionAnchorArt } from '../VisionChrome';
import { VISION_GOLD, VISION_SERIF, VISION_SERIF_ITALIC } from '../VisionPaperChrome';
import { CEREMONY, ceremonyDuration } from './VisionDevelop';
import { VisionPrint, VisionPrintSlot, type PrintPlacement } from './VisionPrint';
import { visionCeremonyCopy as copy } from './visionCeremonyCopy';
import { VISION_ENTRANCE_EXAMPLES, type VisionEntranceExample } from './visionEntranceExamples';
import { VisionEntrancePolaroid } from './VisionEntrancePolaroid';

/**
 * Every duration of the open, in ms from mount, in one place. The three prints each take `spawnMs` to settle into the
 * fan, one `spawnStagger` after the last, and the Anchor's lift is what starts them.
 */
export const ENTRANCE = {
  anchorAt: 250, anchorMs: 1000, ringMs: 1100, liftAt: 1550, liftMs: 1000, ringFadeMs: 500,
  spawnMs: 420, spawnStagger: 110, printFadeMs: 260, tickAt: 1550,
  headAt: 1900, headMs: 700, headRise: 10, ctaAt: 2150, ctaMs: 700, ctaRise: 14, hintAt: 2450, hintMs: 600, driftAt: 3000,
  leaveMs: 300, handoffOverlapMs: 600,
  anchorBig: 176, ringGap: 14, spawnRise: 26, spawnScale: 0.94, footerGap: 34, footerHeight: 104,
  /** Height of a print as a multiple of its width: the polaroid material's 600 x 720 art. */
  printRatio: 1.2,
} as const;

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const TRANSFORM_ORIGIN = '50% 120%';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type FanPosition = 'left' | 'center' | 'right' | 'twoL' | 'twoR';
export type FanSlot = { tx: number; ty: number; rot: number; scale: number; z: number; dropRot: number; drift: { dx: number; dy: number; dr: number; ms: number } };

/** Where a print rests in the fan: the transform is applied about 50% / 120% of the print, like prints held in a hand. */
export function fanSlot(position: FanPosition, width: number): FanSlot {
  const side = (sign: -1 | 1, ms: number) => ({ dx: sign * 2, dy: -2, dr: -1, ms });
  switch (position) {
    case 'left': return { tx: -width * 0.53, ty: 24, rot: -9, scale: 0.86, z: 30, dropRot: -12, drift: side(-1, 7000) };
    case 'right': return { tx: width * 0.53, ty: 24, rot: 9, scale: 0.86, z: 31, dropRot: 12, drift: side(1, 8000) };
    case 'twoL': return { tx: -width * 0.3, ty: 8, rot: -6, scale: 0.94, z: 30, dropRot: -12, drift: side(-1, 7000) };
    case 'twoR': return { tx: width * 0.3, ty: 8, rot: 6, scale: 0.94, z: 31, dropRot: 12, drift: side(1, 8000) };
    default: return { tx: 0, ty: 0, rot: 0, scale: 1, z: 32, dropRot: 0, drift: { dx: 0, dy: -4, dr: 0.6, ms: 6000 } };
  }
}

/** The order the prints come out in: the centre print first, then the fan opens to either side behind it. */
export function emergeRank(position: FanPosition): number {
  switch (position) {
    case 'center': return 0;
    case 'left': case 'twoL': return 1;
    default: return 2;
  }
}

/** The lowest screen y a print reaches at rest, from the transform about its origin (drift margin included). */
function printBottom(W: number, H: number, top: number, slot: FanSlot): number {
  const ox = W / 2, oy = H * 1.2, rad = slot.rot * Math.PI / 180;
  let lowest = -Infinity;
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const x = (cx - ox) * slot.scale, y = (cy - oy) * slot.scale;
    lowest = Math.max(lowest, top + oy + slot.ty + x * Math.sin(rad) + y * Math.cos(rad));
  }
  return lowest + Math.abs(slot.drift.dy);
}

/**
 * The fan's geometry. The centre print sits 128pt under the anchor; on a short screen the prints shrink
 * until the hint under them clears the first button by 16pt. Prints never overlap the buttons.
 */
export function entranceLayout({ width, anchorBottom, footerTop, positions }: { width: number; anchorBottom: number; footerTop: number; positions: FanPosition[] }) {
  let top = anchorBottom + 128;
  const HINT_H = 16, GAP = 16;
  const widest = Math.min(width * 0.44, 170);
  let W = widest, H = W * ENTRANCE.printRatio, hintTop = 0;
  for (let w = Math.floor(widest); w >= 84; w -= 1) {
    W = w; H = W * ENTRANCE.printRatio;
    hintTop = Math.max(...positions.map(position => printBottom(W, H, top, fanSlot(position, W)))) + GAP;
    if (hintTop + HINT_H + GAP <= footerTop) break;
  }
  // On compact phones the added note row consumes vertical space. Keep the fan's
  // relative slot geometry and move the prints upward only after they reach the
  // smallest size, preserving a clear strip below the headline.
  if (hintTop + HINT_H + GAP > footerTop) {
    const overflow = hintTop + HINT_H + GAP - footerTop;
    top = Math.max(anchorBottom + 96, top - overflow);
    hintTop = Math.max(...positions.map(position => printBottom(W, H, top, fanSlot(position, W)))) + GAP;
  }
  return { W, H, left: (width - W) / 2, top, hintTop, headlineTop: anchorBottom + 20 };
}

type FanItem =
  | { kind: 'example'; position: FanPosition; example: VisionEntranceExample }
  | { kind: 'yours'; position: FanPosition; uri: string; caption: string }
  | { kind: 'empty'; position: FanPosition; text: string };

const EXAMPLE_POSITIONS: readonly FanPosition[] = ['left', 'center', 'right'];

/** Create: the three example prints. Add: the newest board print on the left, an empty frame, one example on the right. */
function fanItems(mode: 'create' | 'add', previewImageUrl: string | null | undefined, previewCaption: string): FanItem[] {
  if (mode === 'add' && previewImageUrl) {
    return [
      { kind: 'yours', position: 'left', uri: previewImageUrl, caption: previewCaption },
      { kind: 'empty', position: 'center', text: copy.whatElse },
      { kind: 'example', position: 'right', example: VISION_ENTRANCE_EXAMPLES[2] },
    ];
  }
  return VISION_ENTRANCE_EXAMPLES.map((example, index) => ({ kind: 'example', position: EXAMPLE_POSITIONS[index], example }));
}

export interface VisionEntranceProps {
  mode: 'create' | 'add';
  anchorId: string;
  category: AnchorCategory;
  anchorArt?: VisionAnchorArt | null;
  /** Add mode: the newest board print, shown developed on the left. */
  previewImageUrl?: string | null;
  previewCaption?: string | null;
  /** Play the open. The value at mount is the one that counts. */
  firstRun: boolean;
  /** The app is in the foreground. Drift and the open's sounds pause when it is not. */
  active?: boolean;
  /** Why a photo could not be picked; shown under the prints while it applies. */
  notice?: string | null;
  /** Opens the unified composer (photo, words or voice). */
  onWords: () => void;
  /** False at the existing per-Vision image limit. */
  canAddImage?: boolean;
  onBack: () => void;
  /** Where the ceremony's persistent top anchor rests, so the hand-off does not jump. */
  anchorTarget: PrintPlacement;
  /** The lift has landed: the persistent anchor takes over. */
  onAnchorHandoff?: () => void;
}

/** Fades a block in on its own schedule. */
function useReveal(open: boolean, delay: number, ms: number, rise: number, fadeMs: number) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(open ? delay : 0, withTiming(1, { duration: open ? ms : fadeMs, easing: EASE }));
  }, []);
  return useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * (open ? rise : 0) }] }));
}

function Pin() {
  return <View pointerEvents="none" testID="vision-entrance-pin" style={styles.pin}>
    <Svg width={16} height={16}><Defs><RadialGradient id="entrance-pin" cx="35%" cy="30%" rx="65%" ry="65%" fx="35%" fy="30%"><Stop offset="0" stopColor="#F3DCA0" /><Stop offset=".45" stopColor={VISION_GOLD} /><Stop offset="1" stopColor="#7d5d22" /></RadialGradient></Defs><Circle cx={8} cy={8} r={8} fill="url(#entrance-pin)" /></Svg>
  </View>;
}

interface FanPrintProps {
  item: FanItem; index: number; W: number; H: number; left: number; top: number;
  open: boolean; fadeMs: number; active: boolean; drifting: boolean;
}

/**
 * One print of the fan. It is decoration only: it has no press handler and is hidden from accessibility. A single
 * 0..1 progress drives it on the UI thread: it rises out from behind the centre print, opens to its tilt and fades in,
 * all with transform and opacity, so nothing re-lays out while it moves.
 */
function FanPrint({ item, index, W, H, left, top, open, fadeMs, active, drifting }: FanPrintProps) {
  const slot = fanSlot(item.position, W);
  const rank = emergeRank(item.position);
  const rest = useSharedValue<FanSlot>(slot);
  const spawn = useSharedValue(open ? 0 : 1), shown = useSharedValue(0), drift = useSharedValue(0);
  useEffect(() => { rest.value = slot; }, [slot.tx, slot.ty, slot.rot, slot.scale]);
  useEffect(() => {
    const delay = open ? ENTRANCE.liftAt + ENTRANCE.spawnStagger * rank : 0;
    if (open) spawn.value = withDelay(delay, withTiming(1, { duration: ENTRANCE.spawnMs, easing: EASE }));
    shown.value = withDelay(delay, withTiming(1, { duration: open ? ENTRANCE.printFadeMs : fadeMs, easing: Easing.out(Easing.quad) }));
  }, []);
  useEffect(() => {
    if (!drifting || !active) { cancelAnimation(drift); return; }
    drift.value = withRepeat(withTiming(1, { duration: slot.drift.ms / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(drift);
  }, [drifting, active]);
  const style = useAnimatedStyle(() => {
    const r = rest.value, k = spawn.value, d = drift.value;
    return { opacity: shown.value, transform: [
      { translateX: r.tx * k + r.drift.dx * d },
      { translateY: r.ty + ENTRANCE.spawnRise * (1 - k) + r.drift.dy * d },
      { rotate: `${r.rot * k + r.drift.dr * d}deg` },
      { scale: r.scale * (ENTRANCE.spawnScale + (1 - ENTRANCE.spawnScale) * k) },
    ] };
  });
  const caption = item.kind === 'example' ? item.example.caption : item.kind === 'yours' ? item.caption : '';
  return <VisionPrintSlot placement={{ x: left, y: top, width: W, height: H }} zIndex={slot.z} testID={`vision-entrance-slot-${index}`}>
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[styles.fill, { transformOrigin: TRANSFORM_ORIGIN }, style]}>
      {item.kind === 'empty'
        ? <>
          <VisionPrint testID={`vision-entrance-print-${index}`} developing={false} revealed active={active} pinned={false} silent empty opaque showCaption={false} caption="" instant />
          <View pointerEvents="none" style={styles.emptyCenter}><Text style={styles.emptyText}>{item.text}</Text></View>
        </>
        : <VisionEntrancePolaroid testID={`vision-entrance-print-${index}`} width={W} height={H} caption={caption}
          {...(item.kind === 'example'
            ? { source: item.example.image, sourceSize: item.example.size, frame: item.example.frame }
            : { source: { uri: item.uri }, sourceSize: { width: 4, height: 5 }, frame: 'classic' as const })} />}
      {item.kind === 'yours' ? <Pin /> : null}
    </Animated.View>
  </VisionPrintSlot>;
}

/** The anchor opens at the centre of the screen, draws its ring once, then lifts to where the ceremony's own anchor rests. */
function OpeningAnchor({ anchorArt, target, width, height }: { anchorArt?: VisionAnchorArt | null; target: PrintPlacement; width: number; height: number }) {
  const intro = useSharedValue(0), ring = useSharedValue(0), lift = useSharedValue(0), ringFade = useSharedValue(1);
  const big = ENTRANCE.anchorBig, k = target.width / big;
  const dy = target.y + target.height / 2 - height / 2, dx = target.x + target.width / 2 - width / 2;
  const radius = big / 2 + ENTRANCE.ringGap, circumference = 2 * Math.PI * radius, box = radius * 2 + 4;
  useEffect(() => {
    intro.value = withDelay(ENTRANCE.anchorAt, withTiming(1, { duration: ENTRANCE.anchorMs, easing: Easing.out(Easing.cubic) }));
    ring.value = withDelay(ENTRANCE.anchorAt, withTiming(1, { duration: ENTRANCE.ringMs, easing: Easing.inOut(Easing.ease) }));
    lift.value = withDelay(ENTRANCE.liftAt, withTiming(1, { duration: ENTRANCE.liftMs, easing: EASE }));
    ringFade.value = withDelay(ENTRANCE.liftAt, withTiming(0, { duration: ENTRANCE.ringFadeMs }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: intro.value, transform: [{ translateX: dx * lift.value }, { translateY: dy * lift.value },
    { scale: (0.92 + 0.08 * intro.value) * (1 + (k - 1) * lift.value) }] }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - ring.value) }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringFade.value }));
  return <Animated.View pointerEvents="none" testID="vision-entrance-anchor" style={[styles.openingAnchor, { left: width / 2 - big / 2, top: height / 2 - big / 2, width: big, height: big }, style]}>
    <Animated.View style={[styles.ring, { left: big / 2 - box / 2, top: big / 2 - box / 2, width: box, height: box }, ringStyle]}>
      <Svg width={box} height={box}><AnimatedCircle cx={box / 2} cy={box / 2} r={radius} rotation={-90} origin={`${box / 2}, ${box / 2}`} stroke="#F4EDE0" strokeWidth={0.8}
        strokeDasharray={circumference} fill="none" animatedProps={ringProps} /></Svg>
    </Animated.View>
    <View style={styles.openingMark}>
      {anchorArt ? <CircularAnchorRenderer {...anchorArt} size={big} appearance="bare" testID="vision-entrance-anchor-art" /> : null}
    </View>
  </Animated.View>;
}

/**
 * The Ask beat: pictures first. The person's anchor opens the screen and lifts, three example prints fan out
 * beneath it, and one call to action opens the composer, where a photo, words or voice start the Vision. The prints
 * only show what a finished Vision can hold: they cannot be tapped and start nothing.
 */
export function VisionEntrance({ mode, anchorId, category, anchorArt, previewImageUrl, previewCaption, firstRun, active = true, notice,
  onWords, canAddImage = true, onBack, anchorTarget, onAnchorHandoff }: VisionEntranceProps) {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const reduced = useV2ReduceMotion();
  const tier = useAppPerformanceTier();
  const [open] = useState(() => firstRun && !reduced), [first] = useState(firstRun);
  const fadeMs = ceremonyDuration(CEREMONY.stageFadeMs, reduced);
  const [interactive, setInteractive] = useState(!open), [drifting, setDrifting] = useState(false);
  const [anchorGone, setAnchorGone] = useState(!open);
  const items = useMemo(() => fanItems(mode, previewImageUrl, previewCaption?.trim() || ''), [mode, previewImageUrl, previewCaption]);
  const shown = items.filter(item => item.kind === 'example').length;
  const footerHeight = ENTRANCE.footerHeight;
  const footerTop = height - insets.bottom - ENTRANCE.footerGap - footerHeight;
  const layout = useMemo(() => entranceLayout({ width, anchorBottom: anchorTarget.y + anchorTarget.height, footerTop, positions: items.map(item => item.position) }),
    [width, anchorTarget.y, anchorTarget.height, footerTop, items]);
  const activeRef = useRef(active); activeRef.current = active;
  const stopped = useRef(false), timers = useRef(new Set<ReturnType<typeof setTimeout>>()), handoff = useRef(onAnchorHandoff); handoff.current = onAnchorHandoff;
  const later = (callback: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, ms);
    timers.current.add(timer);
  };
  // Drift is a slow idle sway: skipped for Reduce Motion (the open is skipped too) and on low-tier devices.
  const mayDrift = !reduced && tier !== 'low';
  const headStyle = useReveal(open, ENTRANCE.headAt, ENTRANCE.headMs, ENTRANCE.headRise, fadeMs);
  const hintStyle = useReveal(open, ENTRANCE.hintAt, ENTRANCE.hintMs, 0, fadeMs);
  const ctaStyle = useReveal(open, ENTRANCE.ctaAt, ENTRANCE.ctaMs, ENTRANCE.ctaRise, fadeMs);

  useEffect(() => {
    AnalyticsService.track('vision_entrance_viewed', { anchor_id: anchorId, mode, category, examples_shown: shown, first_run: first });
    if (!open) { later(() => { if (!stopped.current && mayDrift) setDrifting(true); }, fadeMs); return () => timers.current.forEach(clearTimeout); }
    const sound = (id: 'anchorPulse' | 'formTick', volume: number) => { if (!stopped.current && activeRef.current) playCreationSound(id, volume); };
    later(() => sound('anchorPulse', 0.35), ENTRANCE.anchorAt);
    items.forEach((item, i) => later(() => sound('formTick', 0.18), ENTRANCE.tickAt + ENTRANCE.spawnStagger * emergeRank(item.position)));
    later(() => setInteractive(true), ENTRANCE.ctaAt);
    later(() => { handoff.current?.(); later(() => setAnchorGone(true), ENTRANCE.handoffOverlapMs); }, ENTRANCE.liftAt + ENTRANCE.liftMs);
    later(() => { if (!stopped.current && mayDrift) setDrifting(true); }, ENTRANCE.driftAt);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const stop = () => { stopped.current = true; setDrifting(false); };
  const press = (action: () => void, requiresImage = false) => () => { if (!interactive || (requiresImage && !canAddImage)) return; stop(); playCreationSound('uiTap'); action(); };
  const hint = notice ?? (!canAddImage ? 'This Vision is full. Remove an image to add another.' : null);

  return <Animated.View testID="vision-entrance" pointerEvents="box-none" exiting={FadeOut.duration(fadeMs)} style={styles.fill}>
    <Svg pointerEvents="none" width={width} height={height} style={styles.fill}><Defs><RadialGradient id="entrance-vignette" cx="50%" cy="42%" rx="80%" ry="55%" fx="50%" fy="42%">
      <Stop offset="0" stopColor="#282C4C" stopOpacity={0.6} /><Stop offset="1" stopColor="#282C4C" stopOpacity={0} /></RadialGradient></Defs>
    <Rect x={0} y={0} width={width} height={height} fill="url(#entrance-vignette)" /></Svg>
    <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onBack} style={[styles.back, { top: insets.top + 10 }]}><ArrowLeft size={20} color="#F4EDE0" /></Pressable>
    {open && !anchorGone ? <OpeningAnchor anchorArt={anchorArt} target={anchorTarget} width={width} height={height} /> : null}
    <Animated.View pointerEvents="none" style={[styles.headline, { top: layout.headlineTop }, headStyle]}>
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{mode === 'create' ? copy.askCreate : copy.askAdd}</Text>
    </Animated.View>
    {items.map((item, index) => <FanPrint key={`${item.kind}-${index}`} item={item} index={index} W={layout.W} H={layout.H} left={layout.left} top={layout.top}
      open={open} fadeMs={fadeMs} active={active} drifting={drifting} />)}
    {hint ? <Animated.View pointerEvents="none" style={[styles.hintWrap, { top: layout.hintTop }, hintStyle]}>
      <Text accessibilityLiveRegion={notice ? 'polite' : undefined} style={[styles.hint, notice ? styles.notice : null]}>{hint}</Text></Animated.View> : null}
    <Animated.View pointerEvents={interactive ? 'box-none' : 'none'} style={[styles.footer, { bottom: insets.bottom + ENTRANCE.footerGap }, ctaStyle]}>
      <Pressable testID="vision-entrance-cta" accessibilityRole="button" accessibilityLabel={mode === 'create' ? copy.createVision : copy.addScene}
        accessibilityState={{ disabled: !canAddImage }} disabled={!canAddImage} onPress={press(onWords, true)} style={[styles.button, !canAddImage && styles.disabled]}>
        <Text style={styles.buttonText}>{mode === 'create' ? copy.createVision : copy.addScene}</Text>
      </Pressable>
      <Text style={styles.support}>{copy.startFrom}</Text>
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  back: { position: 'absolute', left: 18, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#F4EDE029' },
  headline: { position: 'absolute', left: 28, right: 28, alignItems: 'center' },
  title: { fontFamily: VISION_SERIF, fontSize: 34, lineHeight: 36, color: '#F4EDE0', textAlign: 'center' },
  hintWrap: { position: 'absolute', left: 24, right: 24, height: 16, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16, color: '#9A9AB2', textAlign: 'center' },
  notice: { color: '#F4EDE0' },
  footer: { position: 'absolute', left: 24, right: 24, gap: 10, alignItems: 'stretch' },
  button: { height: 52, borderRadius: 28, backgroundColor: '#F4EDE0', justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#14162B' },
  support: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: '#C4BDCF', textAlign: 'center' },
  disabled: { opacity: 0.48 },
  openingAnchor: { position: 'absolute' },
  openingMark: { flex: 1, borderRadius: 200 },
  ring: { position: 'absolute' },
  emptyCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 12 },
  emptyText: { fontFamily: VISION_SERIF_ITALIC, fontSize: 19, color: '#E9DFCC', textAlign: 'center' },
  pin: { position: 'absolute', top: -8, left: '50%', marginLeft: -8, width: 16, height: 16 },
});
