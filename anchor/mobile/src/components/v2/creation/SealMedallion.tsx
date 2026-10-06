import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';
import { AnalyticsService } from '@/services/AnalyticsService';
import { colors, typography } from '@/theme/v2';
import { useAnchorStore } from '@/stores/anchorStore';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
import { PAPER_ART_SHARE, creationSequence, creationTiming } from './creationMotion';
import { SurfaceSweep } from './SurfaceSweep';

const track = (event: string) => { try { AnalyticsService.track(event); } catch { /* non-critical */ } };
const impact = (style: Haptics.ImpactFeedbackStyle) => { void safeHaptics.impact(style); };

export function SealMedallion({ children, size, active, disabled, reduceMotion, onKeep, onInteraction, onCommitted, onMeasure }: {
  children: React.ReactNode; points: AnchorPoint[]; size: number; active: boolean; disabled: boolean; reduceMotion: boolean;
  onKeep: () => void; onInteraction: (locked: boolean) => void; onCommitted: () => void;
  onMeasure: (rect: { x: number; y: number; width: number; height: number }) => void;
}) {
  const count = useAnchorStore((state) => state.anchors.length);
  // DEFERRED: tracing and its dotted guide. Every user now holds the selected form.
  const progress = useSharedValue(0);
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const distance = useRef(0);
  const complete = useRef(false);
  const started = useRef(false);
  const touching = useRef(false);
  const thresholds = useRef(0);
  const tone = useRef<CreationSoundHandle | null>(null);
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
      // DEFERRED: the legacy forge-seal strike is replaced by the flow's sk-seal cue.
      impact(Haptics.ImpactFeedbackStyle.Heavy);
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
  }, [count, later, press, reduceMotion, stopHold, stopTone]);
  const update = useCallback((fraction: number) => {
    progress.value = fraction;
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
    tone.current = playCreationSound('sealRise');
    impact(Haptics.ImpactFeedbackStyle.Light);
    const start = Date.now();
    hold.current = setInterval(() => { const fraction = Math.min(1, (Date.now() - start) / 1200); distance.current = fraction; update(fraction); }, 16);
  }, [active, disabled, progress, update]);
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
  // DEFERRED: ordered-path PanResponder removed from the active interaction.
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
      {/* // DEFERRED: the dotted trace guide and gold path overlay. */}
      {active ? <Pressable style={StyleSheet.absoluteFill} onPressIn={begin} onPressOut={release}
        disabled={disabled || complete.current} accessibilityRole="button" accessibilityLabel="Hold to seal."
        accessibilityActions={[{ name: 'activate', label: 'Hold to seal.' }]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'activate') begin(); }} testID="seal-hold" /> : null}
      <SurfaceSweep size={size} play={flash} reduceMotion={reduceMotion} duration={320} />
    </Animated.View>
    {active ? <Text style={styles.hint} testID={provenance ? 'seal-provenance' : 'seal-hint'}>
      {provenance ?? (complete.current ? '' : 'Hold to seal.')}
    </Text> : <Text style={styles.hint}> </Text>}
  </View>;
}
const styles = StyleSheet.create({ hint: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', marginTop: 8, minHeight: 20 } });
