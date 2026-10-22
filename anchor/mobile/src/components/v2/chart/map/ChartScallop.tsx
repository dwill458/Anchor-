import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { scallopPath } from './chartMapGeometry';

type Props = {
  width: number;
  color?: string;
  /** Swappable art slot; only the prototype scallop exists today. */
  variant?: 'prototype';
  testID?: string;
};

const VIEW_W = 390;
const VIEW_H = 40;

/** Scalloped map-to-panel divider. Decorative: hidden from assistive tech. */
export function ChartScallop({ width, color = CHART_MAP_TOKENS.ink, testID }: Props) {
  const d = React.useMemo(() => scallopPath(VIEW_W, VIEW_H), []);
  const height = (width * VIEW_H) / VIEW_W;
  return (
    <Svg
      testID={testID}
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Path d={d} fill={color} />
    </Svg>
  );
}
