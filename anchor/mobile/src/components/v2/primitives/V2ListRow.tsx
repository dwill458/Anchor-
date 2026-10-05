import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { AnimatedPressable, usePressScale } from '@/components/v2/motion';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { colors, radii, spacing, typography } from '@/theme/v2';

type Props = { icon?: React.ReactNode; title: string; subtitle?: string; trailing?: React.ReactNode; onPress?: () => void; accent?: string; disclosure?: boolean; variant?: 'canvas' | 'grouped'; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; testID?: string };

/** How far the disclosure chevron leans into a press, in dp. */
const CHEVRON_LEAN = 2;

export function V2ListRow({ icon, title, subtitle, trailing, onPress, accent, disclosure = false, variant = 'canvas', accessibilityLabel, style, testID }: Props) {
  const reduceMotion = useV2ReduceMotion();
  const press = usePressScale();
  const wash = useAnimatedStyle(() => ({ opacity: press.pressed.value }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 0 : press.pressed.value * CHEVRON_LEAN }] }));
  const interactive = Boolean(onPress);

  const content = (
    <>
      {interactive ? <Animated.View pointerEvents="none" style={[styles.wash, variant === 'canvas' && styles.washBleed, wash]} /> : null}
      <View style={[styles.icon, accent && { backgroundColor: `${accent}18` }]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.trailing}>
        {trailing}
        {disclosure ? (
          <Animated.View style={chevron}>
            <ChevronRight size={18} color={colors.text.secondary} />
          </Animated.View>
        ) : null}
      </View>
    </>
  );

  if (!interactive) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel ?? title} style={[styles.base, variant === 'grouped' && styles.grouped, style]}>
        {content}
      </View>
    );
  }
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.base, variant === 'grouped' && styles.grouped, style]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  grouped: { paddingHorizontal: spacing[3], borderRadius: radii.md, backgroundColor: colors.grouped },
  wash: { ...StyleSheet.absoluteFillObject, borderRadius: radii.md, backgroundColor: colors.border.subtle },
  washBleed: { left: -spacing[2], right: -spacing[2] },
  icon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.labelLG, color: colors.text.primary },
  subtitle: { ...typography.bodySM, color: colors.text.secondary },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
