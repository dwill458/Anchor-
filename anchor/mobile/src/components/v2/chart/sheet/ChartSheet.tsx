import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ViewInstance } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_EASING } from '../chartMotion';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';

export type ChartSheetDetent = 'hidden' | 'peek' | 'half' | 'full';
/** A stable native frame that matches the clipped ScrollView viewport. */
export type ChartSheetViewport = ViewInstance;
export type ChartSheetHandle = { snapTo: (detent: ChartSheetDetent) => void; collapse: () => boolean };
export function chartSheetDetents(height: number, top: number, bottom: number) {
  return { hidden: height, peek: height - (162 + bottom), half: height - Math.round(.56 * height), full: Math.min(top + 45 + 128, height * .38) };
}
export function chartSheetSnap(y: number, velocity: number, positions: ReturnType<typeof chartSheetDetents>): Exclude<ChartSheetDetent, 'hidden'> {
  'worklet';
  const keys = ['full', 'half', 'peek'] as const;
  let nearest = 0;
  for (let i = 1; i < keys.length; i++) if (Math.abs(positions[keys[i]] - y) < Math.abs(positions[keys[nearest]] - y)) nearest = i;
  if (Math.abs(velocity) > 800) {
    if (velocity > 0) return keys.find(key => positions[key] > y + 1) ?? 'peek';
    for (let i = keys.length - 1; i >= 0; i--) if (positions[keys[i]] < y - 1) return keys[i];
    return 'full';
  }
  return keys[nearest];
}

const SheetContext = createContext<{
  fraction: SharedValue<number>; y: SharedValue<number>; scrollY: SharedValue<number>;
  positions: ReturnType<typeof chartSheetDetents>; detent: ChartSheetDetent;
  pan: ReturnType<typeof Gesture.Pan>; headerPan: ReturnType<typeof Gesture.Pan>; native: ReturnType<typeof Gesture.Native>;
} | null>(null);

export function ChartSheetTier({ children, tier }: { children: React.ReactNode; tier: 'half' | 'full' }) {
  const context = useContext(SheetContext);
  const style = useAnimatedStyle(() => ({ opacity: !context ? 1 : tier === 'half' ? context.fraction.value : Math.max(0, Math.min(1, (context.positions.half - context.y.value) / (context.positions.half - context.positions.full))) }));
  const hidden = context?.detent === 'peek' || context?.detent === 'hidden' || (tier === 'full' && context?.detent !== 'full');
  return <Animated.View testID={`chart-sheet-${tier}`} style={[styles.tier, style]} pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>{children}</Animated.View>;
}

export function ChartSheetScrollArea({ children, viewportRef, onLayout }: { children: React.ReactNode; viewportRef?: React.Ref<ChartSheetViewport>; onLayout?: () => void }) {
  const context = useContext(SheetContext);
  const scrollY = context?.scrollY;
  const scroll = useRef<React.ElementRef<typeof Animated.ScrollView>>(null);
  const setViewportRef = useCallback((node: ViewInstance | null) => {
    if (typeof viewportRef === 'function') viewportRef(node);
    else if (viewportRef) viewportRef.current = node;
  }, [viewportRef]);
  useEffect(() => {
    if (context?.detent !== 'full') {
      scroll.current?.scrollTo({ y: 0, animated: false });
      if (scrollY) scrollY.value = 0;
    }
  }, [context?.detent, scrollY]);
  const onScroll = useAnimatedScrollHandler({ onScroll: event => { if (scrollY) scrollY.value = event.contentOffset.y; } });
  if (!context) return <View ref={setViewportRef} onLayout={onLayout}>{children}</View>;
  return <View ref={setViewportRef} onLayout={onLayout} style={styles.scroll}>
    <GestureDetector gesture={Gesture.Simultaneous(context.pan, context.native)}>
      <Animated.ScrollView ref={scroll} style={styles.scroll} scrollEnabled={context.detent === 'full'} onScroll={onScroll} scrollEventThrottle={16} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} testID="chart-sheet-scroll">{children}</Animated.ScrollView>
    </GestureDetector>
  </View>;
}

export const ChartSheet = forwardRef<ChartSheetHandle, {
  children: React.ReactNode; reducedMotion: boolean; busy: SharedValue<boolean>;
  onDetentChange?: (detent: ChartSheetDetent) => void;
  overlay?: React.ReactNode;
}>(function ChartSheet({ children, reducedMotion, busy, onDetentChange, overlay }, ref) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const positions = useMemo(() => chartSheetDetents(height, insets.top, insets.bottom), [height, insets.top, insets.bottom]);
  const y = useSharedValue(positions.hidden);
  const opacity = useSharedValue(1);
  const start = useSharedValue(positions.hidden);
  const scrollY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const [detent, setDetent] = useState<ChartSheetDetent>('hidden');
  const detentRef = useRef(detent);
  const settle = useCallback((next: ChartSheetDetent) => {
    if (detentRef.current === next) return;
    detentRef.current = next;
    setDetent(next);
    onDetentChange?.(next);
  }, [onDetentChange]);
  const snapTo = useCallback((next: ChartSheetDetent) => {
    const entering = detentRef.current === 'hidden' && next === 'peek';
    if (entering && reducedMotion) {
      y.value = positions.peek;
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 180, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    } else {
      y.value = withTiming(positions[next], { duration: reducedMotion ? 180 : 360, easing: reducedMotion ? Easing.linear : CHART_EASING.settle, reduceMotion: ReduceMotion.Never }, finished => { if (finished) runOnJS(settle)(next); });
      return;
    }
    settle(next);
  }, [opacity, positions, reducedMotion, settle, y]);
  const collapse = useCallback(() => {
    if (detentRef.current === 'half' || detentRef.current === 'full' || y.value < positions.peek - 1) { snapTo('peek'); return true; }
    return false;
  }, [positions.peek, snapTo, y]);
  useImperativeHandle(ref, () => ({ snapTo, collapse }), [snapTo, collapse]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', collapse);
    return () => subscription.remove();
  }, [collapse]);
  useEffect(() => { y.value = positions[detentRef.current]; }, [positions, y]);
  const { native, pan, grab, headerPan } = useMemo(() => {
    const makePan = (grab: boolean) => Gesture.Pan().activeOffsetY([-6, 6])
      .onStart(() => { start.value = y.value; dragging.value = false; })
      .onUpdate(event => {
        if (busy.value) return;
        if (!grab && !dragging.value && start.value <= positions.full + 1 && (scrollY.value > 0 || event.translationY <= 0)) return;
        dragging.value = true;
        y.value = Math.max(positions.full, Math.min(positions.peek, start.value + event.translationY));
      })
      .onEnd(event => {
        if (busy.value || !dragging.value) return;
        const next = chartSheetSnap(y.value, event.velocityY, positions);
        y.value = withTiming(positions[next], { duration: reducedMotion ? 180 : 360, easing: reducedMotion ? Easing.linear : CHART_EASING.settle, reduceMotion: ReduceMotion.Never }, finished => { if (finished) runOnJS(settle)(next); });
      });
    const native = Gesture.Native();
    const pan = makePan(false).simultaneousWithExternalGesture(native);
    const grab = makePan(true).withTestId('chart-sheet-grab-pan');
    const headerPan = makePan(true);
    return { native, pan, grab, headerPan };
  }, [busy, dragging, positions, reducedMotion, scrollY, settle, start, y]);
  const fraction = useDerivedValue(() => Math.max(0, Math.min(1, (positions.peek - y.value) / (positions.peek - positions.half))));
  const context = useMemo(() => ({ fraction, y, scrollY, positions, detent, pan, headerPan, native }), [fraction, y, scrollY, positions, detent, pan, headerPan, native]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: opacity.value }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: .15 * fraction.value }));
  const label = detent === 'full' ? CHART_COPY.sheet.collapse : CHART_COPY.sheet.expand;
  const cycle = () => {
    if (busy.value) return;
    const next = detent === 'peek' ? 'half' : detent === 'half' ? 'full' : 'peek';
    snapTo(next);
    AccessibilityInfo.announceForAccessibility(`${next}, ${next === 'full' ? CHART_COPY.sheet.collapse : CHART_COPY.sheet.expand}`);
  };
  return <SheetContext.Provider value={context}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} testID="chart-sheet-dim" />
    <Animated.View style={[styles.sheet, { height: height - positions.full, paddingBottom: insets.bottom + 24 }, sheetStyle]} testID="chart-sheet">
      <GestureDetector gesture={grab}><View collapsable={false}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy.value }} onPress={cycle} style={styles.grabZone} testID="chart-sheet-grabber"><View style={styles.grabber} /></Pressable>
      </View></GestureDetector>
      {children}
    </Animated.View>
    {overlay}
  </SheetContext.Provider>;
});

/** Header and grabber both own an always-draggable gesture; child buttons still receive taps. */
export function ChartSheetGrabZone({ children }: { children: React.ReactNode }) {
  const context = useContext(SheetContext);
  if (!context) return <View>{children}</View>;
  return <GestureDetector gesture={context.headerPan}><View collapsable={false}>{children}</View></GestureDetector>;
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', zIndex: 4, left: 0, right: 0, top: 0, backgroundColor: T.ink, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 4, shadowColor: T.ink, shadowOffset: { width: 0, height: -10 }, shadowOpacity: .45, shadowRadius: 30, elevation: 16 },
  dim: { backgroundColor: T.ink }, grabZone: { height: 24, alignItems: 'center', justifyContent: 'center' }, grabber: { width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(239,234,223,.28)' },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 24 }, tier: { gap: 12, paddingTop: 12 },
});
