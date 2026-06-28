/**
 * MicroTeachCard — Pattern 3: The Veil Card
 *
 * A glassmorphic card with a short title and body, plus a dismiss control.
 * Used sparingly (the gate enforces a 24h cooldown across veil cards).
 * Fades in/out; respects reduced motion. Renders nothing when no teaching
 * is resolved or after dismissal.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import type { TeachingContent } from '@/constants/teaching';
import { colors, spacing, typography } from '@/theme';
import { GlassCard } from '@/components/common/GlassCard';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useRecordOnShow } from './useRecordOnShow';

interface MicroTeachCardProps {
  teaching: TeachingContent | null;
  screenId: string;
  style?: StyleProp<ViewStyle>;
  onDismiss?: () => void;
}

export const MicroTeachCard: React.FC<MicroTeachCardProps> = ({
  teaching,
  screenId,
  style,
  onDismiss,
}) => {
  const reduceMotion = useReduceMotionEnabled();
  const opacity = useRef(new Animated.Value(0)).current;
  const [dismissed, setDismissed] = useState(false);

  useRecordOnShow(teaching, screenId);

  useEffect(() => {
    if (!teaching) return;
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [teaching, reduceMotion, opacity]);

  if (!teaching || dismissed) return null;

  const handleDismiss = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    AnalyticsService.track('teaching_dismissed', {
      teaching_id: teaching.teachingId,
      pattern: teaching.pattern,
      screen: teaching.screen,
    });
    const finish = () => {
      setDismissed(true);
      onDismiss?.();
    };
    if (reduceMotion) {
      finish();
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(finish);
  };

  return (
    <Animated.View style={[{ opacity }, style]}>
      <GlassCard contentStyle={styles.content}>
        <View style={styles.header}>
          {teaching.title ? <Text style={styles.title}>{teaching.title}</Text> : <View />}
          <Pressable
            onPress={handleDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <X color={colors.text.tertiary} size={16} />
          </Pressable>
        </View>
        <Text style={styles.body}>{teaching.copy}</Text>
        {teaching.copySecondary ? (
          <Text style={styles.secondary}>{teaching.copySecondary}</Text>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: typography.fontSize.md,
    color: colors.gold,
  },
  body: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    lineHeight: 21,
    color: colors.text.secondary,
  },
  secondary: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    color: colors.text.tertiary,
  },
});
