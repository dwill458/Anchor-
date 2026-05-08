// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,14,0.6)' }]} />
        )}

        <AnimatedView style={[styles.container, animStyle]}>
          <LinearGradient
            colors={['rgba(20,26,35,0.95)', 'rgba(16,21,28,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <LinearGradient
              colors={['rgba(212,175,55,0.12)', 'rgba(212,175,55,0.04)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Checkmark icon */}
            <Text style={styles.checkmark}>✓</Text>

            {/* Success message */}
            <Text style={styles.title}>Exported</Text>
            <Text style={styles.message}>
              {resLabel} {formatLabel} PNG saved to Photos
            </Text>

            {/* Dismiss button */}
            <TouchableOpacity
              style={styles.button}
              onPress={onDismiss}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <LinearGradient
                colors={['#b8920a', '#d4a820', '#c49a15']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    padding: spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  checkmark: {
    fontSize: 48,
    color: colors.gold,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    letterSpacing: 1.5,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  message: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 14,
    letterSpacing: 1.5,
    color: colors.navy,
    textTransform: 'uppercase',
  },
});
