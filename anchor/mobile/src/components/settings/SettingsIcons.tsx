import React from 'react';
import Svg, { Circle, Line, Path, Rect, SvgProps } from 'react-native-svg';
import { T } from './settingsTheme';

interface IconProps extends SvgProps {
  size?: number;
  color?: string;
}

export const IconBack: React.FC<IconProps> = ({ size = 22, color = T.ink, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Path
      d="M13.5 4.5 7 11l6.5 6.5"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconChevron: React.FC<IconProps> = ({ size = 12, color = T.ink3, ...props }) => (
  <Svg width={(size * 7) / 12} height={size} viewBox="0 0 7 12" fill="none" {...props}>
    <Path
      d="M1 1l5 5-5 5"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconPencil: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Path
      d="M14.8 4.4 17.6 7.2 8.4 16.4 4.6 17.4 5.6 13.6 14.8 4.4Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path d="M13 6.2l2.8 2.8" stroke={color} strokeWidth={1.5} />
  </Svg>
);

export const IconBadge: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={1.5} />
    <Path
      d="M7.4 11.2l2.3 2.3 4.6-4.8"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconTarget: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Circle cx={11} cy={11} r={8.2} stroke={color} strokeWidth={1.5} opacity={0.55} />
    <Circle cx={11} cy={11} r={4.8} stroke={color} strokeWidth={1.5} opacity={0.85} />
    <Circle cx={11} cy={11} r={1.5} fill={color} />
  </Svg>
);

export const IconBell: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Path
      d="M11 3.6c2.4 0 4.3 2 4.3 4.4v2.9c0 1.1.4 2.1 1.2 2.9l.4.4H5.1l.4-.4c.8-.8 1.2-1.8 1.2-2.9V8c0-2.4 1.9-4.4 4.3-4.4Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <Path
      d="M8.7 16.6a2.3 2.3 0 0 0 4.6 0"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

export const IconSliders: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Line x1={4} y1={6.5} x2={18} y2={6.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={13.5} cy={6.5} r={2} fill={color} />
    <Line x1={4} y1={11} x2={18} y2={11} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={8} cy={11} r={2} fill={color} />
    <Line x1={4} y1={15.5} x2={18} y2={15.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={15} cy={15.5} r={2} fill={color} />
  </Svg>
);

export const IconLock: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Rect x={5.2} y={10} width={11.6} height={8.4} rx={2} stroke={color} strokeWidth={1.5} />
    <Path
      d="M7.6 10V7.6a3.4 3.4 0 0 1 6.8 0V10"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

export const IconShield: React.FC<IconProps> = ({ size = 20, color = T.ink2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Path
      d="M11 3.4 16.8 5.8v5.1c0 3.8-2.7 6.3-5.8 7.5-3.1-1.2-5.8-3.7-5.8-7.5V5.8L11 3.4Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconDev: React.FC<IconProps> = ({ size = 20, color = T.devGreen, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" {...props}>
    <Rect x={4} y={5} width={14} height={12} rx={2} stroke={color} strokeWidth={1.5} />
    <Path
      d="M8 9.5 10 11l-2 1.5M12 13h3"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
