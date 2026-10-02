import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { DESIGN_HEIGHT, DESIGN_WIDTH } from './creationFlowConfig';

/**
 * Maps the 390x844 design space onto the device. One scale for everything (`min(w/390, h/844)`),
 * content centred; the cream paper and the ink band always fill the whole screen.
 */
export interface FlowLayout {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function computeFlowLayout(width: number, height: number): FlowLayout {
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  return {
    width,
    height,
    scale,
    offsetX: (width - DESIGN_WIDTH * scale) / 2,
    offsetY: (height - DESIGN_HEIGHT * scale) / 2,
  };
}

export function useFlowLayout(): FlowLayout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeFlowLayout(width, height), [width, height]);
}
