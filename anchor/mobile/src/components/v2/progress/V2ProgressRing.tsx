import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { typography } from '@/theme/v2';
import { progressTokens } from './progressTokens';

/** 78% of the circle; the open gap sits at the bottom. */
export const RING_SWEEP_DEG = 280.8;
/** Clockwise from 3 o'clock, so the arc is centred on 12 o'clock. */
const RING_START_DEG = 129;
const RING_RADIUS = 62;
const RING_WEIGHT = 9;
/** A measured value never draws less than a stub, so a low number is still a visible thread. */
const MIN_FILL_DEG = 5;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Slow drift plus a small tremor: a fixed function of the angle, so the stroke never jitters. */
function wobble(deg: number): number {
  const a = rad(deg);
  return 0.62 * Math.sin(a * 5 + 0.6) + 0.38 * Math.sin(a * 13 + 2.1);
}

function weightAt(deg: number, weight: number): number {
  return weight * (0.84 + 0.3 * (0.5 + 0.5 * Math.sin(rad(deg) * 7 + 1.3)));
}

/**
 * A hand-drawn filled ribbon along an arc. Deterministic (no randomness) and
 * uniform enough to read as one stroke; round caps are drawn by the caller.
 */
export function buildHandDrawnArcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  sweepDeg: number,
  weight: number,
): string {
  if (!(sweepDeg > 0)) return '';
  const steps = Math.max(8, Math.ceil(sweepDeg / 3));
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const deg = startDeg + (sweepDeg * i) / steps;
    const r = radius + wobble(deg) * weight * 0.14;
    const half = weightAt(deg, weight) / 2;
    const cos = Math.cos(rad(deg));
    const sin = Math.sin(rad(deg));
    outer.push(`${(cx + (r + half) * cos).toFixed(2)} ${(cy + (r + half) * sin).toFixed(2)}`);
    inner.push(`${(cx + (r - half) * cos).toFixed(2)} ${(cy + (r - half) * sin).toFixed(2)}`);
  }
  return `M ${outer.join(' L ')} L ${inner.reverse().join(' L ')} Z`;
}

function arcPoint(cx: number, cy: number, radius: number, deg: number) {
  return { x: cx + radius * Math.cos(rad(deg)), y: cy + radius * Math.sin(rad(deg)) };
}

export interface V2ProgressRingProps {
  /** 0-100, or null while unmeasured. */
  value: number | null;
  size?: number;
  testID?: string;
}

/** The Thread Strength ring. No glow or aura: just the track, the drawn arc and the number. */
export const V2ProgressRing: React.FC<V2ProgressRingProps> = ({ value, size = 150, testID = 'v2-progress-ring' }) => {
  const measured = typeof value === 'number';
  const clamped = measured ? Math.min(100, Math.max(0, Math.round(value as number))) : 0;
  const c = 75;

  const { track, fill, startCap, endCap } = useMemo(() => {
    const trackStart = arcPoint(c, c, RING_RADIUS, RING_START_DEG);
    const trackEnd = arcPoint(c, c, RING_RADIUS, RING_START_DEG + RING_SWEEP_DEG);
    const fillSweep = measured ? Math.max(MIN_FILL_DEG, (RING_SWEEP_DEG * clamped) / 100) : 0;
    return {
      track: `M ${trackStart.x.toFixed(2)} ${trackStart.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 1 1 ${trackEnd.x.toFixed(2)} ${trackEnd.y.toFixed(2)}`,
      fill: buildHandDrawnArcPath(c, c, RING_RADIUS, RING_START_DEG, fillSweep, RING_WEIGHT),
      startCap: fillSweep > 0 ? arcPoint(c, c, RING_RADIUS, RING_START_DEG) : null,
      endCap: fillSweep > 0 ? arcPoint(c, c, RING_RADIUS, RING_START_DEG + fillSweep) : null,
    };
  }, [clamped, measured]);

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={measured ? `Thread Strength ${clamped} out of 100` : 'Thread Strength not established yet'}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 150 150">
        <Path
          d={track}
          fill="none"
          stroke={progressTokens.heroTrack}
          strokeWidth={RING_WEIGHT}
          strokeLinecap="round"
        />
        {fill ? <Path d={fill} fill={progressTokens.heroText} /> : null}
        {startCap ? <Circle cx={startCap.x} cy={startCap.y} r={RING_WEIGHT / 2.2} fill={progressTokens.heroText} /> : null}
        {endCap ? <Circle cx={endCap.x} cy={endCap.y} r={RING_WEIGHT / 2.2} fill={progressTokens.heroText} /> : null}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.number, !measured && styles.numberDim]}>{measured ? clamped : '—'}</Text>
        <Text style={styles.label}>{'THREAD\nSTRENGTH'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  number: {
    fontFamily: progressTokens.serif,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.9,
    color: progressTokens.heroText,
  },
  numberDim: { opacity: 0.35 },
  label: {
    ...typography.labelSM,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: progressTokens.heroMuted,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
