/**
 * Anchor App - Settings Icon
 *
 * Premium settings icon with gear + sliders design
 * Matches Zen Architect theme with soft gold and subtle glow
 * Based on reference design with depth and gradient shading
 */

import React from 'react';
import Svg, { Path, Circle, Rect, G, Defs, RadialGradient, LinearGradient, Stop } from 'react-native-svg';
import { ViewStyle } from 'react-native';

interface SettingsIconProps {
  size?: number;
  color?: string;
  glow?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const SettingsIcon: React.FC<SettingsIconProps> = ({
  size = 28,
  color = '#D4AF37', // Gold
  glow = true,
  style,
  testID,
}) => {
  const baseGold = '#B8941F'; // Darker gold
  const midGold = '#D4AF37'; // Standard gold
  const lightGold = '#E8C76F'; // Light gold highlight

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={style}
      testID={testID}
    >
      <Defs>
        {/* Outer glow */}
        {glow && (
          <RadialGradient
            id="outerGlow"
            cx="16"
            cy="16"
            r="16"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={midGold} stopOpacity="0.4" />
            <Stop offset="0.5" stopColor={midGold} stopOpacity="0.2" />
            <Stop offset="1" stopColor={midGold} stopOpacity="0" />
          </RadialGradient>
        )}

        {/* Gear gradient - gives depth */}
        <LinearGradient
          id="gearGradient"
          x1="16"
          y1="4"
          x2="16"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={lightGold} />
          <Stop offset="0.5" stopColor={midGold} />
          <Stop offset="1" stopColor={baseGold} />
        </LinearGradient>
      </Defs>

      {/* Outer glow layer */}
      {glow && (
        <Circle cx="16" cy="16" r="15" fill="url(#outerGlow)" />
      )}

      {/* Gear with 8 substantial teeth */}
      <G>
        {/* Gear teeth - positioned around a circle */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => {
          const rad = (angle * Math.PI) / 180;
          const distance = 9.5; // Distance from center to tooth
          const cx = 16 + Math.cos(rad) * distance;
          const cy = 16 + Math.sin(rad) * distance;

          // Create rectangular tooth rotated to face outward
          const toothWidth = 3.5;
          const toothHeight = 3;

          return (
            <G key={index}>
              <Rect
                x={cx - toothWidth / 2}
                y={cy - toothHeight / 2}
                width={toothWidth}
                height={toothHeight}
                rx={0.5}
                fill="url(#gearGradient)"
                stroke={baseGold}
                strokeWidth={0.5}
                rotation={angle}
                origin={`${cx}, ${cy}`}
              />
            </G>
          );
        })}

        {/* Main gear circle with gradient */}
        <Circle
          cx="16"
          cy="16"
          r="7.5"
          fill="transparent"
          stroke="url(#gearGradient)"
          strokeWidth={1.2}
        />

        {/* Sliders inside gear - 3 vertical controls */}

        {/* Left slider - shortest */}
        <G opacity="1">
          {/* Slider track */}
          <Rect
            x={11 - 0.6}
            y={13}
            width={1.2}
            height={6}
            rx={0.6}
            fill={midGold}
            opacity={0.4}
          />
          {/* Slider knob */}
          <Circle
            cx={11}
            cy={15}
            r={1.8}
            fill={lightGold}
            stroke={midGold}
            strokeWidth={0.8}
          />
          <Circle
            cx={11}
            cy={15}
            r={1}
            fill={baseGold}
          />
        </G>

        {/* Center slider - longest */}
        <G opacity="1">
          {/* Slider track */}
          <Rect
            x={16 - 0.6}
            y={11}
            width={1.2}
            height={10}
            rx={0.6}
            fill={midGold}
            opacity={0.4}
          />
          {/* Slider knob */}
          <Circle
            cx={16}
            cy={17.5}
            r={1.8}
            fill={lightGold}
            stroke={midGold}
            strokeWidth={0.8}
          />
          <Circle
            cx={16}
            cy={17.5}
            r={1}
            fill={baseGold}
          />
        </G>

        {/* Right slider - medium */}
        <G opacity="1">
          {/* Slider track */}
          <Rect
            x={21 - 0.6}
            y={12}
            width={1.2}
            height={8}
            rx={0.6}
            fill={midGold}
            opacity={0.4}
          />
          {/* Slider knob */}
          <Circle
            cx={21}
            cy={16}
            r={1.8}
            fill={lightGold}
            stroke={midGold}
            strokeWidth={0.8}
          />
          <Circle
            cx={21}
            cy={16}
            r={1}
            fill={baseGold}
          />
        </G>
      </G>
    </Svg>
  );
};
