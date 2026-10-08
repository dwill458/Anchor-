import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import type { ChartSheetDetent, ChartSheetViewport } from './ChartSheet';
import type { ChartOneMoveTargetRefs } from './chartOneMoveTypes';

type Props = {
  visible: boolean;
  replayVersion: number;
  reducedMotion: boolean;
  detent: ChartSheetDetent;
  targets: ChartOneMoveTargetRefs;
  viewportRef: React.RefObject<ChartSheetViewport | null>;
  viewportLayoutRevision?: number;
  /** Injectable bridge used by native-measurement tests; production uses measureInWindow directly. */
  measureInWindow?: (node: MeasurableNode, callback: (x: number, y: number, width: number, height: number) => void) => void;
  onRequestVisible: () => void;
  onReady: () => void;
  onDismiss: () => void;
};

type Rect = { x: number; y: number; width: number; height: number };
type MeasurableNode = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };
const PAD = 8;
const MARGIN = 18;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A screen-level coach mark. Its root and the sheet targets are measured in window coordinates. */
export function ChartOneMoveTeaching({ visible, replayVersion, reducedMotion, detent, targets, viewportRef, viewportLayoutRevision, measureInWindow, onRequestVisible, onReady, onDismiss }: Props) {
  const { width, height } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [rootRect, setRootRect] = useState<Rect | null>(null);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tipHeight, setTipHeight] = useState(160);
  const [beat, setBeat] = useState(0);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const spotlightValue = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const hasMeasuredSpot = useRef(false);
  const visibilityRequested = useRef(false);
  const visibilityAttempts = useRef(0);
  const spotlightStyle = useAnimatedStyle(() => ({ left: spotlightValue.value.x, top: spotlightValue.value.y, width: spotlightValue.value.width, height: spotlightValue.value.height }));
  const topScrimStyle = useAnimatedStyle(() => ({ left: 0, top: 0, width, height: spotlightValue.value.y }));
  const bottomScrimStyle = useAnimatedStyle(() => ({ left: 0, top: spotlightValue.value.y + spotlightValue.value.height, width, height: Math.max(0, height - spotlightValue.value.y - spotlightValue.value.height) }));
  const leftScrimStyle = useAnimatedStyle(() => ({ left: 0, top: spotlightValue.value.y, width: spotlightValue.value.x, height: spotlightValue.value.height }));
  const rightScrimStyle = useAnimatedStyle(() => ({ left: spotlightValue.value.x + spotlightValue.value.width, top: spotlightValue.value.y, width: Math.max(0, width - spotlightValue.value.x - spotlightValue.value.width), height: spotlightValue.value.height }));
  const beats = CHART_COPY.teaching.oneMove.beats;
  const current = beats[beat];

  const measure = useCallback(() => {
    if (!visible || readyRef.current || visibilityRequested.current) return;
    const root = rootRef.current;
    const target = [targets.rowRef.current, targets.circleRef.current, targets.bodyRef.current][beat];
    if (!root || !target) return;
    const measureNode = measureInWindow ?? ((node: MeasurableNode, callback: (x: number, y: number, width: number, height: number) => void) => node.measureInWindow(callback));
    measureNode(root, (rootX, rootY, rootWidth, rootHeight) => {
      const nextRoot = { x: rootX, y: rootY, width: rootWidth, height: rootHeight };
      setRootRect(previous => previous?.x === rootX && previous.y === rootY && previous.width === rootWidth && previous.height === rootHeight ? previous : nextRoot);
      const updateTarget = (x: number, y: number, targetWidth: number, targetHeight: number, viewport?: Rect) => {
        const nextTarget = { x: x - rootX, y: y - rootY, width: targetWidth, height: targetHeight };
        const clippedByViewport = Boolean(viewport) && (y < viewport!.y || y + targetHeight > viewport!.y + viewport!.height || x < viewport!.x || x + targetWidth > viewport!.x + viewport!.width);
        const partiallyOffscreen = y < rootY || y + targetHeight > rootY + rootHeight || clippedByViewport;
        if (detent !== 'hidden' && partiallyOffscreen && visibilityAttempts.current < 2) {
          readyRef.current = false;
          setReady(false);
          if (!visibilityRequested.current) {
            visibilityRequested.current = true;
            visibilityAttempts.current += 1;
            onRequestVisible();
          }
          return;
        }
        visibilityRequested.current = false;
        readyRef.current = true;
        if (partiallyOffscreen && viewport) {
          const left = Math.max(rootX, viewport.x, x);
          const top = Math.max(rootY, viewport.y, y);
          const right = Math.min(rootX + rootWidth, viewport.x + viewport.width, x + targetWidth);
          const bottom = Math.min(rootY + rootHeight, viewport.y + viewport.height, y + targetHeight);
          if (right <= left || bottom <= top) {
            readyRef.current = false;
            setReady(false);
            return;
          }
          setTargetRect({ x: left - rootX, y: top - rootY, width: right - left, height: bottom - top });
        } else setTargetRect(nextTarget);
        setReady(true);
        onReady();
      };
      if (viewportRef.current) {
        measureNode(viewportRef.current, (viewportX, viewportY, viewportWidth, viewportHeight) => {
          measureNode(target, (x, y, targetWidth, targetHeight) => updateTarget(x, y, targetWidth, targetHeight, { x: viewportX, y: viewportY, width: viewportWidth, height: viewportHeight }));
        });
      } else measureNode(target, (x, y, targetWidth, targetHeight) => updateTarget(x, y, targetWidth, targetHeight));
    });
  }, [beat, detent, measureInWindow, onReady, onRequestVisible, targets.bodyRef, targets.circleRef, targets.rowRef, viewportLayoutRevision, viewportRef, visible]);

  useEffect(() => {
    if (!visible) {
      readyRef.current = false;
      visibilityAttempts.current = 0;
      setReady(false);
      hasMeasuredSpot.current = false;
      return;
    }
    readyRef.current = false;
    visibilityRequested.current = false;
    setReady(false);
    const frame = requestAnimationFrame(measure);
    const retry = setInterval(measure, 180);
    return () => { cancelAnimationFrame(frame); clearInterval(retry); };
  }, [height, measure, replayVersion, visible, width]);

  useEffect(() => {
    if (!rootRect || !targetRect) return;
    const next = {
      x: Math.max(0, targetRect.x - PAD),
      y: Math.max(0, targetRect.y - PAD),
      width: Math.min(rootRect.width, targetRect.x + targetRect.width + PAD) - Math.max(0, targetRect.x - PAD),
      height: Math.min(rootRect.height, targetRect.y + targetRect.height + PAD) - Math.max(0, targetRect.y - PAD),
    };
    if (reducedMotion || !hasMeasuredSpot.current) spotlightValue.value = next;
    else spotlightValue.value = withTiming(next, { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
    hasMeasuredSpot.current = true;
  }, [reducedMotion, rootRect, spotlightValue, targetRect]);

  useEffect(() => {
    if (!visible) return;
    readyRef.current = false;
    visibilityRequested.current = false;
    visibilityAttempts.current = 0;
    setBeat(0);
  }, [replayVersion, visible]);

  useEffect(() => { visibilityAttempts.current = 0; }, [beat]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [onDismiss, visible]);

  useEffect(() => {
    if (!visible || !current) return;
    AccessibilityInfo.announceForAccessibility(`${current.title} ${current.body} ${CHART_COPY.teaching.oneMove.steps.replace('{n}', String(beat + 1))}`);
  }, [beat, current, visible]);

  const advance = () => {
    if (beat === beats.length - 1) onDismiss();
    else setBeat(value => value + 1);
  };
  const onRootLayout = () => measure();
  if (!visible || !current) return null;

  const spotlight = rootRect && targetRect ? {
    left: Math.max(0, targetRect.x - PAD),
    top: Math.max(0, targetRect.y - PAD),
    width: Math.min(rootRect.width, targetRect.x + targetRect.width + PAD) - Math.max(0, targetRect.x - PAD),
    height: Math.min(rootRect.height, targetRect.y + targetRect.height + PAD) - Math.max(0, targetRect.y - PAD),
  } : null;
  if (!rootRect || !spotlight || !targetRect || !ready) return <View ref={rootRef} collapsable={false} onLayout={onRootLayout} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlayRoot]} testID="chart-one-move-teaching-measure" />;
  const tipWidth = Math.min(rootRect.width - MARGIN * 2, 360);
  const below = spotlight.top + spotlight.height + 18;
  const placeBelow = below + tipHeight + MARGIN <= rootRect.height;
  const tipTop = placeBelow ? below : Math.max(MARGIN, spotlight.top - tipHeight - 18);
  const arrowX = Math.max(MARGIN + 12, Math.min(rootRect.width - MARGIN - 30, targetRect.x + targetRect.width / 2 - 9));
  const tipX = Math.max(MARGIN, Math.min(rootRect.width - tipWidth - MARGIN, rootRect.width / 2 - tipWidth / 2));
  const scrim = 'rgba(14,14,12,0.64)';

  return <View ref={rootRef} collapsable={false} onLayout={onRootLayout} pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlayRoot]} testID="chart-one-move-teaching">
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={CHART_COPY.teaching.oneMove.dismiss} onPress={onDismiss} style={[styles.scrim, { backgroundColor: scrim }, topScrimStyle]} />
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={CHART_COPY.teaching.oneMove.dismiss} onPress={onDismiss} style={[styles.scrim, { backgroundColor: scrim }, bottomScrimStyle]} />
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={CHART_COPY.teaching.oneMove.dismiss} onPress={onDismiss} style={[styles.scrim, { backgroundColor: scrim }, leftScrimStyle]} />
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={CHART_COPY.teaching.oneMove.dismiss} onPress={onDismiss} style={[styles.scrim, { backgroundColor: scrim }, rightScrimStyle]} />
    <Animated.View pointerEvents="none" style={[styles.spotlight, spotlight, spotlightStyle]} />
    <View pointerEvents="none" style={[styles.arrow, placeBelow ? styles.arrowUp : styles.arrowDown, { left: arrowX, top: placeBelow ? tipTop - 10 : spotlight.top - 10 }]} />
    <View onLayout={event => setTipHeight(event.nativeEvent.layout.height)} accessibilityRole="summary" accessibilityLiveRegion="polite" accessible={false} style={[styles.tip, { left: tipX, top: tipTop, width: tipWidth }]}>
      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.body}>{current.body}</Text>
      <View style={styles.footer}>
        <Text style={styles.steps}>{CHART_COPY.teaching.oneMove.steps.replace('{n}', String(beat + 1))}</Text>
        <Pressable accessibilityRole="button" onPress={advance} style={styles.button}>
          <Text style={styles.buttonText}>{beat === beats.length - 1 ? CHART_COPY.teaching.oneMove.gotIt : CHART_COPY.teaching.oneMove.next}</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlayRoot: { zIndex: 30, elevation: 30 },
  scrim: { position: 'absolute' },
  spotlight: { position: 'absolute', borderRadius: 18, borderWidth: 2, borderColor: '#F4EFE6' },
  tip: { position: 'absolute', backgroundColor: '#F4EFE6', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  title: { color: '#1D1B18', fontFamily: T.serif, fontSize: 19, lineHeight: 24, marginBottom: 6 },
  body: { color: '#4A463F', fontFamily: T.sans, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  steps: { color: '#8A8478', fontFamily: T.sans, fontSize: 12 },
  button: { minHeight: 40, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: '#1D1B18' },
  buttonText: { color: '#F4EFE6', fontFamily: T.sansStrong, fontSize: 14, fontWeight: '600' },
  arrow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowUp: { borderBottomWidth: 10, borderBottomColor: '#F4EFE6' },
  arrowDown: { borderTopWidth: 10, borderTopColor: '#F4EFE6' },
});
