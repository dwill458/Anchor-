import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
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
import { colors, typography } from '@/theme';

interface DailyStreakStripProps {
  streakDays: number;
  onPress: () => void;
  reduceMotionEnabled: boolean;
}

export const DailyStreakStrip: React.FC<DailyStreakStripProps> = ({
  streakDays,
  onPress,
  reduceMotionEnabled,
}) => {
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      cancelAnimation(drift);
      drift.value = 0;
      return;
    }

    drift.value = withRepeat(
      withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    return () => {
      cancelAnimation(drift);
    };
  }, [drift, reduceMotionEnabled]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(drift.value, [0, 1], [-24, 24]),
      },
    ],
    opacity: interpolate(drift.value, [0, 1], [0.3, 0.42]),
  }));

  return (
    <Pressable
      style={styles.pressable}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Daily streak: ${streakDays} days. View details`}
      accessibilityHint="Opens your practice tab"
    >
      <View style={styles.container}>
        <BlurView
          intensity={48}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {!reduceMotionEnabled && (
          <Animated.View pointerEvents="none" style={[styles.driftLayer, driftStyle]}>
            <LinearGradient
              colors={['rgba(240,203,106,0)', 'rgba(240,203,106,0.14)', 'rgba(240,203,106,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        )}

        <View style={styles.left}>
          <Text style={styles.flame}>🔥</Text>
          <View>
            <Text style={styles.title}>Daily Streak</Text>
            <Text style={styles.hint}>Keep the momentum going</Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.number}>{streakDays}</Text>
          <Text style={styles.viewText}>View {'>'}</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginTop: 8,
    marginHorizontal: 22,
    borderRadius: 14,
    overflow: 'hidden',
  },
  container: {
    minHeight: 48,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18,12,32,0.45)',
    shadowColor: '#2B1640',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  driftLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flame: {
    fontSize: 18,
  },
  title: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.sanctuary.gold,
    textTransform: 'uppercase',
  },
  hint: {
    marginTop: 0.5,
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: 'rgba(200,185,155,0.72)',
  },
  right: {
    alignItems: 'flex-end',
    gap: 1,
  },
  number: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 28,
    lineHeight: 30,
    color: colors.sanctuary.goldBright,
    textShadowColor: 'rgba(240,203,106,0.34)',
    textShadowRadius: 10,
  },
  viewText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 0.3,
    color: 'rgba(200,185,155,0.68)',
  },
});
