import type { ViewInstance } from 'react-native';
import type React from 'react';

export type ChartOneMoveTargetRefs = {
  rowRef: React.RefObject<ViewInstance | null>;
  circleRef: React.RefObject<ViewInstance | null>;
  bodyRef: React.RefObject<ViewInstance | null>;
};
