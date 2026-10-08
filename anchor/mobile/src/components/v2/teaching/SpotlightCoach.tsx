import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TEACHING_COPY, type BeatId } from '@/constants/v2/teachingCopy';
import { measureTeachingTarget, type TeachingRect } from './scrollToTarget';

export type TeachingStep = {
  id: BeatId;
  targetRef?: React.RefObject<View | null>;
  getRect?: () => TeachingRect | null | Promise<TeachingRect | null>;
  title: string;
  body: string;
  whisper?: boolean;
};
type Props = {
  visible: boolean; steps: TeachingStep[]; reducedMotion: boolean;
  onAdvance: (stepId: BeatId) => void;
  onDismiss: (reason: string) => void;
  onReady: (stepId: BeatId) => void;
};
const PAD = 8;
const MARGIN = 18;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** All coordinates enter in window space, then become local to this screen's overlay. */
export function SpotlightCoach(props: Props) {
  const { visible, steps, reducedMotion } = props;
  const latest = useRef(props);
  latest.current = props;
  const root = useRef<View>(null);
  const [index, setIndex] = useState(0);
  const [geometry, setGeometry] = useState<{ root: TeachingRect; target: TeachingRect } | null>(null);
  const [tipHeight, setTipHeight] = useState(180);
  const dimensions = useWindowDimensions();
  const spot = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const hasSpot = useRef(false);
  const current = steps[index];
  const stepKey = steps.map(step => step.id).join('|');
  useEffect(() => { setIndex(0); hasSpot.current = false; setGeometry(null); }, [visible, stepKey]);

  useEffect(() => {
    setGeometry(null);
    if (!visible || !current) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void (async () => {
        const target = await (current.getRect ? current.getRect() : measureTeachingTarget(current.targetRef?.current ?? null));
        const bounds = await measureTeachingTarget(root.current);
        if (cancelled) return;
        if (!bounds || !target || target.width <= 0 || target.height <= 0 || target.y + target.height <= bounds.y || target.y >= bounds.y + bounds.height) {
          if (index < latest.current.steps.length - 1) setIndex(value => value + 1);
          else latest.current.onDismiss('unmeasurable');
          return;
        }
        const left = Math.max(0, target.x - bounds.x - PAD);
        const top = Math.max(0, target.y - bounds.y - PAD);
        const next = { x: left, y: top, width: Math.min(bounds.width, target.x - bounds.x + target.width + PAD) - left, height: Math.min(bounds.height, target.y - bounds.y + target.height + PAD) - top };
        spot.value = reducedMotion || !hasSpot.current ? next : withTiming(next, { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
        hasSpot.current = true;
        setGeometry({ root: bounds, target: next });
        AccessibilityInfo.announceForAccessibility(`${current.title} ${current.body}`);
        latest.current.onReady(current.id);
      })().catch(() => {
        if (cancelled) return;
        if (index < latest.current.steps.length - 1) setIndex(value => value + 1);
        else latest.current.onDismiss('unmeasurable');
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [visible, current?.id, index, stepKey, reducedMotion, dimensions.width, dimensions.height, spot]);

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
  const tipWidth = Math.min(bounds.width - MARGIN * 2, 360);
  const below = target.y + target.height + 18;
  const placeBelow = below + tipHeight + MARGIN <= bounds.height;
  const tipTop = placeBelow ? below : Math.max(MARGIN, target.y - tipHeight - 18);
  const arrowX = Math.max(MARGIN + 12, Math.min(bounds.width - MARGIN - 30, target.x + target.width / 2 - 9));
  const advance = () => {
    latest.current.onAdvance(current.id);
    if (index === steps.length - 1) latest.current.onDismiss('complete');
    else { setGeometry(null); setIndex(value => value + 1); }
  };
  return <View accessibilityViewIsModal ref={root} collapsable={false} pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.root]} testID="spotlight-coach">
    {[topStyle, bottomStyle, leftStyle, rightStyle].map((style, i) => <AnimatedPressable key={i} accessibilityRole="button" accessibilityLabel={TEACHING_COPY.common.dismiss} onPress={() => latest.current.onDismiss('scrim')} style={[styles.scrim, style]} />)}
    {/* The hole stays visually clear, but taps there dismiss rather than launch a practice beneath a tip. */}
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={TEACHING_COPY.common.dismiss} onPress={() => latest.current.onDismiss('scrim')} style={[styles.spot, spotStyle]} />
    <View pointerEvents="none" style={[styles.arrow, placeBelow ? styles.arrowUp : styles.arrowDown, { left: arrowX, top: placeBelow ? tipTop - 10 : tipTop + tipHeight }]} />
    <View onLayout={event => setTipHeight(event.nativeEvent.layout.height)} style={[styles.tip, { left: (bounds.width - tipWidth) / 2, top: tipTop, width: tipWidth, maxHeight: bounds.height - tipTop - MARGIN }]}>
      <ScrollView bounces={false} contentContainerStyle={styles.tipContent}>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
        <View style={styles.footer}>
          {steps.length > 1 ? <Text style={styles.count}>{TEACHING_COPY.common.step.replace('{n}', String(index + 1)).replace('{total}', String(steps.length))}</Text> : <View />}
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
