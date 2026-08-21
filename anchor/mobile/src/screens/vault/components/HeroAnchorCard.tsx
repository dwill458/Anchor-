/**
 * HeroAnchorCard — Anchor 1.5 Sanctuary Hero Stage.
 *
 * Implements the 244px circular sigil stage with 320° ThreadRing sweep and
 * centered circular medallion coin talisman, plus thread strength read-out
 * (state badge, count-up strength number, anchor title, category).
 *
 * Matches `Sanctuary Home (Standalone).html`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
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
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { Anchor } from '@/types';
import type { PerformanceTier } from '@/hooks/usePerformanceTier';
import { formatCategory } from '../utils/anchorStateHelpers';
import { useSessionStore } from '@/stores/sessionStore';
import { calculateStreak } from '@/utils/streakHelpers';
import { isoWeekKey } from '@/utils/primingAnalytics';
import { resolveAnchorStrengthPct } from '@/components/ThreadStrengthSheet';
import { getThreadState } from '@/screens/practice/components/ThreadStrengthBlock';
import { BakedGlow } from '@/components/common';
import { ThreadRing } from './ThreadRing';
import { MedallionCoin } from './MedallionCoin';
import { SelectedChipGlowRing } from './SelectedChipGlowRing';

// ─── Constants & Layout ───────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 20;
// Scaled up from the 244pt prototype baseline to fill the dead space that used
// to sit below the anchor stack; still capped proportionally on smaller devices.
const STAGE_SIZE = Math.min(Math.round((SCREEN_WIDTH - H_PAD * 2) * 0.78), 296);
const MEDALLION_SIZE = Math.round(STAGE_SIZE * 0.72); // ~242pt when stage is 336pt
// Hugs the coin's own edge (same "+outside the edge" treatment as the
// AnchorStack chip ring) rather than spanning the whole stage — the coin
// stays the clear focal point instead of getting washed out by a big blur.
const MEDALLION_GLOW_SIZE = Math.round(MEDALLION_SIZE * 1.26);
const MEDALLION_RING_RADIUS = MEDALLION_SIZE / 2 + 8;

const STATE_BADGE: Record<ReturnType<typeof getThreadState>, string> = {
  strong: 'TEMPERED',
  recover: 'RENEWED',
  fading: 'FADING',
};

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Animated number count-up mirroring the HTML CountUp component */
const CountUp: React.FC<{ value: number; reduceMotion?: boolean }> = ({
  value,
  reduceMotion = false,
}) => {
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    let start: number | undefined;
    let animId: number;
    const duration = 900;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const timer = setTimeout(() => {
      const step = (timestamp: number) => {
        if (start === undefined) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        setDisplay(Math.round(ease(progress) * value));
        if (progress < 1) {
          animId = requestAnimationFrame(step);
        }
      };
      animId = requestAnimationFrame(step);
    }, 200);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animId);
    };
  }, [value, reduceMotion]);

  return <Text style={styles.strengthNumber}>{display}</Text>;
};

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
  performanceTier?: PerformanceTier;
}

const HeroAnchorCardInner: React.FC<HeroAnchorCardProps> = ({
  anchor,
  onPress,
  reduceMotionEnabled = false,
  performanceTier = 'high',
}) => {
  const imageUrl = anchor.enhancedImageUrl;
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;
  const { pct: strengthPct, lastPrimedAt } = useAnchorThreadStrength(anchor);
  const threadState = getThreadState(strengthPct, lastPrimedAt);
  const badgeLabel = STATE_BADGE[threadState] || (strengthPct >= 70 ? 'TEMPERED' : strengthPct >= 30 ? 'KINDLING' : 'NASCENT');
  const showGlowRingPulse = performanceTier === 'high' && !reduceMotionEnabled;
  const showStaticGlowRing = performanceTier === 'medium';

  // ── Press scale animation ──
  const pressScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const onPressIn = () => {
    if (reduceMotionEnabled) return;
    pressScale.value = withTiming(0.975, { duration: 120, easing: Easing.out(Easing.quad) });
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
      accessibilityLabel={`${anchor.intentionText}, ${formatCategory(anchor.category)}. Thread Strength ${strengthPct}, ${badgeLabel}.`}
    >
      <Animated.View style={[styles.heroWrap, cardStyle]}>
        {/* ── Anchor Stage (244pt) ── */}
        <View style={[styles.stageOuter, { width: STAGE_SIZE, height: STAGE_SIZE }]}>
          {/* Circular dark radial gradient floor (inset 26) */}
          <View style={[styles.stageFloor, { width: STAGE_SIZE - 52, height: STAGE_SIZE - 52, borderRadius: (STAGE_SIZE - 52) / 2 }]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="stage-floor" cx="42%" cy="34%" r="70%">
                  <Stop offset="0%" stopColor="#233440" stopOpacity={0.85} />
                  <Stop offset="74%" stopColor="#090D11" stopOpacity={0.94} />
                  <Stop offset="100%" stopColor="#080B0F" stopOpacity={1} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={100} height={100} fill="url(#stage-floor)" />
            </Svg>
          </View>

          {/* 320° Sweep ThreadRing */}
          <ThreadRing
            size={STAGE_SIZE}
            stroke={5.5}
            value={strengthPct}
            reduceMotionEnabled={reduceMotionEnabled}
          />

          {/* Center Circular Medallion Coin (inset 34) */}
          <View
            style={[
              styles.medallionWrap,
              { width: MEDALLION_GLOW_SIZE, height: MEDALLION_GLOW_SIZE },
            ]}
          >
            {showGlowRingPulse ? (
              <SelectedChipGlowRing
                size={MEDALLION_GLOW_SIZE}
                ringRadius={MEDALLION_RING_RADIUS}
                color={colors.anchor15.giltBright}
                reduceMotionEnabled={reduceMotionEnabled}
                intensity={strengthPct / 100}
              />
            ) : null}
            {showStaticGlowRing ? (
              <BakedGlow
                size={MEDALLION_GLOW_SIZE}
                color={colors.anchor15.giltBright}
                baseOpacity={0.5 * Math.max(strengthPct / 100, 0.25)}
                peakOpacity={0.5 * Math.max(strengthPct / 100, 0.25)}
                reduceMotionEnabled
              />
            ) : null}
            <MedallionCoin
              size={MEDALLION_SIZE}
              imageUrl={imageUrl}
              sigilXml={sigilSvg}
              reduceMotionEnabled={reduceMotionEnabled}
              performanceTier={performanceTier}
              strength={strengthPct}
            />
          </View>
        </View>

        {/* ── Thread Strength Read-out ── */}
        <View style={styles.textInfo}>
          <Text style={styles.stateBadge}>{badgeLabel}</Text>
          <CountUp value={strengthPct} reduceMotion={reduceMotionEnabled} />
          <Text style={styles.strengthEyebrow}>THREAD STRENGTH</Text>
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
    width: '100%',
  },
  stageOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stageFloor: {
    position: 'absolute',
    overflow: 'hidden',
  },
  medallionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  textInfo: {
    marginTop: 4,
    alignItems: 'center',
    width: '100%',
  },
  stateBadge: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 2.34,
    color: colors.anchor15.giltBright,
    marginBottom: 4,
  },
  strengthNumber: {
    fontFamily: 'Inter-Light',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.68,
    color: colors.anchor15.gilt,
  },
  strengthEyebrow: {
    marginTop: 6,
    fontFamily: 'Cinzel-Regular',
    fontSize: 9.5,
    letterSpacing: 2.09,
    textTransform: 'uppercase',
    color: withAlpha(colors.anchor15.gilt, 0.55),
  },
  anchorTitle: {
    marginTop: 26,
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 22,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.anchor15.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  anchorCategory: {
    marginTop: 8,
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.anchor15.ash,
  },
});
