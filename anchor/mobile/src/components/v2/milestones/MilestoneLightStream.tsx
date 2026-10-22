import React from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const STREAMS = [
  'M 18 250 C 64 152 259 255 260 136 C 262 49 39 74 56 153 C 70 212 253 171 237 106',
  'M 28 258 C 70 166 273 207 249 113 C 224 30 41 96 63 163 C 85 220 266 149 227 94',
  'M 39 250 C 122 219 282 158 239 91 C 198 29 44 114 78 179 C 111 230 257 135 216 82',
];
/** Three hairlines at 60% opacity; finite travel, no particles, loops, blur or JS frame callbacks. */
export function MilestoneLightStream({ progress, source, target, width = 300, height = 300 }: { progress: SharedValue<number>; source?: { x: number; y: number }; target?: { x: number; y: number }; width?: number; height?: number }) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: 1100 * (1 - progress.value),
    opacity: Math.sin(Math.PI * progress.value) * 0.6,
  }));
  const paths = source && target ? [0, 1, 2].map(i => `M ${source.x} ${source.y} C ${source.x + 35 + i * 12} ${source.y - 65} ${target.x - 150} ${target.y + 130} ${target.x - 105} ${target.y} C ${target.x - 100} ${target.y - 150} ${target.x + 145} ${target.y - 105} ${target.x + 104} ${target.y + 35} C ${target.x + 50} ${target.y + 115} ${target.x - 125} ${target.y + 45} ${target.x - 80} ${target.y - 58}`) : STREAMS;
  return <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} pointerEvents="none" testID="milestone-light-stream">
    {paths.map((d, i) => <AnimatedPath key={d} d={d} fill="none" stroke={i === 1 ? '#FFF0BC' : '#CDA14D'}
      strokeWidth={i === 1 ? 0.9 : 0.55} strokeDasharray={[140, 1100]} animatedProps={props} />)}
  </Svg>;
}
