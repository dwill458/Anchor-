import { Dimensions, PixelRatio, Platform } from 'react-native';
import {
  getDetectedPerformanceTier,
  tierPolicy,
  usePerformanceTier,
  type PerformanceTier,
  type PerformanceTierOverride,
} from '@/hooks/usePerformanceTier';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';

const screen = Dimensions.get('screen');
const pixelRatio = PixelRatio.get();

// Total physical pixels:
//   ~5.5 M  — Samsung S24 Ultra, Pixel 8 Pro, iPhone 15 Pro
//   ~2.5 M  — upper-mid-range (Galaxy A54, Pixel 6a)
//   ~1.2 M  — budget (Galaxy A14, Moto G Play)
export const physicalPixelCount = screen.width * screen.height * pixelRatio * pixelRatio;

export const HIGH_END_THRESHOLD = 2_500_000;

/**
 * True on iOS and flagship Android hardware.
 * Uses unified performance tier detection.
 */
export const isHighEndDevice: boolean = getDetectedPerformanceTier() === 'high';
export const isLowEndDevice: boolean = getDetectedPerformanceTier() === 'low';

export {
  getDetectedPerformanceTier,
  tierPolicy,
  usePerformanceTier,
  useAppPerformanceTier,
  type PerformanceTier,
  type PerformanceTierOverride,
};
