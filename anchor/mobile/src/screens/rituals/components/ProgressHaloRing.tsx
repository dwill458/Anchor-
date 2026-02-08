import React from 'react';
import {
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressHaloRingProps {
  radius: number;
  strokeWidth: number;
  circumference: number;
  progressDashoffset: any;
  progressOpacity?: any;
  showSeal?: boolean;
  sealDashoffset?: number;
}

export const ProgressHaloRing: React.FC<ProgressHaloRingProps> = ({
  radius,
  strokeWidth,
  circumference,
  progressDashoffset,
  progressOpacity = 1,
  showSeal = false,
  sealDashoffset,
}) => {
  const size = radius * 2 + strokeWidth * 4;
  const center = radius + strokeWidth * 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}> 
      <View
        style={[
          styles.halo,
          {
            width: size * 0.76,
            height: size * 0.76,
            borderRadius: (size * 0.76) / 2,
          },
        ]}
      />

      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`${colors.gold}26`}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {showSeal && sealDashoffset !== undefined ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.bronze}
            strokeWidth={strokeWidth + 2}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={sealDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${center}, ${center}`}
          />
        ) : null}

        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.gold}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progressDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
          opacity={progressOpacity}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  halo: {
    position: 'absolute',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 8,
    borderWidth: 1,
    borderColor: `${colors.gold}14`,
    backgroundColor: `${colors.gold}06`,
  },
});
