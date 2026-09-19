import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/v2';

export const V2_HOME_SPLICE_HEIGHT = 72;
/** Where the keel point sits horizontally: exactly the centre axis. */
export const V2_HOME_SPLICE_KEEL_RATIO = 0.5;

/**
 * Splice geometry as ratios of the real width.
 *
 * Authored from the approved 393pt reference but expressed proportionally, so
 * the keel keeps its true curvature on a 360pt phone and a 430pt phone alike
 * rather than being stretched from a fixed path. The point always lands on the
 * centre axis and the height is constant, so the transition reads identically
 * at every device width. The two halves are exact mirrors.
 */
const SPLICE_SHOULDER_X = 0.5725;
const SPLICE_SWEEP_C1_X = 0.8092;
const SPLICE_SWEEP_C2_X = 0.6641;
const SPLICE_THROAT_C1_X = 0.5267;
const SPLICE_THROAT_C2_X = 0.5076;
const SPLICE_SWEEP_C1_Y = 0.1389;
const SPLICE_SWEEP_C2_Y = 0.3056;
const SPLICE_SHOULDER_Y = 0.5;
const SPLICE_THROAT_C1_Y = 0.5972;
const SPLICE_THROAT_C2_Y = 0.75;
const SPLICE_TIP_Y = 0.9722;

export function buildSplicePath(width: number, height: number = V2_HOME_SPLICE_HEIGHT): string {
  const w = Math.max(1, width);
  const x = (ratio: number) => +(w * ratio).toFixed(2);
  const y = (ratio: number) => +(height * ratio).toFixed(2);
  const mirror = (ratio: number) => x(1 - ratio);

  return [
    'M 0 -2',
    'L ' + x(1) + ' -2',
    'L ' + x(1) + ' 0',
    // Right edge sweeping inward to the shoulder.
    'C ' + x(SPLICE_SWEEP_C1_X) + ' ' + y(SPLICE_SWEEP_C1_Y) + ', ' + x(SPLICE_SWEEP_C2_X) + ' ' + y(SPLICE_SWEEP_C2_Y) + ', ' + x(SPLICE_SHOULDER_X) + ' ' + y(SPLICE_SHOULDER_Y),
    // Shoulder narrowing into the single keel point on the centre axis.
    'C ' + x(SPLICE_THROAT_C1_X) + ' ' + y(SPLICE_THROAT_C1_Y) + ', ' + x(SPLICE_THROAT_C2_X) + ' ' + y(SPLICE_THROAT_C2_Y) + ', ' + x(V2_HOME_SPLICE_KEEL_RATIO) + ' ' + y(SPLICE_TIP_Y),
    // Mirrored back out to the left shoulder.
    'C ' + mirror(SPLICE_THROAT_C2_X) + ' ' + y(SPLICE_THROAT_C2_Y) + ', ' + mirror(SPLICE_THROAT_C1_X) + ' ' + y(SPLICE_THROAT_C1_Y) + ', ' + mirror(SPLICE_SHOULDER_X) + ' ' + y(SPLICE_SHOULDER_Y),
    'C ' + mirror(SPLICE_SWEEP_C2_X) + ' ' + y(SPLICE_SWEEP_C2_Y) + ', ' + mirror(SPLICE_SWEEP_C1_X) + ' ' + y(SPLICE_SWEEP_C1_Y) + ', 0 0',
    'Z',
  ].join(' ');
}

const MARK_SIZE = 26;

function AnchorBrandMark() {
  return (
    <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 32 32" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 2.5L5.5 19H26.5L16 2.5ZM16 8.5C14.62 8.5 13.5 9.62 13.5 11C13.5 12.38 14.62 13.5 16 13.5C17.38 13.5 18.5 12.38 18.5 11C18.5 9.62 17.38 8.5 16 8.5Z"
        fill={colors.graphite.markInk}
      />
      <Path
        d="M3.5 21.5C6.8 26.2 11.1 28.5 16 28.5C20.9 28.5 25.2 26.2 28.5 21.5C25.2 23.8 20.8 25 16 25C11.2 25 6.8 23.8 3.5 21.5Z"
        fill={colors.graphite.markInk}
      />
    </Svg>
  );
}

/**
 * Cream-to-graphite transition beneath the Home hero. One continuous physical
 * surface: the cream field narrows symmetrically into a single keel point on
 * the centre axis, with the black Anchor brand mark sitting in the cream
 * negative space immediately above that point. The splice itself is not an
 * anchor shape, and it is drawn — not stretched — at the measured width.
 */
export function V2HomeCreamSplice({ testID }: { testID?: string }) {
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? windowWidth;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== measured) setMeasured(next);
  };

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={styles.container}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height={V2_HOME_SPLICE_HEIGHT}
        viewBox={'0 -2 ' + width + ' ' + (V2_HOME_SPLICE_HEIGHT + 2)}
        preserveAspectRatio="none"
      >
        <Path d={buildSplicePath(width)} fill={colors.canvas} />
      </Svg>
      <View style={styles.mark}>
        <AnchorBrandMark />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: V2_HOME_SPLICE_HEIGHT,
    backgroundColor: colors.graphite.base,
  },
  mark: {
    position: 'absolute',
    top: 12,
    left: '50%',
    marginLeft: -MARK_SIZE / 2,
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
});
