import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface LockIconProps {
    size?: number;
    color?: string;
}

export const LockIcon: React.FC<LockIconProps> = ({
    size = 20,
    color = '#D4AF37'
}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect
            x="5"
            y="11"
            width="14"
            height="10"
            rx="2"
            stroke={color}
            strokeWidth="2.25"
            strokeLinecap="round"
        />
        <Path
            d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11"
            stroke={color}
            strokeWidth="2.25"
            strokeLinecap="round"
        />
        <Circle cx="12" cy="15.5" r="1.5" fill={color} />
    </Svg>
);
