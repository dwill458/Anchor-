import type React from 'react';
import type { View } from 'react-native';

export type ChartOneMoveTargetRefs = {
  rowRef: React.RefObject<View | null>;
  circleRef: React.RefObject<View | null>;
  bodyRef: React.RefObject<View | null>;
};
