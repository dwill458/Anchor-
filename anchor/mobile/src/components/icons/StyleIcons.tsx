import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

interface StyleIconProps {
    size?: number;
}

export const MinimalLineIcon: React.FC<StyleIconProps> = ({ size = 48 }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Path
            d="M12 36L21 18L28 27L36 10"
            stroke="#F5F5DC"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

export const InkBrushIcon: React.FC<StyleIconProps> = ({ size = 48 }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Path
            d="M10 34C14 28 20 16 24 12C27 9 32 10 35 14C37 17 36 22 32 26"
            stroke="#F5F5DC"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Circle cx="35" cy="31" r="3" fill="#D4AF37" />
    </Svg>
);

export const SacredGeometryIcon: React.FC<StyleIconProps> = ({ size = 48 }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Circle cx="24" cy="24" r="14" stroke="#F5F5DC" strokeWidth="2.25" />
        <Path
            d="M24 10L31 17M31 17L38 24M31 17L24 24M24 24L17 31M17 31L10 38M17 31L24 38"
            stroke="#F5F5DC"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Circle cx="24" cy="24" r="3.6" fill="#D4AF37" />
    </Svg>
);

export const WatercolorIcon: React.FC<StyleIconProps> = ({ size = 48 }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Path
            d="M24 12C20 12 20 16 22 20C23 22 25 22 26 20C28 16 28 12 24 12Z"
            stroke="#F5F5DC"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Ellipse cx="23.6" cy="31" rx="12" ry="11" stroke="#F5F5DC" strokeWidth="2.25" />
        <Ellipse cx="24.6" cy="32" rx="7.6" ry="7" stroke="#F5F5DC" strokeWidth="2.25" />
        <Circle cx="24" cy="31" r="3" fill="#D4AF37" />
    </Svg>
);

export const GoldLeafIcon: React.FC<StyleIconProps> = ({ size = 48 }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Path
            d="M12 30C16 34 22 36 26 32C30 28 32 20 28 14C24 8 16 10 12 16"
            stroke="#D4AF37"
            strokeWidth="2.25"
            strokeLinecap="round"
        />
        <Path
            d="M20 20L28 28M15 25L23 33"
            stroke="#F5F5DC"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </Svg>
);

export const CosmicIcon: React.FC<StyleIconProps> = ({ size = 48 }) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Circle cx="24" cy="24" r="18" stroke="#F5F5DC" strokeWidth="1" strokeDasharray="4 4" />
        <Circle cx="24" cy="24" r="8" stroke="#D4AF37" strokeWidth="2.25" />
        <Path
            d="M24 4V8M24 40V44M4 24H8M40 24H44"
            stroke="#F5F5DC"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        <Circle cx="36" cy="12" r="2" fill="#F5F5DC" />
        <Circle cx="12" cy="36" r="1.5" fill="#F5F5DC" />
    </Svg>
);
