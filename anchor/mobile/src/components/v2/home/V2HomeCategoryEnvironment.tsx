import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AnchorMotion } from '@/theme/v2';
import { HOME_CATEGORY_ART } from './homeCategoryArt';

type Props = { category?: string | null; reduceMotion?: boolean };

function EnvironmentLayer({ name, source, active, reduceMotion }: {
  name: string;
  source: ImageSourcePropType;
  active: boolean;
  reduceMotion: boolean;
}) {
  const opacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : AnchorMotion.duration.quick;
    opacity.value = withTiming(active ? 1 : 0, { duration });
  }, [active, opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View testID={`v2-home-environment-${name}`} style={[styles.layer, animatedStyle]}>
    <View style={styles.imageFrame}>
      <Image source={source} style={styles.image} resizeMode="contain" fadeDuration={0} />
      <LinearGradient colors={['#F4F1E9', 'rgba(244,241,233,0)']} style={styles.topFade} />
    </View>
  </Animated.View>;
}

/** All bundled environments stay mounted so repeated switches avoid loading frames. */
function V2HomeCategoryEnvironmentComponent({ category, reduceMotion = false }: Props) {
  const active = category?.trim().toLowerCase();

  return (
    <View style={styles.environment} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Object.entries(HOME_CATEGORY_ART).map(([name, source]) => <EnvironmentLayer
        key={name} name={name} source={source} active={active === name} reduceMotion={reduceMotion}
      />)}
    </View>
  );
}

const styles = StyleSheet.create({
  environment: {
    ...StyleSheet.absoluteFillObject,
    top: 30,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFrame: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    aspectRatio: 1.5,
  },
  image: { width: '100%', height: '100%', opacity: 0.8 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 32 },
});

export const V2HomeCategoryEnvironment = memo(V2HomeCategoryEnvironmentComponent);
