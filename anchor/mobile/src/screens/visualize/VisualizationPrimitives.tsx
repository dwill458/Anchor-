import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';

import { colors as themeColors, typography } from '@/theme';
import type { VisualizeSegmentState } from './visualizePresentation';

const colors = {
  ...themeColors,
  gold: '#D4AF37',
  goldBright: '#F0CB6A',
  goldDim: '#8a6f23',
  goldLine: 'rgba(212,175,55,0.28)',
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.34)',
};

type LensProps = {
  size: number;
  imageUrl?: string;
  svg?: string;
  still?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A circular presentation of an Anchor coin matching the parchment Sigil aesthetic
 * in Visualize Mode (Standalone) (5).html.
 */
export const VisualizationAnchorLens = React.memo(({
  size,
  imageUrl,
  svg,
  still = false,
  style,
}: LensProps) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      floatAnim.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 4_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 4_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim, still]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });
  const scale = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const innerSize = Math.round(size - 6);

  return (
    <Animated.View
      style={[
        styles.sigilWrap,
        {
          width: size,
          height: size,
          transform: still ? [] : [{ translateY }, { scale }],
        },
        style,
      ]}
    >
      {/* Parchment Coin Base */}
      <LinearGradient
        colors={['#f9f2de', '#e8dcb8', '#c4b07c']}
        locations={[0, 0.48, 1]}
        start={{ x: 0.32, y: 0.26 }}
        end={{ x: 0.8, y: 0.9 }}
        style={[
          styles.sigilPaper,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {/* Subtle Coin Rings SVG */}
        <Svg
          viewBox="0 0 200 200"
          style={StyleSheet.absoluteFill}
        >
          {[18, 34, 50, 66, 82].map((r) => (
            <Circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="rgba(55,35,15,0.13)"
              strokeWidth="0.6"
            />
          ))}
        </Svg>

        {/* User Sigil / Image / Mark */}
        <View
          style={[
            styles.sigilInnerContent,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            },
          ]}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
              resizeMode="cover"
            />
          ) : svg ? (
            <SvgXml xml={svg} width={innerSize * 0.75} height={innerSize * 0.75} />
          ) : (
            <Svg viewBox="0 0 200 200" width={innerSize} height={innerSize}>
              <Path
                d="M58 62 L142 62 L72 148"
                fill="none"
                stroke="#1a1208"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M58 62 Q62 74 66 84"
                fill="none"
                stroke="#1a1208"
                strokeWidth="3"
                strokeLinecap="round"
                opacity={0.65}
              />
              <Circle
                cx="100"
                cy="100"
                r="13"
                fill="none"
                stroke="#3a2818"
                strokeWidth="1.8"
                opacity={0.45}
              />
            </Svg>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

type ProgressProps = {
  currentPhaseIndex: number;
  totalPhases?: number;
  phaseProgress?: number;
  remainingText?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 5-Dot Phase Track with circular SVG ring animating around the active dot.
 */
export const VisualizationPhaseTrack: React.FC<ProgressProps> = ({
  currentPhaseIndex,
  totalPhases = 5,
  phaseProgress = 0,
  remainingText,
  style,
}) => {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, phaseProgress)));

  return (
    <View style={[styles.trackRow, style]}>
      <View style={styles.phaseTrack}>
        {Array.from({ length: totalPhases }).map((_, i) => {
          const isDone = i < currentPhaseIndex;
          const isActive = i === currentPhaseIndex;

          return (
            <View key={i} style={styles.dotCell}>
              {isActive && (
                <Svg
                  width={18}
                  height={18}
                  viewBox="0 0 18 18"
                  style={styles.dotRingSvg}
                >
                  <Circle
                    cx="9"
                    cy="9"
                    r={radius}
                    fill="none"
                    stroke="rgba(212,175,55,0.75)"
                    strokeWidth={1.4}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </Svg>
              )}
              <View
                style={[
                  styles.phaseDot,
                  isDone && styles.phaseDotDone,
                  isActive && styles.phaseDotActive,
                ]}
              />
            </View>
          );
        })}
      </View>
      {remainingText ? (
        <Text style={styles.timeLeftText}>{remainingText}</Text>
      ) : null}
    </View>
  );
};

export const VisualizationPhaseProgress = VisualizationPhaseTrack;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const VisualizationPrimaryButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  disabled = false,
  style,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.primaryButtonWrap,
      disabled && styles.primaryDisabled,
      pressed && styles.primaryPressed,
      style,
    ]}
  >
    <LinearGradient
      colors={['#C9A84C', '#A8892E', '#8B7020']}
      locations={[0, 0.6, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.primaryGradient}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  sigilWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sigilPaper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  sigilInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phaseTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotCell: {
    position: 'relative',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRingSvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.28)',
    backgroundColor: 'transparent',
  },
  phaseDotDone: {
    backgroundColor: '#8a6f23',
    borderColor: '#8a6f23',
  },
  phaseDotActive: {
    backgroundColor: '#F0CB6A',
    borderColor: '#F0CB6A',
    shadowColor: '#F0CB6A',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  timeLeftText: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    color: colors.boneFaint,
    letterSpacing: 0.8,
  },
  primaryButtonWrap: {
    width: '100%',
    minHeight: 52,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryGradient: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryLabel: {
    color: '#0f0d08',
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  primaryDisabled: {
    opacity: 0.35,
  },
  primaryPressed: {
    transform: [{ translateY: 1 }],
  },
});
