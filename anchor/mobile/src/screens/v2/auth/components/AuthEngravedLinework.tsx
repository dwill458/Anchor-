import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

type Props = {
  width: number;
  height?: number;
};

/**
 * Restrained engraved celestial/orbital linework at the bottom of the dark auth surface,
 * following the approved Anchor 2.0 visual language.
 */
export function AuthEngravedLinework({ width, height = 160 }: Props) {
  const cx = width / 2;
  const cy = height + 40;

  return (
    <View pointerEvents="none" style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="goldLineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D4AF37" stopOpacity="0.09" />
            <Stop offset="0.6" stopColor="#D4AF37" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#D4AF37" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Concentric orbital/compass arcs */}
        <Circle cx={cx} cy={cy} r={190} stroke="url(#goldLineGrad)" strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cy} r={140} stroke="url(#goldLineGrad)" strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cy} r={95} stroke="url(#goldLineGrad)" strokeWidth={0.75} fill="none" />
        <Circle cx={cx} cy={cy} r={55} stroke="url(#goldLineGrad)" strokeWidth={0.75} fill="none" />

        {/* Subtle radial alignment rays */}
        <Path
          d={`M ${cx - 160} ${cy - 100} L ${cx - 70} ${cy - 45}`}
          stroke="url(#goldLineGrad)"
          strokeWidth={0.75}
        />
        <Path
          d={`M ${cx + 160} ${cy - 100} L ${cx + 70} ${cy - 45}`}
          stroke="url(#goldLineGrad)"
          strokeWidth={0.75}
        />
        <Path
          d={`M ${cx} ${cy - 190} L ${cx} ${cy - 140}`}
          stroke="url(#goldLineGrad)"
          strokeWidth={0.75}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
