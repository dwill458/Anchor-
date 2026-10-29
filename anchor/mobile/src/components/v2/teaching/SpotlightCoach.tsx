import type { ViewInstance } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEACHING_COPY, type BeatId } from '@/constants/v2/teachingCopy';
import { measureTeachingTarget, type TeachingRect } from './scrollToTarget';

export type TeachingStep = {
  id: BeatId;
  targetRef?: React.RefObject<ViewInstance | null>;
  getRect?: () => TeachingRect | null | Promise<TeachingRect | null>;
  title: string;
  body: string;
  accessibilityLabel?: string;
  whisper?: boolean;
};
type Props = {
  visible: boolean; steps: TeachingStep[]; reducedMotion: boolean;
  onAdvance: (stepId: BeatId) => void;
  onDismiss: (reason: string) => void;
  onReady: (stepId: BeatId) => void;
  onHidden?: () => void;
  onSkip?: (stepId: BeatId) => void;
};
const PAD = 8;
const MARGIN = 18;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** All coordinates enter in window space, then become local to this screen's overlay. */
export function SpotlightCoach(props: Props) {
  const { visible, steps, reducedMotion } = props;
  const latest = useRef(props);
  latest.current = props;
  const insets = useSafeAreaInsets();
  const root = useRef<ViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [skippedIds, setSkippedIds] = useState<BeatId[]>([]);
  const [geometry, setGeometry] = useState<{ root: TeachingRect; target: TeachingRect } | null>(null);
  const [tipHeight, setTipHeight] = useState(180);
  const dimensions = useWindowDimensions();
  const spot = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const hasSpot = useRef(false);
  const current = steps[index];
  const stepKey = steps.map(step => step.id).join('|');
  useEffect(() => { setIndex(0); setSkippedIds([]); hasSpot.current = false; setGeometry(null); }, [visible, stepKey]);

  useEffect(() => {
    setGeometry(null);
    latest.current.onHidden?.();
    if (!visible || !current) return;
    let cancelled = false;
    const skipCurrent = () => {
      latest.current.onSkip?.(current.id);
      setSkippedIds(prev => (prev.includes(current.id) ? prev : [...prev, current.id]));
      if (index < latest.current.steps.length - 1) setIndex(value => value + 1);
      else latest.current.onDismiss('unmeasurable');
    };
    let ran = false;
    const run = () => {
      if (ran || cancelled) return;
      ran = true;
      void (async () => {
        const target = await (current.getRect ? current.getRect() : measureTeachingTarget(current.targetRef?.current ?? null));
        const bounds = await measureTeachingTarget(root.current);
        if (cancelled) return;
        if (!bounds || !target || target.width <= 0 || target.height <= 0 || target.y + target.height <= bounds.y || target.y >= bounds.y + bounds.height) {
          skipCurrent();
          return;
        }
        const left = Math.max(0, target.x - bounds.x - PAD);
        const top = Math.max(0, target.y - bounds.y - PAD);
        const next = { x: left, y: top, width: Math.min(bounds.width, target.x - bounds.x + target.width + PAD) - left, height: Math.min(bounds.height, target.y - bounds.y + target.height + PAD) - top };
        spot.value = reducedMotion || !hasSpot.current ? next : withTiming(next, { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
        hasSpot.current = true;
        setGeometry({ root: bounds, target: next });
        AccessibilityInfo.announceForAccessibility(current.accessibilityLabel ?? `${current.title} ${current.body}`);
        latest.current.onReady(current.id);
      })().catch(() => {
        if (cancelled) return;
        skipCurrent();
      });
    };
    const frame = requestAnimationFrame(run);
    const timer = setTimeout(run, 16);
    return () => { cancelled = true; cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [visible, current?.id, index, stepKey, reducedMotion, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { latest.current.onDismiss('back'); return true; });
    return () => sub.remove();
  }, [visible]);
  const spotStyle = useAnimatedStyle(() => ({ left: spot.value.x, top: spot.value.y, width: spot.value.width, height: spot.value.height }));
  const topStyle = useAnimatedStyle(() => ({ left: 0, top: 0, width: dimensions.width, height: spot.value.y }));
  const bottomStyle = useAnimatedStyle(() => ({ left: 0, top: spot.value.y + spot.value.height, width: dimensions.width, height: Math.max(0, dimensions.height - spot.value.y - spot.value.height) }));
  const leftStyle = useAnimatedStyle(() => ({ left: 0, top: spot.value.y, width: spot.value.x, height: spot.value.height }));
  const rightStyle = useAnimatedStyle(() => ({ left: spot.value.x + spot.value.width, top: spot.value.y, width: Math.max(0, dimensions.width - spot.value.x - spot.value.width), height: spot.value.height }));
  if (!visible || !current) return null;
  if (!geometry) return <View ref={root} collapsable={false} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]} testID="spotlight-coach-measure" />;
  const { root: bounds, target } = geometry;
  const topMargin = Math.max(MARGIN, (insets?.top ?? 0) + 8);
  const bottomMargin = Math.max(MARGIN, (insets?.bottom ?? 0) + 8);
  const availableWidth = Math.min(bounds.width, dimensions.width > 0 ? dimensions.width : bounds.width);
  const tipWidth = Math.max(0, Math.min(availableWidth - MARGIN * 2, 360));
  const tipLeft = Math.max(MARGIN, Math.min(availableWidth - tipWidth - MARGIN, (availableWidth - tipWidth) / 2));
  const below = target.y + target.height + 18;
  const placeBelow = below + tipHeight + bottomMargin <= bounds.height;
  const tipTop = placeBelow ? below : Math.max(topMargin, target.y - tipHeight - 18);
  const tipMaxHeight = placeBelow
    ? Math.max(0, bounds.height - tipTop - bottomMargin)
    : Math.max(0, target.y - tipTop - 18);
  const arrowX = Math.max(tipLeft + 12, Math.min(tipLeft + tipWidth - 30, target.x + target.width / 2 - 9));
  const visibleSteps = steps.filter(step => !skippedIds.includes(step.id));
  const visibleIndex = Math.max(0, visibleSteps.findIndex(step => step.id === current.id));
  const advance = () => {
    latest.current.onAdvance(current.id);
    if (index === steps.length - 1) latest.current.onDismiss('complete');
    else { setGeometry(null); setIndex(value => value + 1); }
  };
  return <View accessibilityViewIsModal ref={root} collapsable={false} pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.root]} testID="spotlight-coach">
    {[topStyle, bottomStyle, leftStyle, rightStyle].map((style, i) => <AnimatedPressable key={i} accessibilityRole="button" accessibilityLabel={TEACHING_COPY.common.dismiss} onPress={() => latest.current.onDismiss('scrim')} style={[styles.scrim, style]} />)}
    <Animated.View testID="spotlight-target-hole" pointerEvents="none" style={[styles.spot, spotStyle]} />
    <View pointerEvents="none" style={[styles.arrow, placeBelow ? styles.arrowUp : styles.arrowDown, { left: arrowX, top: placeBelow ? tipTop - 10 : tipTop + tipHeight }]} />
    <View onLayout={event => setTipHeight(event.nativeEvent.layout.height)} style={[styles.tip, { left: tipLeft, top: tipTop, width: tipWidth, maxHeight: tipMaxHeight }]}>
      <ScrollView bounces={false} contentContainerStyle={styles.tipContent}>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
        <View style={styles.footer}>
          {visibleSteps.length > 1 ? <Text style={styles.count}>{TEACHING_COPY.common.step.replace('{n}', String(visibleIndex + 1)).replace('{total}', String(visibleSteps.length))}</Text> : <View />}
          <Pressable accessibilityRole="button" onPress={advance} style={styles.button}><Text style={styles.buttonText}>{index === steps.length - 1 ? TEACHING_COPY.common.gotIt : TEACHING_COPY.common.next}</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { zIndex: 30, elevation: 30 },
  scrim: { position: 'absolute', backgroundColor: 'rgba(14,14,12,0.64)' },
  spot: { position: 'absolute', borderRadius: 18, borderWidth: 2, borderColor: '#F4EFE6' },
  tip: { position: 'absolute', backgroundColor: '#F4EFE6', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  tipContent: { padding: 16 },
  title: { color: '#1D1B18', fontFamily: 'EBGaramond-Medium', fontSize: 19, lineHeight: 24, marginBottom: 6 },
  body: { color: '#4A463F', fontFamily: 'Figtree-Regular', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: '#8A8478', fontFamily: 'Figtree-Regular', fontSize: 12 },
  button: { minHeight: 40, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: '#1D1B18' },
  buttonText: { color: '#F4EFE6', fontFamily: 'Figtree-SemiBold', fontSize: 14 },
  arrow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowUp: { borderBottomWidth: 10, borderBottomColor: '#F4EFE6' },
  arrowDown: { borderTopWidth: 10, borderTopColor: '#F4EFE6' },
});
