/**
 * HeroAnchorCard — Anchor 1.5 Sanctuary hero stage.
 *
 * Circular sigil stage plus a centered Thread Strength read-out (state badge,
 * strength number, anchor title, category). The whole region is one tap
 * target into Anchor Detail. See `09 Sanctuary Home.html`.
 */

import React, { useEffect, useMemo } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { Anchor } from '@/types';
import { formatCategory } from '../utils/anchorStateHelpers';
import { useSessionStore } from '@/stores/sessionStore';
import { calculateStreak } from '@/utils/streakHelpers';
import { isoWeekKey } from '@/utils/primingAnalytics';
import { resolveAnchorStrengthPct } from '@/components/ThreadStrengthSheet';
import { getThreadState } from '@/screens/practice/components/ThreadStrengthBlock';

// ─── helpers ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 28;
// ~189/335 of the mockup's 375pt baseline, capped so it doesn't balloon on
// tablets/large phones (spec: cap rather than stretch on large screens).
const CIRCLE_SIZE = Math.min(Math.round((SCREEN_WIDTH - H_PAD * 2) * 0.6), 210);

const STATE_BADGE: Record<ReturnType<typeof getThreadState>, string> = {
  strong: 'TEMPERED',
  recover: 'RENEWED',
  fading: 'FADING',
};

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Per-anchor Thread Strength, mirroring AnchorDetailScreen's derivation. */
function useAnchorThreadStrength(anchor: Anchor): { pct: number; lastPrimedAt: string | null } {
  const sessionLog = useSessionStore((s) => s.sessionLog);

  return useMemo(() => {
    const currentWeekKey = isoWeekKey(new Date());
    const primingSessions = sessionLog
      .filter(
        (entry) =>
          entry.anchorId === anchor.id &&
          (entry.type === 'activate' || entry.type === 'reinforce'),
      )
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const weekHistory = [false, false, false, false, false, false, false];
    primingSessions.forEach((entry) => {
      const date = new Date(entry.completedAt);
      if (Number.isNaN(date.getTime()) || isoWeekKey(date) !== currentWeekKey) return;
      weekHistory[(date.getDay() + 6) % 7] = true;
    });

    const currentStreak = calculateStreak(
      primingSessions.map((entry) => ({ createdAt: entry.completedAt })),
    ).currentStreak;

    const lastPrimedAt = primingSessions[0]
      ? localDateString(new Date(primingSessions[0].completedAt))
      : null;

    const pct = resolveAnchorStrengthPct({
      storedStrength: anchor.threadStrength ?? null,
      totalSessions: primingSessions.length,
      currentStreak,
      thisWeekDays: weekHistory.map((primed) => ({
        day: '',
        type: primed ? 'focus' : 'empty',
        isToday: false,
      })),
    });

    return { pct, lastPrimedAt };
  }, [anchor.id, anchor.threadStrength, sessionLog]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface HeroAnchorCardProps {
  anchor: Anchor;
  onPress: () => void;
  reduceMotionEnabled?: boolean;
}

const HeroAnchorCardInner: React.FC<HeroAnchorCardProps> = ({
  anchor,
  onPress,
  reduceMotionEnabled = false,
}) => {
  const imageUrl = anchor.enhancedImageUrl;
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;
  const { pct: strengthPct, lastPrimedAt } = useAnchorThreadStrength(anchor);
  const threadState = getThreadState(strengthPct, lastPrimedAt);

  // ── Glow breathe ────────────────────────────────────────────────────────────
  const glowOpacity = useSharedValue(0.5);
  useEffect(() => {
    if (reduceMotionEnabled) {
      glowOpacity.value = 0.5;
      return;
    }
    glowOpacity.value = withRepeat(
      withTiming(1.0, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(glowOpacity);
  }, [reduceMotionEnabled, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ── Press scale ──────────────────────────────────────────────────────────────
  const pressScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  useEffect(() => () => cancelAnimation(pressScale), [pressScale]);

  const onPressIn = () => {
    if (reduceMotionEnabled) return;
    pressScale.value = withTiming(0.97, { duration: 120, easing: Easing.out(Easing.quad) });
  };
  const onPressOut = () => {
    pressScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${anchor.intentionText}, ${formatCategory(anchor.category)}. Thread Strength ${strengthPct}, ${STATE_BADGE[threadState]}.`}
    >
      <Animated.View style={[styles.heroWrap, cardStyle]}>
        {/* ── Circle sigil stage ── */}
        <View style={styles.circleOuter}>
          <Animated.View style={[styles.glowBackdrop, glowStyle]} />

          <View style={styles.circleClip}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="hero-stage" cx="42%" cy="34%" r="70%">
                  <Stop offset="0%" stopColor="#233440" stopOpacity={0.85} />
                  <Stop offset="100%" stopColor="#090D11" stopOpacity={0.94} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={CIRCLE_SIZE} height={CIRCLE_SIZE} fill="url(#hero-stage)" />
            </Svg>

            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.circleImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.sigilFallback}>
                <SvgXml xml={sigilSvg} width={CIRCLE_SIZE * 0.55} height={CIRCLE_SIZE * 0.55} />
              </View>
            )}
            <View style={styles.innerGlowRing} pointerEvents="none" />
          </View>
        </View>

        {/* ── Thread Strength read-out ── */}
        <View style={styles.textInfo}>
          <Text style={styles.stateBadge}>{STATE_BADGE[threadState]}</Text>
          <Text style={styles.strengthNumber}>{strengthPct}</Text>
          <Text style={styles.strengthEyebrow}>Thread Strength</Text>
          <Text style={styles.anchorTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {anchor.intentionText}
          </Text>
          <Text style={styles.anchorCategory}>{formatCategory(anchor.category)}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const HeroAnchorCard = React.memo(HeroAnchorCardInner);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
  },
  circleOuter: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBackdrop: {
    position: 'absolute',
    width: CIRCLE_SIZE + 30,
    height: CIRCLE_SIZE + 30,
    borderRadius: (CIRCLE_SIZE + 30) / 2,
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.08),
  },
  circleClip: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.2),
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleImage: {
    width: '100%',
    height: '100%',
  },
  sigilFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerGlowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: withAlpha(colors.anchor15.gilt, 0.1),
  },
  textInfo: {
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  stateBadge: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 2.34,
    color: colors.anchor15.giltBright,
    marginBottom: 6,
  },
  strengthNumber: {
    fontFamily: 'Inter-Regular',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.68,
    color: colors.anchor15.gilt,
  },
  strengthEyebrow: {
    marginTop: 4,
    fontFamily: 'Cinzel-Regular',
    fontSize: 9.5,
    letterSpacing: 2.09,
    textTransform: 'uppercase',
    color: withAlpha(colors.anchor15.gilt, 0.55),
  },
  anchorTitle: {
    marginTop: 12,
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 22,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.anchor15.bone,
    textAlign: 'center',
  },
  anchorCategory: {
    marginTop: 6,
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.anchor15.ash,
  },
});
