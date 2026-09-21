import React, { memo, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/v2';

export const V2_HOME_SPLICE_HEIGHT = 46;
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

const MARK_WIDTH = 23;
const MARK_HEIGHT = 29;

function AnchorBrandMark() {
  return <Image source={require('@/assets/home/anchor-brand-mark.png')}
    style={styles.brandArtwork} resizeMode="contain" />;
}

/**
 * Cream-to-graphite transition beneath the Home hero. One continuous physical
 * surface: the cream field narrows symmetrically into a single keel point on
 * the centre axis, with the black Anchor brand mark sitting over the continuous
 * landscape immediately above that point. The splice itself is not an
 * anchor shape, and it is drawn — not stretched — at the measured width.
 */
function V2HomeCreamSpliceComponent({ testID }: { testID?: string }) {
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
        <Path
          d={`M 0 -2 H ${width} V ${V2_HOME_SPLICE_HEIGHT} H 0 Z ${buildSplicePath(width)}`}
          fillRule="evenodd"
          fill={colors.graphite.base}
        />
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
    backgroundColor: 'transparent',
  },
  mark: {
    position: 'absolute',
    top: 3,
    left: '50%',
    marginLeft: -MARK_WIDTH / 2,
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },
  brandArtwork: { width: MARK_WIDTH, height: MARK_HEIGHT },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeCreamSplice = memo(V2HomeCreamSpliceComponent);
