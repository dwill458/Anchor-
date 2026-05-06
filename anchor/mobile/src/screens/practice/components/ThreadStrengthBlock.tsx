import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { BakedGlow, OptimizedImage, RingGlowCanvas } from '@/components/common';
import { typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';

export type ThreadState = 'strong' | 'fading' | 'recover';

const THREAD_COLORS = {
  strong: {
    ring: '#D4AF37',
    glow: 'rgba(212,175,55,0.25)',
    num: '#D4AF37',
    bar: '#D4AF37',
    label: '#8a7020',
    msg: '#a08030',
    pip: '#D4AF37',
    blockBg: '#1a1f28',
    blockBorder: '#3a3010',
    msgBorder: '#2a2510',
  },
  fading: {
    ring: '#2a2a32',
    glow: 'transparent',
    num: '#3a3d50',
    bar: '#2e3040',
    label: '#2e3040',
    msg: '#2e3040',
    pip: '#3a3a48',
    blockBg: '#191920',
    blockBorder: '#2e2e3a',
    msgBorder: '#1a1a22',
  },
  recover: {
    ring: '#3a6040',
    glow: 'rgba(80,160,100,0.12)',
    num: '#4a8060',
    bar: '#4a8060',
    label: '#3a6048',
    msg: '#3a6048',
    pip: '#4a8060',
    blockBg: '#161a1f',
    blockBorder: '#2a3828',
    msgBorder: '#1a2820',
  },
} as const;

const THREAD_COPY: Record<ThreadState, string> = {
  strong: 'The symbol is becoming part of you.',
  fading: 'The symbol is waiting. Prime today to restore it.',
  recover: 'You came back. The thread holds.',
};

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const QA_FADING_WEEK_HISTORY = [true, true, true, true, true, false, false];

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getThreadState(threadStrength: number, lastPrimedAt: string | null): ThreadState {
  const primedToday = lastPrimedAt === localDateString(new Date());
  if (threadStrength >= 60) return 'strong';
  if (primedToday) return 'recover';
  return 'fading';
}

interface WeekTrackProps {
  weekHistory: boolean[];
  state: ThreadState;
}

const WeekTrack: React.FC<WeekTrackProps> = ({ weekHistory, state }) => {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  const c = THREAD_COLORS[state];

  return (
    <View style={wtStyles.row}>
      {DAYS.map((day, i) => {
        const isToday = i === todayIdx;
        const isFuture = i > todayIdx;
        const primed = weekHistory[i] ?? false;

        let bg = '#1e2330';
        let borderColor = '#2a2a38';
        let borderWidth = 1;
        let borderStyle: 'solid' | 'dashed' = 'solid';
        let opacity = 1;

        if (isToday) {
          bg = 'transparent';
          borderColor = primed ? c.pip : '#2a2a38';
          borderWidth = 1.5;
          borderStyle = primed ? 'solid' : 'dashed';
        } else if (isFuture) {
          opacity = 0.3;
        } else {
          // past day
          bg = primed ? c.pip : '#1e2330';
          borderColor = primed ? c.pip : '#2a2a38';
        }

        return (
          <View key={i} style={wtStyles.dayCol}>
            <Text style={[wtStyles.dayLabel, { color: c.label }]}>{day}</Text>
            <View
              style={[
                wtStyles.pip,
                { backgroundColor: bg, borderColor, borderWidth, borderStyle, opacity },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
};

const wtStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  dayLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pip: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});

// ─── Main block ───────────────────────────────────────────────────────────────

interface ThreadStrengthBlockProps {
  threadStrength: number;
  totalSessionsCount: number;
  lastPrimedAt: string | null;
  weekHistory: boolean[];
  anchor?: Anchor;
}

const RING_SIZE = 52;
const SIGIL_SIZE = 30;
const GLOW_SIZE = 76; // canvas overflows ring by 12px each side

export const ThreadStrengthBlock: React.FC<ThreadStrengthBlockProps> = ({
  threadStrength,
  totalSessionsCount,
  lastPrimedAt,
  weekHistory,
  anchor,
}) => {
  const state = getThreadState(threadStrength, lastPrimedAt);
  const c = THREAD_COLORS[state];
  const sigil = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg;
  const clampedStrength = Math.max(0, Math.min(100, threadStrength));
  const reduceMotionEnabled = useReduceMotionEnabled();
  const perfTier = useAppPerformanceTier();
  const glowIntensity = clampedStrength / 100;
  const showAnimatedGlow = perfTier === 'high' && !reduceMotionEnabled;
  const showStaticGlow = perfTier === 'medium' && state !== 'fading' && glowIntensity > 0.04;
  // Temporary QA fixture to validate the fading-state pip rendering before
  // re-connecting this view to the real week history.
  const renderedWeekHistory = state === 'fading'
    ? QA_FADING_WEEK_HISTORY
    : (weekHistory ?? QA_FADING_WEEK_HISTORY);

  return (
    <View
      style={[
        styles.block,
        { backgroundColor: c.blockBg, borderColor: c.blockBorder },
      ]}
    >
      {/* Top row: sigil ring + session count */}
      <View style={styles.topRow}>
        {/* Wrapper sized to GLOW_SIZE so the canvas overflows the ring evenly */}
        <View style={styles.sigilRingWrap}>
          {showAnimatedGlow ? (
            <RingGlowCanvas
              size={GLOW_SIZE}
              color={c.ring}
              intensity={glowIntensity}
              reduceMotionEnabled={reduceMotionEnabled}
              tier={perfTier}
            />
          ) : null}
          {showStaticGlow ? (
            <BakedGlow
              size={GLOW_SIZE}
              color={c.ring}
              baseOpacity={0.18 + glowIntensity * 0.08}
              peakOpacity={0.18 + glowIntensity * 0.08}
              reduceMotionEnabled={true}
            />
          ) : null}
          <View
            style={[
              styles.sigilRing,
              {
                borderColor: c.ring,
                shadowColor: c.glow !== 'transparent' ? c.ring : undefined,
                shadowOpacity: c.glow !== 'transparent' ? 1 : 0,
              },
            ]}
          >
            {anchor?.enhancedImageUrl ? (
              <OptimizedImage
                uri={anchor.enhancedImageUrl}
                style={styles.sigilImage}
                resizeMode="cover"
              />
            ) : sigil ? (
              <SvgXml xml={sigil} width={SIGIL_SIZE} height={SIGIL_SIZE} />
            ) : (
              <Text style={styles.sigilFallback}>◈</Text>
            )}
          </View>
        </View>

        <View style={styles.numsCol}>
          <Text style={[styles.totalCount, { color: c.num }]}>
            {totalSessionsCount}
          </Text>
          <Text style={[styles.totalLabel, { color: c.label }]}>Total sessions primed</Text>
        </View>
      </View>

      {/* Strength bar */}
      <View style={styles.barRow}>
        <Text style={[styles.barLabel, { color: c.label }]}>Thread strength</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${clampedStrength}%`, backgroundColor: c.bar },
            ]}
          />
        </View>
      </View>


      {/* Micro-copy */}
      <Text style={[styles.msg, { color: c.msg, borderTopColor: c.msgBorder }]}>
        {THREAD_COPY[state]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sigilRingWrap: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sigilRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,12,18,0.9)',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  sigilImage: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    borderRadius: SIGIL_SIZE / 2,
  },
  sigilFallback: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 18,
    color: '#555a6a',
  },
  numsCol: {
    flex: 1,
  },
  totalCount: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 32,
    lineHeight: 34,
  },
  totalLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e2330',
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  msg: {
    fontFamily: typography.fontFamily.sans,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
});
