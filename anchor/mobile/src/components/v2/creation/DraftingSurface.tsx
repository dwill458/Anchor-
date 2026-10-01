import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/v2';

// A fixed printed stipple. No filters, random frames, masks or animated grain.
const stipple = Array.from({ length: 240 }, (_, i) => {
  const x = (i * 37.17) % 100;
  const y = (i * 61.73) % 100;
  return `M${x.toFixed(2)} ${y.toFixed(2)}h0.12`;
}).join(' ');

export const DraftingSurface = memo(function DraftingSurface() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" opacity={0.045}>
        <Path d={stipple} stroke={colors.text.primary} strokeWidth={0.1} />
        <Path d={stipple} transform="translate(0.2 0.15)" stroke={colors.paper} strokeWidth={0.1} />
      </Svg>
    </View>
  );
});
