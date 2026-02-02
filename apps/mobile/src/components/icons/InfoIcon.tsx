/**
 * Info Icon - Minimalist information glyph
 *
 * Used for info/help buttons in the interface.
 * Elegant circle with centered dot design.
 */

import React from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';

export interface InfoIconProps {
  size?: number;
  color?: string;
}

export const InfoIcon: React.FC<InfoIconProps> = ({
  size = 24,
  color = colors.gold,
}) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer circle */}
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Info dot at top */}
        <circle cx="12" cy="8" r="1.2" fill={color} />

        {/* Info line at bottom */}
        <line
          x1="12"
          y1="11"
          x2="12"
          y2="16"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </View>
  );
};
