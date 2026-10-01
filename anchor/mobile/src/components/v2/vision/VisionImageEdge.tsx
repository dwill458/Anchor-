import { memo } from 'react';
import Animated, { interpolateColor, useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/v2';

/** Static aperture edges; no bitmap, filter, offscreen mask or per-frame work. */
export const VISION_EDGE_TOP = 'M0 0H1000V10L960 7 923 13 885 8 842 16 790 10 748 18 710 11 668 15 620 8 570 16 521 9 478 17 430 10 382 18 335 12 290 21 242 14 200 23 151 17 105 25 59 18 0 26Z';
export const VISION_EDGE_BOTTOM = 'M0 884L55 907 112 925 160 931 211 948 263 956 310 970 354 962 402 975 448 965 495 970 541 960 586 963 634 950 680 944 723 931 770 926 814 913 859 902 902 883 951 863 1000 835V1000H0Z';
export const VISION_EDGE_SUPPORT = 'M0 957L62 962 121 950 174 963 230 960 284 974 342 966 398 980 452 972 510 982 572 972 638 980 692 967 748 975 811 960 871 965 934 952 1000 958V1000H0Z';
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The paper that frames a photograph. With `darken` (0 to 1) the paper's colour
 * travels from `color` to `darkColor`, so a page that darkens around its photographs
 * takes the torn edges with it instead of leaving pale patches behind.
 */
export const VisionImageEdge = memo(function VisionImageEdge({ hero = false, color = colors.canvas, darken, darkColor = colors.ink.deep }: {
  hero?: boolean; color?: string; darken?: SharedValue<number>; darkColor?: string;
}) {
  const fillProps = useAnimatedProps(() => ({ fill: darken ? interpolateColor(darken.value, [0, 1], [color, darkColor]) : color }));
  const strokeProps = useAnimatedProps(() => ({ stroke: darken ? interpolateColor(darken.value, [0, 1], [color, darkColor]) : color }));
  if (darken) {
    return <Svg pointerEvents="none" accessible={false} width="101%" height="101%" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: 'absolute', left: '-0.5%', top: '-0.5%' }}>
      <AnimatedPath d={VISION_EDGE_TOP} animatedProps={fillProps} />
      <AnimatedPath d={hero ? VISION_EDGE_BOTTOM : VISION_EDGE_SUPPORT} animatedProps={fillProps} />
      <AnimatedPath d="M0 0H1000V1000H0Z" fill="none" strokeWidth={3} animatedProps={strokeProps} />
      {hero ? <AnimatedPath d="M0 861L95 901 195 935 305 958M0 873L110 916 239 951" fill="none" strokeWidth={5} animatedProps={strokeProps} /> : null}
    </Svg>;
  }
  return <Svg pointerEvents="none" accessible={false} width="101%" height="101%" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: 'absolute', left: '-0.5%', top: '-0.5%' }}>
    <Path d={VISION_EDGE_TOP} fill={color} />
    <Path d={hero ? VISION_EDGE_BOTTOM : VISION_EDGE_SUPPORT} fill={color} />
    <Path d="M0 0H1000V1000H0Z" fill="none" stroke={color} strokeWidth={3} />
    {hero ? <Path d="M0 861L95 901 195 935 305 958M0 873L110 916 239 951" fill="none" stroke={color} strokeWidth={5} /> : null}
  </Svg>;
});
