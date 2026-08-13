/**
 * Close Icon - thin X glyph for Bottom Sheet dismiss controls.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface CloseIconProps {
  size?: number;
  color?: string;
}

export const CloseIcon: React.FC<CloseIconProps> = ({
  size = 12,
  color = 'rgba(244, 239, 230, 0.42)',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 4l16 16M20 4L4 20"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);
