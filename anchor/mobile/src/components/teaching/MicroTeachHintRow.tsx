/**
 * MicroTeachHintRow — Pattern 2: The Ground Note
 *
 * A calm hint anchored near the bottom of a screen: a primary line and an
 * optional quieter secondary line. Fades in; respects reduced motion.
 * Renders nothing when no teaching is resolved.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { TeachingContent } from '@/constants/teaching';
import { colors, spacing, typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useRecordOnShow } from './useRecordOnShow';

interface MicroTeachHintRowProps {
  teaching: TeachingContent | null;
  screenId: string;
  style?: StyleProp<ViewStyle>;
}

export const MicroTeachHintRow: React.FC<MicroTeachHintRowProps> = ({
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
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [teaching, reduceMotion, opacity]);

  if (!teaching) return null;

  return (
    <Animated.View style={[styles.row, { opacity }, style]} pointerEvents="none">
      <View style={styles.pin} />
      <View style={styles.textBlock}>
        <Animated.Text style={styles.primary}>{teaching.copy}</Animated.Text>
        {teaching.copySecondary ? (
          <Animated.Text style={styles.secondary}>{teaching.copySecondary}</Animated.Text>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pin: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    marginRight: spacing.sm,
    backgroundColor: colors.ritual.pin,
  },
  textBlock: {
    flex: 1,
  },
  primary: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  secondary: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    lineHeight: 17,
    color: colors.text.tertiary,
  },
});
