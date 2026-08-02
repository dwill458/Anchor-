import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SPLASH_GOLD, SPLASH_LOGO_ASSET } from './splashAnimation.constants';

interface SplashLogoProps {
  size: number;
  logoStyle: any;
  glowStyle: any;
  haloStyle: any;
  pulseStyle: any;
  onLogoReady: () => void;
}

export const SplashLogo: React.FC<SplashLogoProps> = ({
  size,
  logoStyle,
  glowStyle,
  haloStyle,
  pulseStyle,
  onLogoReady,
}) => {
  const haloSize = size * 1.16;
  const pulseSize = size * 1.34;
  const glowSize = size * 0.48;

  return (
    <View style={[styles.container, { width: pulseSize, height: pulseSize }]} pointerEvents="none">
      <Animated.View
        testID="splash-pulse"
        style={[
          styles.pulse,
          { width: pulseSize, height: pulseSize, borderRadius: pulseSize / 2 },
          pulseStyle,
        ]}
      />
      <Animated.View
        testID="splash-halo"
        style={[
          styles.halo,
          { width: haloSize, height: haloSize, borderRadius: haloSize / 2 },
          haloStyle,
        ]}
      />
      <Animated.View
        testID="splash-central-glow"
        style={[styles.glow, { width: glowSize, height: glowSize }, glowStyle]}
      >
        <Svg width={glowSize} height={glowSize} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="splash-core-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFF4B0" stopOpacity={0.98} />
              <Stop offset="38%" stopColor={SPLASH_GOLD} stopOpacity={0.72} />
              <Stop offset="100%" stopColor={SPLASH_GOLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#splash-core-glow)" />
        </Svg>
      </Animated.View>
      <Animated.Image
        testID="splash-logo"
        source={SPLASH_LOGO_ASSET}
        resizeMode="contain"
        onLoad={onLogoReady}
        onError={onLogoReady}
        style={[styles.logo, { width: size, height: size }, logoStyle]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 999,
  },
  halo: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.36)',
  },
  pulse: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.26)',
  },
});
