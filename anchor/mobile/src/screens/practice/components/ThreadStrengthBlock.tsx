import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BlurMask, Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Anchor } from '@/types';
import { OptimizedImage } from '@/components/common';
import { typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

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

interface ThreadStrengthRingProps {
  color: string;
  state: ThreadState;
  strength: number;
  reduceMotionEnabled: boolean;
}

/**
 * GPU-rendered progress ring. The trim is a Reanimated shared value, so value
 * changes stay off the JS thread. Reduced Motion draws the final trim without
 * timing animation while preserving the same visual state.
 */
const ThreadStrengthRing: React.FC<ThreadStrengthRingProps> = ({
  color,
  state,
  strength,
  reduceMotionEnabled,
}) => {
  const progress = useSharedValue(reduceMotionEnabled ? strength / 100 : 0);
  const ringPath = useMemo(() => {
    const inset = 13;
    const diameter = GLOW_SIZE - inset * 2;
    const path = Skia.Path.Make();
    // Start at 12 o'clock so the trim reads as a familiar progress indicator.
    path.addArc(Skia.XYWHRect(inset, inset, diameter, diameter), -90, 360);
    return path;
  }, []);

  useEffect(() => {
    const target = strength / 100;
    progress.value = reduceMotionEnabled
      ? target
      : withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotionEnabled, strength]);

  const showGlow = state !== 'fading' && strength > 0;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        path={ringPath}
        color="#1e2330"
        style="stroke"
        strokeWidth={1.5}
      />
      {showGlow ? (
        <Path
          path={ringPath}
          color={color}
          end={progress}
          style="stroke"
          strokeCap="round"
          strokeWidth={4.5}
          opacity={0.48}
        >
          <BlurMask blur={5} style="normal" />
        </Path>
      ) : null}
      <Path
        path={ringPath}
        color={color}
        end={progress}
        style="stroke"
        strokeCap="round"
        strokeWidth={1.8}
      />
    </Canvas>
  );
};

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

  return (
    <View
      style={[
        styles.block,
        { backgroundColor: c.blockBg, borderColor: c.blockBorder },
      ]}
    >
      {/* Top row: sigil ring + session count */}
      <View style={styles.topRow}>
        {/* The canvas owns the ring; the foreground stays native for image/SVG parity. */}
        <View
          accessible
          accessibilityLabel={`Thread strength ${Math.round(clampedStrength)} percent`}
          style={styles.sigilRingWrap}
        >
          <ThreadStrengthRing
            color={c.ring}
            reduceMotionEnabled={reduceMotionEnabled}
            state={state}
            strength={clampedStrength}
          />
          <View
            style={[
              styles.sigilRing,
              {
                borderColor: 'transparent',
                shadowOpacity: 0,
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


      <WeekTrack weekHistory={weekHistory} state={state} />

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
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1e2330',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
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
