import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react-native';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryColor, motion, spacing, typography } from '@/theme/v2';

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
  const content = <><View style={styles.heading}><Text style={styles.label}>Thread Strength</Text>{(delta !== undefined || detail) ? <View style={styles.movement}>{direction}<Text style={styles.movementText}>{delta !== undefined ? `${delta > 0 ? '+' : ''}${delta}${detail ? ` ${detail}` : ''}` : detail}</Text></View> : null}</View><View style={styles.valueRow}><Text testID="v2-thread-strength-value" style={styles.value}>{displayed}</Text><Text style={styles.outOf}>/ 100</Text></View><View style={styles.track} accessibilityElementsHidden><View style={[styles.fill, { width: `${target}%`, backgroundColor: accent }]} /></View></>;
  return <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel ?? `Thread Strength ${target}${delta !== undefined ? `, ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged'} ${Math.abs(delta)}` : ''}`} style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}>{content}</Pressable>;
}
const styles = StyleSheet.create({ card: { gap: 3, paddingHorizontal: spacing[1] }, pressed: { opacity: 0.72 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, label: { ...typography.headingSM, color: colors.text.primary }, valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 }, value: { ...typography.numericLarge, fontSize: 53, lineHeight: 58, letterSpacing: -2, color: colors.text.primary }, outOf: { ...typography.bodyMD, color: colors.text.secondary }, track: { height: 5, borderRadius: 3, backgroundColor: colors.border.default, overflow: 'hidden' }, fill: { height: 5, borderRadius: 3 }, movement: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] }, movementText: { ...typography.bodySM, color: colors.text.secondary } });
