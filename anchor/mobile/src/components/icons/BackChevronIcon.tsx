/**
 * Back Chevron Icon - thin architectural line glyph for Top Bar back controls.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface BackChevronIconProps {
  size?: number;
  color?: string;
}

export const BackChevronIcon: React.FC<BackChevronIconProps> = ({
  size = 16,
  color = '#F4EFE6',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 5l-7 7 7 7"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
