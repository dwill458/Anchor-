/**
 * ThreadRing — 320° sweep circular progress ring with permanent 40° gap at 6 o'clock.
 *
 * Direct React Native port of the Sanctuary Home prototype ThreadRing.
 * Start angle: 110°, Max angle: 320° (sweep: 110° → 430°).
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';

export interface ThreadRingProps {
  size?: number;
  stroke?: number;
  value?: number; // 0 to 100
  reduceMotionEnabled?: boolean;
}

export const ThreadRing: React.FC<ThreadRingProps> = ({
  size = 244,
  stroke = 5,
  value = 0,
  reduceMotionEnabled = false,
}) => {
  const clampedTarget = Math.min(Math.max(value, 0), 100);
  // Driven by a plain rAF loop (not Reanimated's animated SVG props) — that
  // path is unreliable for strokeDashoffset on Android/Fabric with this
  // react-native-svg version, so we recompute the arc string in JS instead,
  // mirroring the count-up number's already-working approach.
  const [displayPct, setDisplayPct] = useState(reduceMotionEnabled ? clampedTarget : 0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      setDisplayPct(clampedTarget);
      return;
    }

    setDisplayPct(0);
    let start: number | undefined;
    let animId: number;
    const duration = 1100;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (start === undefined) start = timestamp;
      const t = Math.min((timestamp - start) / duration, 1);
      setDisplayPct(ease(t) * clampedTarget);
      if (t < 1) {
        animId = requestAnimationFrame(step);
      }
    };
    animId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animId);
  }, [clampedTarget, reduceMotionEnabled]);

  const R = (size - stroke) / 2;
  const c = size / 2;
  const START = 110;
  const MAX = 320;

  const pol = (d: number): [number, number] => [
    c + R * Math.cos((d * Math.PI) / 180),
    c + R * Math.sin((d * Math.PI) / 180),
  ];

  const buildArc = (len: number): string => {
    if (len <= 0) return '';
    const safeLen = Math.min(len, 359.99);
    const [x1, y1] = pol(START);
    const [x2, y2] = pol(START + safeLen);
    const largeArc = safeLen > 180 ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R.toFixed(2)} ${R.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const bgPath = buildArc(MAX);
  const activeLength = (displayPct / 100) * MAX;
  const activePath = buildArc(activeLength);

  return (
    <View style={[styles.container, { width: size, height: size }]} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <Path
          d={bgPath}
          fill="none"
          stroke={withAlpha(colors.anchor15.gilt, 0.12)}
          strokeWidth={1}
          strokeLinecap="round"
        />

        {/* Active progress arc — grows from the START angle toward the target */}
        {activeLength > 0 && (
          <Path
            d={activePath}
            fill="none"
            stroke={colors.anchor15.giltBright}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
