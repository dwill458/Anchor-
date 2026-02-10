import React from 'react';
import { Animated, Easing } from 'react-native';
import { Svg, Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';

interface SacredRingProps {
    size: number;
}

export const SacredRing: React.FC<SacredRingProps> = ({ size }) => (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Circle cx="50" cy="50" r="45" stroke={colors.gold} strokeWidth="0.5" strokeOpacity="0.4" />
        <Circle cx="50" cy="50" r="35" stroke={colors.gold} strokeWidth="0.3" strokeOpacity="0.2" />
        <Path
            d="M50 5L63 38L95 50L63 62L50 95L37 62L5 50L37 38L50 5Z"
            stroke={colors.gold}
            strokeWidth="0.5"
            strokeOpacity="0.3"
        />
        <Path
            d="M20 20L80 80M80 20L20 80"
            stroke={colors.gold}
            strokeWidth="0.2"
            strokeOpacity="0.1"
        />
    </Svg>
);
