// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';

type Props = {
  visible: boolean;
  format: 'square' | 'wallpaper' | 'print';
  resolution: 'standard' | 'high';
  onDismiss: () => void;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function ExportSuccessModal({ visible, format, resolution, onDismiss }: Props) {
  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
      // Auto-dismiss after 2.5 seconds
      const timer = setTimeout(onDismiss, 2500);
      return () => clearTimeout(timer);
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      setTimeout(() => setMounted(false), 150);
    }
  }, [visible, onDismiss]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const formatLabel = format === 'wallpaper' ? 'Wallpaper' : format === 'print' ? 'Print' : 'Square';
  const resLabel = resolution === 'high' ? 'High-Res' : 'Standard';

  if (!mounted) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.62)' }]} />
        </View>

        <AnimatedView style={[styles.container, animStyle]}>
          <View style={styles.card}>
            <View style={styles.checkRing}>
              <Text style={styles.checkmark}>✓</Text>
            </View>

            <Text style={styles.title}>Exported</Text>
            <Text style={styles.message}>
              {resLabel} {formatLabel} PNG saved to Photos
            </Text>

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.buttonText}>DONE</Text>
            </Pressable>
          </View>
        </AnimatedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.anchor15.veil,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    padding: spacing.lg,
    alignItems: 'center',
  },
  checkRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.anchor15.giltBright,
    backgroundColor: 'rgba(217,179,108,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  checkmark: {
    fontSize: 22,
    color: colors.anchor15.giltBright,
    fontFamily: typography.fontFamily.ritualSemiBold,
  },
  title: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 20,
    lineHeight: 25,
    marginBottom: spacing.xs,
  },
  message: {
    color: 'rgba(244,239,230,0.65)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.anchor15.giltBright,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#10151A',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 11.5,
    letterSpacing: 1.8,
  },
});
