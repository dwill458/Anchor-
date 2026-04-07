import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme';

type SettingsRevealOverlayProps = {
  visible: boolean;
  progress: SharedValue<number>;
  overlayOpacity: SharedValue<number>;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  diameter: SharedValue<number>;
  startScale: SharedValue<number>;
};

export const SettingsRevealOverlay: React.FC<SettingsRevealOverlayProps> = ({
  visible,
  progress,
  overlayOpacity,
  originX,
  originY,
  diameter,
  startScale,
}) => {
  const containerStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.32]),
  }));

  const circleStyle = useAnimatedStyle(() => {
    const revealDiameter = diameter.value;
    const left = originX.value - revealDiameter / 2;
    const top = originY.value - revealDiameter / 2;

    return {
      left,
      top,
      width: revealDiameter,
      height: revealDiameter,
      borderRadius: revealDiameter / 2,
      transform: [
        {
          scale: interpolate(progress.value, [0, 1], [startScale.value, 1]),
        },
      ],
    };
  });

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="auto"
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
      style={[styles.container, containerStyle]}
    >
      <Animated.View style={[styles.dim, dimStyle]} />
      <Animated.View style={[styles.circle, circleStyle]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  circle: {
    position: 'absolute',
    backgroundColor: colors.background.primary,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 0,
      },
    }),
  },
});
