import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

interface ForgeAnchorButtonProps {
  onPress: () => void;
  reduceMotionEnabled: boolean;
  bottomOffset?: number;
}

export const ForgeAnchorButton: React.FC<ForgeAnchorButtonProps> = ({
  onPress,
  reduceMotionEnabled,
  bottomOffset = 106,
}) => {
  const scale = useSharedValue(1);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }

    breath.value = withRepeat(
      withTiming(1, { duration: 2900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    return () => {
      cancelAnimation(breath);
    };
  }, [breath, reduceMotionEnabled]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: interpolate(breath.value, [0, 1], [0.22, 0.4]),
    shadowRadius: interpolate(breath.value, [0, 1], [16, 24]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.2, 0.38]),
  }));

  return (
    <Animated.View style={[styles.button, { bottom: bottomOffset }, wrapperStyle]}>
      <Animated.View pointerEvents="none" style={[styles.glowLayer, glowStyle]} />
      <Pressable
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 170 });
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Forge new anchor"
        accessibilityHint="Opens the anchor creation screen"
      >
        <LinearGradient
          colors={['#b8920a', '#d4a820', '#c49a15']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Text style={styles.label}>+ FORGE ANCHOR</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 20,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.26)',
    shadowColor: 'rgba(201,168,76,0.9)',
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  gradient: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 13,
    letterSpacing: 2.35,
    color: '#1a0e00',
  },
  glowLayer: {
    position: 'absolute',
    top: -6,
    bottom: -8,
    left: -6,
    right: -6,
    borderRadius: 24,
    backgroundColor: 'rgba(201,168,76,0.22)',
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
});
