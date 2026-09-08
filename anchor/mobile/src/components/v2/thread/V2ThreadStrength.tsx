import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react-native';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryColor, motion, radii, spacing, typography } from '@/theme/v2';

type Props = { value: number; previousValue?: number; delta?: number; category?: string | null; trend?: 'up' | 'down' | 'flat'; detail?: string; onPress?: () => void; accessibilityLabel?: string; reduceMotion?: boolean; testID?: string };
const clampDisplayValue = (value: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

/** Presentation-only. `value`, `delta`, and `trend` are supplied by progression authority. */
export function V2ThreadStrength({ value, previousValue: _previousValue, delta, category, trend = 'flat', detail, onPress, accessibilityLabel, reduceMotion: reduceMotionOverride, testID }: Props) {
  const systemReduceMotion = useV2ReduceMotion();
  const reduceMotion = reduceMotionOverride ?? systemReduceMotion;
  const target = clampDisplayValue(value);
  const animated = useRef(new Animated.Value(reduceMotion ? target : 0)).current;
  const [displayed, setDisplayed] = useState(reduceMotion ? target : 0);
  useEffect(() => { if (reduceMotion) { animated.setValue(target); setDisplayed(target); return; } const listener = animated.addListener(({ value: next }) => setDisplayed(clampDisplayValue(next))); const animation = Animated.timing(animated, { toValue: target, duration: motion.slow, useNativeDriver: false }); animation.start(); return () => { animation.stop(); animated.removeListener(listener); }; }, [animated, reduceMotion, target]);
  const accent = getCategoryColor(category);
  const direction = trend === 'up' ? <ArrowUpRight size={16} color={colors.semantic.success} /> : trend === 'down' ? <ArrowDownRight size={16} color={colors.semantic.error} /> : <ArrowRight size={16} color={colors.text.secondary} />;
  const content = <><View style={styles.heading}><Text style={styles.label}>Thread Strength</Text><Text testID="v2-thread-strength-value" style={styles.value}>{displayed}</Text></View><View style={styles.track} accessibilityElementsHidden><View style={[styles.fill, { width: `${target}%`, backgroundColor: accent }]} /><View style={[styles.marker, { left: `${Math.min(96, Math.max(2, target))}%`, backgroundColor: accent }]} /></View>{(delta !== undefined || detail) ? <View style={styles.movement}>{direction}<Text style={styles.movementText}>{delta !== undefined ? `${delta > 0 ? '+' : ''}${delta}${detail ? ` ${detail}` : ''}` : detail}</Text></View> : null}</>;
  return <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel ?? `Thread Strength ${target}${delta !== undefined ? `, ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged'} ${Math.abs(delta)}` : ''}`} style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}>{content}</Pressable>;
}
const styles = StyleSheet.create({ card: { gap: spacing[3], padding: spacing[5], borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle }, pressed: { opacity: 0.76 }, heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, label: { ...typography.headingSM, color: colors.text.primary }, value: { ...typography.numericLarge, color: colors.text.primary }, track: { height: 7, borderRadius: radii.round, backgroundColor: colors.grouped, overflow: 'visible' }, fill: { height: 7, borderRadius: radii.round }, marker: { position: 'absolute', top: -4, width: 15, height: 15, borderRadius: radii.round, borderWidth: 3, borderColor: colors.surface }, movement: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] }, movementText: { ...typography.bodySM, color: colors.text.secondary } });
