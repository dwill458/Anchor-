import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Canvas, Circle, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAudio, type ManagedAudioPlayer } from '@/hooks/useAudio';
import { AnalyticsService } from '@/services/AnalyticsService';
import { colors, typography } from '@/theme/v2';
import { colors as appColors } from '@/theme';
import { useAnchorStore } from '@/stores/anchorStore';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
import { PAPER_ART_SHARE, creationSequence, creationTiming } from './creationMotion';
import { SurfaceSweep } from './SurfaceSweep';
import { advanceSeal, nearSealStart, sealPath } from './sealGeometry';

const track = (event: string) => { try { AnalyticsService.track(event); } catch { /* non-critical */ } };
const impact = (style: Haptics.ImpactFeedbackStyle) => { void Haptics.impactAsync(style).catch(() => {}); };

export function SealMedallion({ children, points, size, active, disabled, reduceMotion, onKeep, onInteraction, onCommitted, onMeasure }: {
  children: React.ReactNode; points: AnchorPoint[]; size: number; active: boolean; disabled: boolean; reduceMotion: boolean;
  onKeep: () => void; onInteraction: (locked: boolean) => void; onCommitted: () => void;
  onMeasure: (rect: { x: number; y: number; width: number; height: number }) => void;
}) {
  const { createManagedPlayer, playSound } = useAudio();
  const count = useAnchorStore((state) => state.anchors.length);
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (alive) setScreenReader(enabled); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { alive = false; subscription.remove(); };
  }, []);
  const geometry = useMemo(() => sealPath(points, size, PAPER_ART_SHARE), [points, size]);
  const fallback = reduceMotion || screenReader || geometry.total <= 0;
  const drawnPath = useMemo(() => {
    const path = Skia.Path.Make();
    geometry.points.forEach((p, i) => { if (i === 0) path.moveTo(p.x, p.y); else path.lineTo(p.x, p.y); });
    return path;
  }, [geometry]);
  const progress = useSharedValue(0);
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const distance = useRef(0);
  const complete = useRef(false);
  const started = useRef(false);
  const touching = useRef(false);
  const thresholds = useRef(0);
  const tone = useRef<ManagedAudioPlayer | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);
  const decay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const medallion = useRef<View>(null);
  const [flash, setFlash] = useState(false);
  const [provenance, setProvenance] = useState<string | null>(null);
  const keepRef = useRef(onKeep); keepRef.current = onKeep;
  const callbacks = useRef({ onInteraction, onCommitted, onMeasure }); callbacks.current = { onInteraction, onCommitted, onMeasure };
  const later = useCallback((callback: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, ms);
    timers.current.add(timer);
  }, []);
  const stopTone = useCallback(() => { tone.current?.stop(); tone.current = null; }, []);
  const stopHold = useCallback(() => { if (hold.current) clearInterval(hold.current); hold.current = null; }, []);
  const finish = useCallback(() => {
    if (complete.current) return;
    complete.current = true;
    stopHold(); stopTone();
    callbacks.current.onCommitted();
    track('anchor_seal_completed');
    const number = count + 1;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    later(() => {
      playSound('forge-seal'); impact(Haptics.ImpactFeedbackStyle.Heavy);
      setFlash(true);
      if (!reduceMotion) press.value = creationSequence(creationTiming(0.97, { duration: 100 }), creationTiming(1, { duration: 220 }));
      later(() => {
        setProvenance(`Anchor No. ${number} · Forged ${date}`);
        // Preserve the source square for the existing measured Home carousel arrival.
        medallion.current?.measureInWindow((x, y, width, height) => {
          const art = Math.min(width, height) * PAPER_ART_SHARE;
          callbacks.current.onMeasure({ x: x + (width - art) / 2, y: y + (height - art) / 2, width: art, height: art });
        });
        later(() => { setProvenance(null); keepRef.current(); }, 2000);
      }, reduceMotion ? 80 : 320);
    }, 150);
  }, [count, later, playSound, press, reduceMotion, stopHold, stopTone]);
  const update = useCallback((fraction: number) => {
    progress.value = fraction;
    tone.current?.setRate(0.65 + fraction * 0.95);
    tone.current?.setVolume(0.08 + fraction * 0.12);
    const threshold = fraction >= 0.75 ? 2 : fraction >= 0.25 ? 1 : 0;
    if (threshold > thresholds.current) { thresholds.current = threshold; impact(threshold === 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); }
    if (fraction >= 1) finish();
  }, [finish, progress]);
  const begin = useCallback(() => {
    if (!active || disabled || complete.current || touching.current) return;
    if (decay.current) { clearTimeout(decay.current); decay.current = null; }
    cancelAnimation(progress);
    distance.current = 0; progress.value = 0; thresholds.current = 0;
    touching.current = true;
    callbacks.current.onInteraction(true);
    if (!started.current) { started.current = true; track('anchor_seal_started'); }
    tone.current = createManagedPlayer('haptic-tone', { loop: true, volume: 0.08 });
    tone.current?.setRate(0.65); tone.current?.play();
    impact(Haptics.ImpactFeedbackStyle.Light);
    if (fallback) {
      const start = Date.now();
      hold.current = setInterval(() => { const fraction = Math.min(1, (Date.now() - start) / 1200); distance.current = fraction; update(fraction); }, 16);
    }
  }, [active, createManagedPlayer, disabled, fallback, progress, update]);
  const release = useCallback(() => {
    touching.current = false;
    if (complete.current) return;
    stopHold(); stopTone();
    progress.value = creationTiming(0, { duration: reduceMotion ? 80 : 400 });
    if (decay.current) clearTimeout(decay.current);
    decay.current = setTimeout(() => {
      decay.current = null; distance.current = 0; callbacks.current.onInteraction(false);
    }, reduceMotion ? 80 : 400);
  }, [later, progress, reduceMotion, stopHold, stopTone]);
  const touch = (event: GestureResponderEvent) => ({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => active && !disabled && !complete.current && !fallback && nearSealStart(geometry, touch(event)),
    onPanResponderGrant: begin,
    onPanResponderMove: (event) => {
      if (!touching.current || complete.current || fallback) return;
      distance.current = advanceSeal(geometry, distance.current, touch(event));
      update(distance.current / geometry.total);
    },
    onPanResponderRelease: release, onPanResponderTerminate: release,
    onPanResponderTerminationRequest: () => !touching.current,
  }), [active, begin, disabled, fallback, geometry, release, update]);
  useEffect(() => {
    if (!active && touching.current && !complete.current) release();
  }, [active, release]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active' && touching.current && !complete.current) release(); });
    return () => subscription.remove();
  }, [release]);
  useEffect(() => () => {
    if (distance.current > 0 && !complete.current) track('anchor_seal_abandoned');
    timers.current.forEach(clearTimeout); stopHold(); stopTone();
    if (decay.current) clearTimeout(decay.current);
  }, [stopHold, stopTone]);
  return <View style={{ width: size }}>
    <Animated.View ref={medallion} collapsable={false} style={[{ width: size, height: size }, pressStyle]}>
      {children}
      {active ? <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={drawnPath} style="stroke" strokeWidth={1.2} color={colors.paper} opacity={0.42}><DashPathEffect intervals={[2, 5]} /></Path>
          <Path path={drawnPath} style="stroke" strokeWidth={1} color={appColors.gold} end={progress} />
          {geometry.points[0] ? <Circle cx={geometry.points[0].x} cy={geometry.points[0].y} r={2} color={appColors.gold} /> : null}
        </Canvas>
      </View> : null}
      {active && fallback ? <Pressable style={StyleSheet.absoluteFill} onPressIn={begin} onPressOut={release}
        disabled={disabled || complete.current} accessibilityRole="button" accessibilityLabel="Hold to seal."
        accessibilityActions={[{ name: 'activate', label: 'Hold to seal.' }]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'activate') begin(); }} testID="seal-hold" />
        : active ? <View style={StyleSheet.absoluteFill} {...responder.panHandlers} testID="seal-trace" /> : null}
      <SurfaceSweep size={size} play={flash} reduceMotion={reduceMotion} duration={320} />
    </Animated.View>
    {active ? <Text style={styles.hint} testID={provenance ? 'seal-provenance' : 'seal-hint'}>
      {provenance ?? (complete.current ? '' : fallback ? 'Hold to seal.' : 'Trace to seal.')}
    </Text> : <Text style={styles.hint}> </Text>}
  </View>;
}
const styles = StyleSheet.create({ hint: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', marginTop: 8, minHeight: 20 } });
