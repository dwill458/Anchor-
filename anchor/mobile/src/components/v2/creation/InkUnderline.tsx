import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/v2';

const HEIGHT = 9;

/**
 * The creation flow's single handmade gesture: a short, slightly imperfect ink underline.
 * The path is built from the measured width (not scaled) so the stroke never distorts.
 * Decorative only — hidden from accessibility.
 */
export function InkUnderline({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  const d = width
    ? `M1.5 5.4 C${(width * 0.18).toFixed(1)} 3.2 ${(width * 0.4).toFixed(1)} 6.6 ${(width * 0.62).toFixed(1)} 4.6 S${(width * 0.9).toFixed(1)} 3.8 ${(width - 1.5).toFixed(1)} 5.8`
    : '';

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      {children}
      {width ? (
        <View style={styles.rule} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={width} height={HEIGHT}>
            <Path d={d} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  rule: { position: 'absolute', left: 0, bottom: -5 },
});
