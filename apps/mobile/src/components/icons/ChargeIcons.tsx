/**
 * Charge Mode Icons
 *
 * Custom SVG icons for Focus Charge and Ritual Charge modes.
 * Designed to fit the Zen Architect aesthetic with elegant line work.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { colors } from '@/theme';

export interface ChargeIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * FocusChargeIcon - Lightning bolt with meditation aesthetic
 *
 * Represents focused, rapid charge energy.
 * Simplified geometric design, single stroke.
 */
export const FocusChargeIcon: React.FC<ChargeIconProps> = ({
  size = 48,
  color = colors.bone,
  accentColor = colors.gold,
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
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
      >
        {/* Outer circle */}
        <Circle
          cx="32"
          cy="32"
          r="30"
          stroke={color}
          strokeWidth="1.5"
          opacity={0.3}
        />

        {/* Lightning bolt - geometric design */}
        {/* Top left diagonal */}
        <Path
          d="M 32 8 L 40 22 L 28 22 L 40 44 L 20 32 L 28 32 L 20 8 Z"
          fill={accentColor}
          opacity={0.8}
        />

        {/* Highlight accent on left side */}
        <Path
          d="M 28 22 L 24 32 L 28 32"
          stroke={color}
          strokeWidth="0.75"
          opacity={0.4}
        />
      </Svg>
    </View>
  );
};

/**
 * RitualChargeIcon - Flame with ceremonial aesthetic
 *
 * Represents immersive, multi-phase ritual energy.
 * Organic flowing lines suggesting flame movement.
 */
export const RitualChargeIcon: React.FC<ChargeIconProps> = ({
  size = 48,
  color = colors.bone,
  accentColor = colors.gold,
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
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
      >
        {/* Outer circle */}
        <Circle
          cx="32"
          cy="32"
          r="30"
          stroke={color}
          strokeWidth="1.5"
          opacity={0.3}
        />

        {/* Flame - flowing curves */}
        {/* Base of flame */}
        <Path
          d="M 26 52 Q 22 48 22 42 Q 22 30 32 16 Q 42 30 42 42 Q 42 48 38 52"
          fill={accentColor}
          opacity={0.8}
        />

        {/* Inner flame detail - lighter section */}
        <Path
          d="M 28 50 Q 26 46 26 42 Q 26 35 32 28 Q 38 35 38 42 Q 38 46 36 50"
          fill={color}
          opacity={0.2}
        />

        {/* Flame flicker lines on left side */}
        <Path
          d="M 24 40 Q 20 35 20 28"
          stroke={accentColor}
          strokeWidth="0.75"
          opacity={0.5}
          strokeLinecap="round"
        />

        {/* Flame flicker lines on right side */}
        <Path
          d="M 40 40 Q 44 35 44 28"
          stroke={accentColor}
          strokeWidth="0.75"
          opacity={0.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

/**
 * DurationIcon - Hourglass for time/duration context
 *
 * Used to indicate duration selection state or custom timer mode.
 */
export const DurationIcon: React.FC<ChargeIconProps> = ({
  size = 32,
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
      <Svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
      >
        {/* Top bulb */}
        <Path
          d="M 8 4 L 8 10 Q 8 14 16 14 Q 24 14 24 10 L 24 4 Z"
          stroke={color}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Middle section */}
        <Line x1="13" y1="14" x2="19" y2="18" stroke={color} strokeWidth="1" />

        {/* Bottom bulb */}
        <Path
          d="M 24 18 Q 24 22 16 22 Q 8 22 8 18 L 8 28 L 24 28 Z"
          stroke={color}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

/**
 * BreathingIcon - Concentric circles suggesting breathing rhythm
 *
 * Used for breathing animation or meditation-related UI.
 */
export const BreathingIcon: React.FC<ChargeIconProps> = ({
  size = 48,
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
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
      >
        {/* Outer circle */}
        <Circle cx="32" cy="32" r="28" stroke={color} strokeWidth="1" opacity={0.3} />

        {/* Middle circle */}
        <Circle cx="32" cy="32" r="20" stroke={color} strokeWidth="1" opacity={0.5} />

        {/* Inner circle */}
        <Circle cx="32" cy="32" r="12" stroke={color} strokeWidth="1.5" opacity={0.8} />

        {/* Center dot */}
        <Circle cx="32" cy="32" r="3" fill={color} opacity={0.8} />
      </Svg>
    </View>
  );
};
