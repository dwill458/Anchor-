/**
 * Anchor App - Session Completion Screen
 *
 * Shared post-practice celebration screen used by Focus, Deep Prime, and
 * Visualize. Extracted from the original VisualizeCompletionScreen chrome —
 * same ripple-ring/shimmer coin, eyebrow/headline, stat row, and CTA
 * structure — themed per practice mode via `accentColor`. Only displays the
 * Thread Strength gained by the session that just completed; it never
 * calculates or awards Thread Strength itself.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Anchor } from '@/types';
import type { PracticeMode } from '@/types/practice';
import { colors as themeColors, typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { VisualizeFieldBackground } from '@/screens/visualize/VisualizeAnchorField';
import {
  VisualizationAnchorLens,
  VisualizationPrimaryButton,
} from '@/screens/visualize/VisualizationPrimitives';

const colors = {
  ...themeColors,
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.34)',
};

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const formatPracticeDurationLabel = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} sec`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
};

/**
 * Completion fields retain the atmosphere of the session just completed:
 * Focus carries its quiet navy-violet breath field, while Deep Prime carries
 * its dark ember-and-gold ritual field. Visualize remains on its own sapphire
 * field below.
 */
type CompletionFieldTheme = {
  gradient: readonly [string, string, string, string];
  glowPrimary: string;
  glowSecondary: string;
};

const COMPLETION_FIELD_THEMES: Record<'focus' | 'deep_prime', CompletionFieldTheme> = {
  focus: {
    // Mirrors FocusSession's Zen navy / deep-purple field and violet bloom.
    gradient: ['#0F1419', '#171329', '#11101D', '#07090F'],
    glowPrimary: '#AD99D2',
    glowSecondary: '#6F5F94',
  },
  deep_prime: {
    // Mirrors RitualScreen's deep ritual backdrop and ember-gold energy.
    gradient: ['#050309', '#080407', '#100706', '#241007'],
    glowPrimary: '#C8581A',
    glowSecondary: '#D4AF37',
  },
};

const ModeFieldBackground: React.FC<{
  practiceMode: 'focus' | 'deep_prime';
  accentColor: string;
  reduceMotion: boolean;
}> = ({
  practiceMode,
  accentColor,
  reduceMotion,
}) => {
  const theme = COMPLETION_FIELD_THEMES[practiceMode];
  const drift = useRef(new Animated.Value(reduceMotion ? 0.5 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduceMotion]);

  const glowScale = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const glowOpacity = drift.interpolate({ inputRange: [0, 1], outputRange: [0.68, 0.96] });
  const secondaryGlowOpacity = drift.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.78] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={theme.gradient}
        locations={[0, 0.42, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.modeGlow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      >
        <Svg width={480} height={480}>
          <Defs>
            <RadialGradient id="mode-field-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.glowPrimary} stopOpacity={0.38} />
              <Stop offset="50%" stopColor={accentColor} stopOpacity={0.16} />
              <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={480} height={480} fill="url(#mode-field-glow)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.modeSecondaryGlow, { opacity: secondaryGlowOpacity }]}
      >
        <Svg width={390} height={390}>
          <Defs>
            <RadialGradient id="mode-field-secondary-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.glowSecondary} stopOpacity={0.24} />
              <Stop offset="58%" stopColor={theme.glowSecondary} stopOpacity={0.07} />
              <Stop offset="100%" stopColor={theme.glowSecondary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={390} height={390} fill="url(#mode-field-secondary-glow)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

export interface SessionCompletionScreenProps {
  practiceMode: PracticeMode;
  anchor: Anchor | undefined;
  durationSeconds: number;
  /** Thread Strength gained by this session — newThreadStrength - previousThreadStrength. Never recalculated here. */
  threadDelta: number;
  eyebrow: string;
  headline: string;
  accentColor: string;
  onContinue: () => void;
  repeatLabel: string;
  onRepeat: () => void;
  /** Mode-specific secondary action, e.g. Visualize's Trace prompt. */
  secondaryAction?: React.ReactNode;
  /** Mode-specific content rendered below the stat row, e.g. Visualize's "Take It Forward" card. */
  belowStatsContent?: React.ReactNode;
}

export const SessionCompletionScreen: React.FC<SessionCompletionScreenProps> = ({
  practiceMode,
  anchor,
  durationSeconds,
  threadDelta,
  eyebrow,
  headline,
  accentColor,
  onContinue,
  repeatLabel,
  onRepeat,
  secondaryAction,
  belowStatsContent,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const HERO_SIZE = Math.min(screenWidth * 0.58, 250);

  const sigilSvg = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '';
  const imageUrl = anchor?.enhancedImageUrl;

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(reduceMotion ? 0.5 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const createRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 4_000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2_500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2_500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const r1 = createRipple(ring1, 0);
    const r2 = createRipple(ring2, 1_300);
    const r3 = createRipple(ring3, 2_600);

    r1.start();
    r2.start();
    r3.start();
    shimmerLoop.start();

    return () => {
      r1.stop();
      r2.stop();
      r3.stop();
      shimmerLoop.stop();
    };
  }, [reduceMotion, ring1, ring2, ring3, shimmer]);

  const ringScale1 = ring1.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity1 = ring1.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.6, 0] });

  const ringScale2 = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity2 = ring2.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.6, 0] });

  const ringScale3 = ring3.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity3 = ring3.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.6, 0] });

  const shimmerScale = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const shimmerAuraSize = HERO_SIZE * 1.29;
  const rippleRingSize = HERO_SIZE * 1.17;

  const ringColor = withAlpha(accentColor, 0.28);
  const shimmerColor = withAlpha(accentColor, 0.18);
  const deltaLabel = `THREAD ${threadDelta >= 0 ? '+' : ''}${threadDelta}`;
  const modeField = practiceMode === 'deep_prime' ? 'deep_prime' : 'focus';

  return (
    <View style={styles.container}>
      {practiceMode === 'visualize' ? (
        <VisualizeFieldBackground phase="return" reduceMotion={reduceMotion} />
      ) : (
        <ModeFieldBackground
          practiceMode={modeField}
          accentColor={accentColor}
          reduceMotion={reduceMotion}
        />
      )}
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top + 20, 48), paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.markContainer}>
            <Animated.View
              style={[
                styles.shimmerAura,
                {
                  width: shimmerAuraSize,
                  height: shimmerAuraSize,
                  borderRadius: shimmerAuraSize / 2,
                  backgroundColor: shimmerColor,
                  opacity: shimmerOpacity,
                  transform: [{ scale: shimmerScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  width: rippleRingSize,
                  height: rippleRingSize,
                  borderRadius: rippleRingSize / 2,
                  borderColor: ringColor,
                  opacity: ringOpacity1,
                  transform: [{ scale: ringScale1 }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  width: rippleRingSize,
                  height: rippleRingSize,
                  borderRadius: rippleRingSize / 2,
                  borderColor: ringColor,
                  opacity: ringOpacity2,
                  transform: [{ scale: ringScale2 }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.rippleRing,
                {
                  width: rippleRingSize,
                  height: rippleRingSize,
                  borderRadius: rippleRingSize / 2,
                  borderColor: ringColor,
                  opacity: ringOpacity3,
                  transform: [{ scale: ringScale3 }],
                },
              ]}
            />
            <VisualizationAnchorLens
              size={HERO_SIZE}
              imageUrl={imageUrl}
              svg={sigilSvg}
              still={reduceMotion}
            />
          </View>

          <Text style={[styles.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
          <Text style={styles.title}>{headline}</Text>

          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statVal}>{formatPracticeDurationLabel(durationSeconds).toUpperCase()}</Text>
              <Text style={styles.statLbl}>PRACTICED</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statVal}>{deltaLabel}</Text>
              <Text style={styles.statLbl}>STRENGTHENED</Text>
            </View>
          </View>

          {belowStatsContent}

          <View style={styles.actionsWrap}>
            {secondaryAction}

            <VisualizationPrimaryButton label="CONTINUE →" onPress={onContinue} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={repeatLabel}
              onPress={onRepeat}
              style={styles.ghostBtnWrap}
            >
              <Text style={styles.ghostBtnText}>{repeatLabel}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04060c',
  },
  modeGlow: {
    position: 'absolute',
    width: 480,
    height: 480,
    top: -132,
    left: -96,
  },
  modeSecondaryGlow: {
    position: 'absolute',
    width: 390,
    height: 390,
    right: -138,
    bottom: 68,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  markContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    marginBottom: 14,
  },
  shimmerAura: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  rippleRing: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
    borderWidth: 1,
  },
  eyebrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 27,
    fontWeight: '500',
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 10,
  },
  statCell: {
    alignItems: 'center',
    gap: 3,
  },
  statVal: {
    fontFamily: typography.fonts.heading,
    fontSize: 19,
    color: colors.bone,
    letterSpacing: 0.4,
  },
  statLbl: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.boneFaint,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(245,240,232,0.12)',
  },
  actionsWrap: {
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  ghostBtnWrap: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  ghostBtnText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.boneSoft,
  },
});
