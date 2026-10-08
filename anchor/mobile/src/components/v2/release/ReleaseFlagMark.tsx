import React from 'react';
import { Path, Svg } from 'react-native-svg';
import { RELEASE_FLAG_GOLD } from '@/constants/v2/release';

interface Props {
  size?: number;
}

/** The summit flag: a plain pole and a pennant, drawn in the destination gold. Decorative only. */
export function ReleaseFlagMark({ size = 132 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 132 132">
      <Path d="M42 22 V112" stroke={RELEASE_FLAG_GOLD} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M46 24 L104 44 L46 64 Z" fill={RELEASE_FLAG_GOLD} />
    </Svg>
  );
}
