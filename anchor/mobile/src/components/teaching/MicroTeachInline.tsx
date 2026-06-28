/**
 * MicroTeachInline — Pattern 1: The Undertone
 *
 * A faint, italic single-line whisper rendered inline beneath the active
 * element. Fades in gently; respects reduced motion. Renders nothing when
 * no teaching is resolved by the gate.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, TextStyle } from 'react-native';
import type { TeachingContent } from '@/constants/teaching';
import { colors, spacing, typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useRecordOnShow } from './useRecordOnShow';

interface MicroTeachInlineProps {
  /** Resolved teaching from useTeachingGate, or null to render nothing. */
  teaching: TeachingContent | null;
  screenId: string;
  style?: StyleProp<TextStyle>;
}

export const MicroTeachInline: React.FC<MicroTeachInlineProps> = ({
  teaching,
  screenId,
  style,
}) => {
  const reduceMotion = useReduceMotionEnabled();
  const opacity = useRef(new Animated.Value(0)).current;

  useRecordOnShow(teaching, screenId);

  useEffect(() => {
    if (!teaching) return;
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [teaching, reduceMotion, opacity]);

  if (!teaching) return null;

  return (
    <Animated.Text style={[styles.text, { opacity }, style]} accessibilityRole="text">
      {teaching.copy}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: typography.fontSize.md,
    lineHeight: 22,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
